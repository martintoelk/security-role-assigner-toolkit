import type { ChangeAction, RoleAssignment, SecurityRole, Target } from "./types";

export interface PreviewRequest { action: ChangeAction; removeFromAllBusinessUnits: boolean; targets: Target[]; roles: SecurityRole[]; selectedRoleIds: string[]; assignments: RoleAssignment[]; }
export interface PreviewItem { target: Target; role: SecurityRole; outcome: "apply" | "skip"; changeCount: number; detail: string; }
export interface Preview { items: PreviewItem[]; applyCount: number; skipCount: number; }

export function filterByText<T extends { name: string }>(items: T[], text: string): T[] {
    const query = text.trim().toLocaleLowerCase();
    return query ? items.filter((item) => item.name.toLocaleLowerCase().includes(query)) : items;
}

export function createRoleChangePreview(request: PreviewRequest): Preview {
    const roleById = new Map(request.roles.map((role) => [role.id, role]));
    const selectedRoles = request.roles.filter((role) => request.selectedRoleIds.includes(role.id));
    const items = request.targets.flatMap((target) => selectedRoles.map((role) => {
        const assigned = request.assignments.filter((assignment) => assignment.targetId === target.id).map((assignment) => roleById.get(assignment.roleId)).filter((value): value is SecurityRole => Boolean(value));
        const matching = request.removeFromAllBusinessUnits ? assigned.filter((assignedRole) => assignedRole.logicalId === role.logicalId) : assigned.filter((assignedRole) => assignedRole.id === role.id);
        const canApply = request.action === "add" ? !assigned.some((assignedRole) => assignedRole.id === role.id) : matching.length > 0;
        const changeCount = canApply ? (request.action === "remove" && request.removeFromAllBusinessUnits ? matching.length : 1) : 0;
        return { target, role, outcome: canApply ? "apply" : "skip", changeCount, detail: canApply ? (request.action === "add" ? "Will assign exact selected role" : request.removeFromAllBusinessUnits ? `Will remove ${matching.length} assigned role copy/copies` : "Will remove exact selected role") : request.action === "add" ? "Already assigned" : "Not assigned" } satisfies PreviewItem;
    }));
    return { items, applyCount: items.reduce((count, item) => count + item.changeCount, 0), skipCount: items.filter((item) => item.outcome === "skip").length };
}
