import { describe, expect, it } from "vitest";
import { proceduralRoadCrossesPatterns } from "./proceduralBlueprintSafety";
import type { ProceduralPatternPlacement, ProceduralRoad } from "./proceduralBlueprint";

describe("Procedural Blueprint road safety", () => {
  const building: ProceduralPatternPlacement = {
    role: "landmark",
    patternId: "lab",
    x: 4,
    y: 3,
    width: 3,
    height: 3,
    anchor: { x: 5, y: 6 },
  };

  it("detects a route segment that crosses a saved structure", () => {
    const road: ProceduralRoad = {
      kind: "exit",
      label: "east",
      points: [{ x: 1, y: 4 }, { x: 10, y: 4 }],
    };
    expect(proceduralRoadCrossesPatterns(road, [building])).toBe(true);
  });

  it("accepts an orthogonal route around the structure", () => {
    const road: ProceduralRoad = {
      kind: "exit",
      label: "east",
      points: [{ x: 1, y: 4 }, { x: 1, y: 7 }, { x: 10, y: 7 }, { x: 10, y: 4 }],
    };
    expect(proceduralRoadCrossesPatterns(road, [building])).toBe(false);
  });

  it("rejects diagonal input defensively", () => {
    const road: ProceduralRoad = {
      kind: "exit",
      label: "north",
      points: [{ x: 1, y: 1 }, { x: 5, y: 5 }],
    };
    expect(proceduralRoadCrossesPatterns(road, [building])).toBe(true);
  });
});
