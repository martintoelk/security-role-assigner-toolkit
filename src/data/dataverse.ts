import { loadAllPages } from "./paging";
import type { RoleData, SecurityRole, Target, TargetType } from "../domain/types";

const fetchXml = (entity: string, attributes: string[], page: number, cookie?: string) => `<fetch page="${page}"${cookie ? ` paging-cookie="${encodeURIComponent(cookie)}"` : ""}><entity name="${entity}">${attributes.map((attribute) => `<attribute name="${attribute}" />`).join("")}</entity></fetch>`;
const string = (record: Record<string, unknown>, key: string) => String(record[key] ?? "");

async function read(entity: string, attributes: string[]) { return loadAllPages((page, cookie) => window.dataverseAPI.fetchXmlQuery(fetchXml(entity, attributes, page, cookie))); }
function toTargets(records: Record<string, unknown>[], type: TargetType): Target[] { const id = type === "team" ? "teamid" : "systemuserid"; const name = type === "team" ? "name" : "fullname"; return records.map((record) => ({ id: string(record, id), name: string(record, name), businessUnitId: string(record, "businessunitid"), type })); }

export async function loadSecurityRoleData(): Promise<RoleData> {
    const [teams, users, roles, businessUnits, teamRoles, userRoles] = await Promise.all([
        read("team", ["teamid", "name", "businessunitid"]), read("systemuser", ["systemuserid", "fullname", "businessunitid"]), read("role", ["roleid", "name", "businessunitid", "roletemplateid"]), read("businessunit", ["businessunitid", "name"]), read("teamroles", ["teamid", "roleid"]), read("systemuserroles", ["systemuserid", "roleid"]),
    ]);
    return { teams: toTargets(teams, "team"), users: toTargets(users, "user"), roles: roles.map((record): SecurityRole => ({ id: string(record, "roleid"), logicalId: string(record, "roletemplateid") || string(record, "roleid"), name: string(record, "name"), businessUnitId: string(record, "businessunitid") })), businessUnits: businessUnits.map((record) => ({ id: string(record, "businessunitid"), name: string(record, "name") })), assignments: [...teamRoles.map((record) => ({ targetId: string(record, "teamid"), roleId: string(record, "roleid") })), ...userRoles.map((record) => ({ targetId: string(record, "systemuserid"), roleId: string(record, "roleid") }))] };
}
