import { loadAllPages } from "./paging";
import type { RoleData, SecurityRole, Target, TargetType } from "../domain/types";
import type { RoleChangeOperation } from "../domain/preview";

export class RoleChangeCancelledError extends Error {
    constructor() { super("Role change operation cancelled"); }
}

export interface RoleChangeResult {
    operation: RoleChangeOperation;
    outcome: "applied" | "applied-with-fallback" | "failed";
    role: SecurityRole;
    message?: string;
}

const fetchXml = (entity: string, attributes: string[], page: number, cookie?: string, includeBusinessUnit = false) => `<fetch page="${page}"${cookie ? ` paging-cookie="${encodeURIComponent(cookie)}"` : ""}><entity name="${entity}">${attributes.map((attribute) => `<attribute name="${attribute}" />`).join("")}${includeBusinessUnit ? '<link-entity name="businessunit" from="businessunitid" to="businessunitid" link-type="outer" alias="businessunit"><attribute name="name" alias="businessunitname" /></link-entity>' : ""}</entity></fetch>`;
const string = (record: Record<string, unknown>, key: string) => String(record[key] ?? "");
const boolean = (record: Record<string, unknown>, key: string) => record[key] === true || record[key] === 1 || string(record, key).toLocaleLowerCase() === "true";
const lookupId = (record: Record<string, unknown>, key: string) => {
    const value = record[key];
    if (value && typeof value === "object") {
        const lookup = value as { id?: unknown; Id?: unknown; guid?: unknown };
        return String(lookup.id ?? lookup.Id ?? lookup.guid ?? "");
    }
    return string(record, key);
};

/** The official Modernized BU feature flag is stored in Organization.orgdborgsettings XML. */
export function isModernizedBusinessUnitsEnabled(orgDbOrgSettings: string) {
    return /<EnableOwnershipAcrossBusinessUnits>\s*true\s*<\/EnableOwnershipAcrossBusinessUnits>/i.test(orgDbOrgSettings);
}

async function read(entity: string, attributes: string[], includeBusinessUnit = false) { return loadAllPages((page, cookie) => window.dataverseAPI.fetchXmlQuery(fetchXml(entity, attributes, page, cookie, includeBusinessUnit))); }
async function readAssignments(entity: "team" | "systemuser", id: string) {
    const intersect = entity === "team" ? "teamroles" : "systemuserroles";
    return loadAllPages((page, cookie) => window.dataverseAPI.fetchXmlQuery(`<fetch page="${page}"${cookie ? ` paging-cookie="${encodeURIComponent(cookie)}"` : ""}><entity name="${entity}"><attribute name="${id}" /><link-entity name="${intersect}" from="${id}" to="${id}" intersect="true"><link-entity name="role" from="roleid" to="roleid" link-type="outer" alias="assignedrole"><attribute name="roleid" alias="assignedroleid" /></link-entity></link-entity></entity></fetch>`));
}
function toTargets(records: Record<string, unknown>[], type: TargetType): Target[] {
    const id = type === "team" ? "teamid" : "systemuserid";
    const name = type === "team" ? "name" : "fullname";
    return records.map((record) => ({ id: string(record, id), name: string(record, name), businessUnitId: lookupId(record, "businessunitid"), businessUnitName: string(record, "businessunitname") || string(record, "businessunitid@OData.Community.Display.V1.FormattedValue"), type, teamType: type === "team" ? string(record, "teamtype@OData.Community.Display.V1.FormattedValue") || string(record, "teamtype") : undefined, isDisabled: type === "user" ? boolean(record, "isdisabled") : undefined }));
}

export async function loadSecurityRoleData(): Promise<RoleData> {
    const [teams, users, roles, businessUnits, teamAssignments, userAssignments, organizations] = await Promise.all([
        read("team", ["teamid", "name", "businessunitid", "teamtype"], true), read("systemuser", ["systemuserid", "fullname", "businessunitid", "isdisabled"], true), read("role", ["roleid", "name", "businessunitid", "parentrootroleid"], true), read("businessunit", ["businessunitid", "name"]), readAssignments("team", "teamid"), readAssignments("systemuser", "systemuserid"), read("organization", ["orgdborgsettings"]),
    ]);
    const assignments = (rows: Record<string, unknown>[], targetId: string) => rows.filter((record) => lookupId(record, "assignedroleid")).map((record) => ({ targetId: string(record, targetId), roleId: lookupId(record, "assignedroleid") }));
    const mappedBusinessUnits = businessUnits.map((record) => ({ id: string(record, "businessunitid"), name: string(record, "name") }));
    const businessUnitName = (id: string) => mappedBusinessUnits.find((businessUnit) => businessUnit.id === id)?.name ?? "";
    const mappedRoles = roles.map((record): SecurityRole => ({ id: string(record, "roleid"), rootRoleId: lookupId(record, "parentrootroleid") || string(record, "roleid"), name: string(record, "name"), businessUnitId: lookupId(record, "businessunitid"), businessUnitName: string(record, "businessunitname") || string(record, "businessunitid@OData.Community.Display.V1.FormattedValue") })).sort((left, right) => left.name.localeCompare(right.name) || (left.businessUnitName || businessUnitName(left.businessUnitId)).localeCompare(right.businessUnitName || businessUnitName(right.businessUnitId)));
    const businessUnitMode = isModernizedBusinessUnitsEnabled(string(organizations[0] ?? {}, "orgdborgsettings")) ? "modernized" : "traditional";
    return { teams: toTargets(teams, "team"), users: toTargets(users, "user"), roles: mappedRoles, businessUnits: mappedBusinessUnits, assignments: [...assignments(teamAssignments, "teamid"), ...assignments(userAssignments, "systemuserid")], businessUnitMode };
}

/** Applies already-previewed role associations one at a time, preserving a precise failure boundary. */
export async function applyRoleChangeOperations(operations: RoleChangeOperation[], onProgress?: (completed: number, total: number) => void, signal?: AbortSignal): Promise<RoleChangeResult[]> {
    let completed = 0;
    const results: RoleChangeResult[] = [];
    for (const operation of operations) {
        if (signal?.aborted) throw new RoleChangeCancelledError();
        const entity = operation.target.type === "team" ? "team" : "systemuser";
        const relationship = operation.target.type === "team" ? "teamroles_association" : "systemuserroles_association";
        try {
            if (operation.action === "add") {
                try {
                    await window.dataverseAPI.associate(entity, operation.target.id, relationship, "role", operation.role.id);
                    results.push({ operation, outcome: "applied", role: operation.role });
                } catch (cause) {
                    if (!operation.fallbackRole) throw cause;
                    await window.dataverseAPI.associate(entity, operation.target.id, relationship, "role", operation.fallbackRole.id);
                    results.push({ operation, outcome: "applied-with-fallback", role: operation.fallbackRole, message: "Applied using the target business unit role copy." });
                }
            } else {
                await window.dataverseAPI.disassociate(entity, operation.target.id, relationship, operation.role.id);
                results.push({ operation, outcome: "applied", role: operation.role });
            }
        } catch (cause) {
            const dataverseMessage = cause instanceof Error ? cause.message : "Unknown Dataverse error";
            results.push({ operation, outcome: "failed", role: operation.role, message: operation.fallbackUnavailableReason ? `${operation.fallbackUnavailableReason} Exact association failed: ${dataverseMessage}` : dataverseMessage });
        }
        completed += 1;
        onProgress?.(completed, operations.length);
    }
    return results;
}
