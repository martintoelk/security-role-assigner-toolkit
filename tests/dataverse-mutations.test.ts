import { describe, expect, it, vi } from "vitest";
import { applyRoleChangeOperations, RoleChangeCancelledError } from "../src/data/dataverse";
import type { RoleChangeOperation } from "../src/domain/preview";

const operation: RoleChangeOperation = {
    action: "add",
    target: { id: "team-a", name: "Sales Team", businessUnitId: "bu-a", type: "team" },
    role: { id: "role-a", rootRoleId: "logical-a", name: "Salesperson", businessUnitId: "bu-a" },
};

describe("applyRoleChangeOperations", () => {
    it("associates and disassociates the selected role through the correct target relationship", async () => {
        const associate = vi.fn().mockResolvedValue(undefined);
        const disassociate = vi.fn().mockResolvedValue(undefined);
        Object.assign(globalThis, { window: { dataverseAPI: { associate, disassociate } } });

        const progress = vi.fn();
        await applyRoleChangeOperations([operation, { ...operation, action: "remove" }], progress);

        expect(associate).toHaveBeenCalledWith("team", "team-a", "teamroles_association", "role", "role-a");
        expect(disassociate).toHaveBeenCalledWith("team", "team-a", "teamroles_association", "role-a");
        expect(progress).toHaveBeenNthCalledWith(1, 1, 2);
        expect(progress).toHaveBeenNthCalledWith(2, 2, 2);
    });

    it("stops before the next request when cancelled", async () => {
        const associate = vi.fn().mockResolvedValue(undefined);
        Object.assign(globalThis, { window: { dataverseAPI: { associate, disassociate: vi.fn() } } });
        const controller = new AbortController();
        controller.abort();

        await expect(applyRoleChangeOperations([operation], undefined, controller.signal)).rejects.toBeInstanceOf(RoleChangeCancelledError);
        expect(associate).not.toHaveBeenCalled();
    });
});
