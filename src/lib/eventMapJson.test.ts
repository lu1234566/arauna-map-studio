import { describe, expect, it } from "vitest";
import {
  addEvent,
  eventRecord,
  moveEvent,
  parseEditableMapJson,
  removeEvent,
  stringifyMapJson,
  updateEventField,
} from "./eventMapJson";

const SOURCE = JSON.stringify({
  id: "MAP_TEST",
  name: "Test",
  layout: "LAYOUT_TEST",
  custom_field: { keep: true },
  warp_events: [
    { x: 1, y: 2, elevation: 0, dest_map: "MAP_ROUTE101", dest_warp_id: "0", extra: "preserve" },
  ],
  object_events: [],
  coord_events: [],
  bg_events: [],
});

describe("eventMapJson", () => {
  it("moves an event while preserving unrelated and unknown fields", () => {
    const original = parseEditableMapJson(SOURCE);
    const moved = moveEvent(original, "warp:0", 7, 9);
    expect(eventRecord(moved, "warp:0")?.record.x).toBe(7);
    expect(eventRecord(moved, "warp:0")?.record.y).toBe(9);
    expect(eventRecord(moved, "warp:0")?.record.extra).toBe("preserve");
    expect((moved.custom_field as { keep: boolean }).keep).toBe(true);
    expect(eventRecord(original, "warp:0")?.record.x).toBe(1);
  });

  it("keeps numeric fields numeric and string fields strings", () => {
    const original = parseEditableMapJson(SOURCE);
    const elevation = updateEventField(original, "warp:0", "elevation", "3");
    const destination = updateEventField(elevation, "warp:0", "dest_warp_id", "4");
    expect(eventRecord(destination, "warp:0")?.record.elevation).toBe(3);
    expect(eventRecord(destination, "warp:0")?.record.dest_warp_id).toBe("4");
  });

  it("adds by cloning an existing source event when possible", () => {
    const original = parseEditableMapJson(SOURCE);
    const result = addEvent(original, "warp", 12, 13);
    expect(result.id).toBe("warp:1");
    expect(eventRecord(result.document, result.id)?.record.dest_map).toBe("MAP_ROUTE101");
    expect(eventRecord(result.document, result.id)?.record.x).toBe(12);
  });

  it("adds defaults for empty event arrays and removes them again", () => {
    const original = parseEditableMapJson(SOURCE);
    const added = addEvent(original, "bg", 4, 5);
    expect(eventRecord(added.document, added.id)?.record.type).toBe("sign");
    const removed = removeEvent(added.document, added.id);
    expect(eventRecord(removed, added.id)).toBeNull();
  });

  it("serializes a valid indented map.json with a trailing newline", () => {
    const document = parseEditableMapJson(SOURCE);
    const output = stringifyMapJson(document);
    expect(output.endsWith("\n")).toBe(true);
    expect(JSON.parse(output).custom_field.keep).toBe(true);
  });
});
