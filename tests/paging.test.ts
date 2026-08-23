import { describe, expect, it } from "vitest";
import { loadAllPages } from "../src/data/paging";

describe("loadAllPages", () => {
    it("continues until Dataverse returns no paging cookie", async () => {
        const calls: number[] = [];
        const records = await loadAllPages(async (page) => {
            calls.push(page);
            return page === 1 ? { value: [{ id: "first" }], "@Microsoft.Dynamics.CRM.fetchxmlpagingcookie": "next" } : { value: [{ id: "second" }] };
        });
        expect(calls).toEqual([1, 2]);
        expect(records).toEqual([{ id: "first" }, { id: "second" }]);
    });
});
