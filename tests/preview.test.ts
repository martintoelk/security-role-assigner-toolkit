import { describe, expect, it } from "vitest";
import { createRoleChangePreview, filterByText } from "../src/domain/preview";
import type { RoleAssignment, SecurityRole, Target } from "../src/domain/types";

const role: SecurityRole = { id: "role-a", logicalId: "logical-a", name: "Salesperson", businessUnitId: "bu-a" };
const target: Target = { id: "team-a", name: "Sales Team", businessUnitId: "bu-a", type: "team" };

describe("createRoleChangePreview", () => {
    it("marks an exact assigned role as an idempotent add skip", () => {
        const assignments: RoleAssignment[] = [{ targetId: target.id, roleId: role.id }];
        expect(createRoleChangePreview({ action: "add", removeFromAllBusinessUnits: false, targets: [target], roles: [role], selectedRoleIds: [role.id], assignments })).toMatchObject({ applyCount: 0, skipCount: 1 });
    });

    it("removes every logical-role copy only when remove from all BUs is selected", () => {
        const rootCopy: SecurityRole = { ...role, id: "role-root", businessUnitId: "root" };
        const assignments: RoleAssignment[] = [{ targetId: target.id, roleId: role.id }, { targetId: target.id, roleId: rootCopy.id }];
        expect(createRoleChangePreview({ action: "remove", removeFromAllBusinessUnits: false, targets: [target], roles: [role, rootCopy], selectedRoleIds: [role.id], assignments }).applyCount).toBe(1);
        expect(createRoleChangePreview({ action: "remove", removeFromAllBusinessUnits: true, targets: [target], roles: [role, rootCopy], selectedRoleIds: [role.id], assignments }).applyCount).toBe(2);
    });

    it("filters targets without changing the source list", () => {
        expect(filterByText([target, { ...target, id: "team-b", name: "Finance" }], "sales")).toEqual([target]);
    });
});
