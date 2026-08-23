export type TargetType = "team" | "user";
export type ChangeAction = "add" | "remove";
export type BusinessUnitMode = "modernized" | "traditional";

export interface Target { id: string; name: string; businessUnitId: string; businessUnitName?: string; type: TargetType; teamType?: string; isDisabled?: boolean; }
export interface SecurityRole { id: string; rootRoleId: string; name: string; businessUnitId: string; businessUnitName?: string; }
export interface RoleAssignment { targetId: string; roleId: string; }
export interface RoleData { teams: Target[]; users: Target[]; roles: SecurityRole[]; assignments: RoleAssignment[]; businessUnits: { id: string; name: string }[]; businessUnitMode: BusinessUnitMode; }

export function targetsFor(data: RoleData, type: TargetType): Target[] { return type === "team" ? data.teams : data.users; }
