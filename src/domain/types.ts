export type TargetType = "team" | "user";
export type ChangeAction = "add" | "remove";

export interface Target { id: string; name: string; businessUnitId: string; type: TargetType; }
export interface SecurityRole { id: string; logicalId: string; name: string; businessUnitId: string; }
export interface RoleAssignment { targetId: string; roleId: string; }
export interface RoleData { teams: Target[]; users: Target[]; roles: SecurityRole[]; assignments: RoleAssignment[]; businessUnits: { id: string; name: string }[]; }

export function targetsFor(data: RoleData, type: TargetType): Target[] { return type === "team" ? data.teams : data.users; }
