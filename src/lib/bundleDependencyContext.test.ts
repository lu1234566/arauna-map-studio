import { afterEach, describe, expect, it } from "vitest";
import { buildCityBundle } from "./araunaCityBundle";
import {
  clearBundleDependencyContext,
  importedSharedEventsSnapshot,
  installBundleDependencyContextFromImport,
} from "./bundleDependencyContext";
import { withSharedEventsSnapshot } from "./cityBundleDependencies";
import type { MapData } from "./emeraldMap";
import type { EditableMapJson } from "./eventMapJson";

function map(): MapData {
  return {
    width: 2,
    height: 2,
    metatiles: Uint16Array.from([1, 1, 1, 1]),
    physical: Uint16Array.from([0x3000, 0x3000, 0x3000, 0x3000]),
  };
}

function consumer(): EditableMapJson {
  return {
    id: "MAP_CHILD",
    name: "Child",
    layout: "LAYOUT_CHILD",
    shared_events_map: "Shared",
  };
}

function shared(): EditableMapJson {
  return {
    id: "MAP_SHARED",
    name: "Shared",
    layout: "LAYOUT_SHARED",
    object_events: [],
    warp_events: [],
    coord_events: [],
    bg_events: [],
  };
}

afterEach(() => clearBundleDependencyContext());

describe("bundleDependencyContext", () => {
  it("restores a valid shared-event snapshot only for the installed mapJson object", () => {
    const semantics = withSharedEventsSnapshot(undefined, "Shared", shared());
    const bundle = buildCityBundle({ map: map(), mapJson: consumer(), semantics });
    const installedDocument = { ...bundle.mapJson };

    expect(installBundleDependencyContextFromImport(bundle, installedDocument)).not.toBeNull();
    expect(importedSharedEventsSnapshot(installedDocument, "Shared")?.mapJson.name).toBe("Shared");
    expect(importedSharedEventsSnapshot({ ...installedDocument }, "Shared")).toBeNull();
    expect(importedSharedEventsSnapshot(installedDocument, "Other")).toBeNull();
  });

  it("rejects a document with a different map identity", () => {
    const semantics = withSharedEventsSnapshot(undefined, "Shared", shared());
    const bundle = buildCityBundle({ map: map(), mapJson: consumer(), semantics });
    const wrongDocument = { ...bundle.mapJson, id: "MAP_OTHER" };

    expect(installBundleDependencyContextFromImport(bundle, wrongDocument)).toBeNull();
    expect(importedSharedEventsSnapshot(wrongDocument, "Shared")).toBeNull();
  });
});
