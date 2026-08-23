import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

describe("PPTB package manifest", () => {
    it("declares the approved public tool identity", () => {
        expect(manifest.name).toBe("@martintoelk/bu-security-role-assigner");
        expect(manifest.main).toBe("index.html");
        expect(manifest.icon).toBe("icons/role-shield.svg");
        expect(manifest.license).toBe("MIT");
        expect(manifest.configurations.repository).toBe("https://github.com/martintoelk/security-role-assigner-toolkit");
        expect(manifest.configurations.readmeUrl).toBe("https://raw.githubusercontent.com/martintoelk/security-role-assigner-toolkit/master/README.md");
        expect(manifest.features).toEqual({ multiConnection: "none", minAPI: "1.2.0" });
    });
});
