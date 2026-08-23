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

    it("retries a failed traditional-BU add once using its target-BU role copy", async () => {
        const associate = vi.fn().mockRejectedValueOnce(new Error("exact role is not valid for this business unit")).mockResolvedValueOnce(undefined);
        Object.assign(globalThis, { window: { dataverseAPI: { associate, disassociate: vi.fn() } } });
        const fallbackRole = { ...operation.role, id: "role-classic-copy", businessUnitId: "bu-a" };

        const results = await applyRoleChangeOperations([{ ...operation, fallbackRole }]);

        expect(associate).toHaveBeenNthCalledWith(1, "team", "team-a", "teamroles_association", "role", "role-a");
        expect(associate).toHaveBeenNthCalledWith(2, "team", "team-a", "teamroles_association", "role", "role-classic-copy");
        expect(results).toMatchObject([{ outcome: "applied-with-fallback", role: fallbackRole }]);
    });

    it("reports a failed target and continues processing remaining targets", async () => {
        const associate = vi.fn().mockRejectedValueOnce(new Error("access team")).mockResolvedValueOnce(undefined);
        Object.assign(globalThis, { window: { dataverseAPI: { associate, disassociate: vi.fn() } } });
        const nextOperation = { ...operation, target: { ...operation.target, id: "team-b", name: "Operations Team", teamType: "Access" } };
        const progress = vi.fn();

        const results = await applyRoleChangeOperations([operation, nextOperation], progress);

        expect(results.map((result) => result.outcome)).toEqual(["failed", "applied"]);
        expect(results[0].message).toContain("access team");
        expect(progress).toHaveBeenNthCalledWith(2, 2, 2);
    });

    it("makes a missing classic-BU role copy clear when the exact association faults", async () => {
        const associate = vi.fn().mockRejectedValue(new Error("role cannot be assigned"));
        Object.assign(globalThis, { window: { dataverseAPI: { associate, disassociate: vi.fn() } } });

        const [result] = await applyRoleChangeOperations([{ ...operation, fallbackUnavailableReason: "No matching root-role copy exists in the target business unit." }]);

        expect(result.outcome).toBe("failed");
        expect(result.message).toContain("No matching root-role copy");
    });
});
