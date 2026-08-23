import { describe, expect, it } from "vitest";
import { isModernizedBusinessUnitsEnabled } from "../src/data/dataverse";

describe("isModernizedBusinessUnitsEnabled", () => {
    it("reports traditional business units when the OrgDB setting is absent or disabled", () => {
        expect(isModernizedBusinessUnitsEnabled("")).toBe(false);
        expect(isModernizedBusinessUnitsEnabled("<OrgSettings><EnableOwnershipAcrossBusinessUnits>false</EnableOwnershipAcrossBusinessUnits></OrgSettings>")).toBe(false);
    });

    it("reports modernized business units only when the OrgDB setting is enabled", () => {
        expect(isModernizedBusinessUnitsEnabled("<OrgSettings><EnableOwnershipAcrossBusinessUnits>true</EnableOwnershipAcrossBusinessUnits></OrgSettings>")).toBe(true);
    });
});
