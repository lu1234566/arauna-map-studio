import { describe, expect, it } from "vitest";
import { candidateBudget } from "./proceduralCandidates";

describe("Procedural candidate budget", () => {
  it("allows up to 24 candidates for normal GBA-sized layouts", () => {
    expect(candidateBudget({ width: 40, height: 40 }, 24)).toBe(24);
  });

  it("reduces batch size as map area grows", () => {
    expect(candidateBudget({ width: 80, height: 80 }, 24)).toBe(16);
    expect(candidateBudget({ width: 160, height: 160 }, 24)).toBe(8);
    expect(candidateBudget({ width: 512, height: 512 }, 24)).toBe(4);
  });

  it("never returns fewer than one candidate", () => {
    expect(candidateBudget({ width: 30, height: 30 }, 0)).toBe(1);
  });
});
