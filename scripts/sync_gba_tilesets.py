#!/usr/bin/env python3
"""Build pixel-perfect Gen III metatile atlases from pret decomps.

Sources are fetched at build time from:
- pret/pokeemerald
- pret/pokeruby
- pret/pokefirered

The generated browser library contains one atlas for every primary+secondary
pair that is actually referenced by a map layout in each decomp. This avoids
inventing incompatible pairings while covering the real in-game tileset
combinations.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import struct
import subprocess
import tempfile
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Iterable

from PIL import Image

TILE_SIZE = 8
METATILE_SIZE = 16
TILES_PER_METATILE = 8
INDEX_GRAYS = [255, 238, 222, 205, 189, 172, 156, 139, 115, 98, 82, 65, 49, 32, 16, 0]
MAGENTA = (255, 0, 255, 255)


@dataclass(frozen=True)
class Family:
    id: str
    label: str
    repo: str
    primary_tile_limit: int
    primary_metatile_limit: int
    primary_palette_count: int
    total_palette_count: int
    native: bool
    attribute_bytes: int


FAMILIES = (
    Family("emerald", "Pokémon Emerald", "pret/pokeemerald", 512, 512, 6, 13, True, 2),
    Family("ruby-sapphire", "Pokémon Ruby / Sapphire", "pret/pokeruby", 512, 512, 6, 12, False, 2),
    Family("firered-leafgreen", "Pokémon FireRed / LeafGreen", "pret/pokefirered", 640, 640, 7, 13, False, 4),
)


def run(*args: str, cwd: Path | None = None) -> str:
    result = subprocess.run(args, cwd=cwd, check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return result.stdout.strip()


def normalized(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def symbol_key(symbol: str) -> str:
    return normalized(symbol.removeprefix("gTileset_"))


def clone_repo(family: Family, root: Path) -> tuple[Path, str]:
    target = root / family.id
    run("git", "clone", "--depth", "1", f"https://github.com/{family.repo}.git", str(target))
    revision = run("git", "rev-parse", "HEAD", cwd=target)
    return target, revision


def directory_index(root: Path, kind: str) -> dict[str, Path]:
    base = root / "data" / "tilesets" / kind
    return {normalized(path.name): path for path in base.iterdir() if path.is_dir()}


def resolve_tileset(index: dict[str, Path], symbol: str) -> Path | None:
    return index.get(symbol_key(symbol))


@lru_cache(maxsize=None)
def read_tiles(path_string: str) -> tuple[int, int, int, tuple[int, ...]]:
    path = Path(path_string)
    image = Image.open(path).convert("RGB")
    width, height = image.size
    if width % TILE_SIZE or height % TILE_SIZE:
        raise ValueError(f"{path}: tiles.png dimensions must be multiples of 8, got {width}x{height}")
    indexed: list[int] = []
    for r, g, b in image.getdata():
        if max(r, g, b) - min(r, g, b) > 3:
            raise ValueError(f"{path}: expected indexed grayscale tiles.png")
        value = int(round((r + g + b) / 3))
        indexed.append(min(range(16), key=lambda i: abs(value - INDEX_GRAYS[i])))
    tiles_per_row = width // TILE_SIZE
    return width, height, tiles_per_row, tuple(indexed)


@lru_cache(maxsize=None)
def read_metatiles(path_string: str) -> tuple[tuple[int, ...], int]:
    path = Path(path_string)
    data = path.read_bytes()
    stride = TILES_PER_METATILE * 2
    if not data or len(data) % stride:
        raise ValueError(f"{path}: invalid metatiles.bin size {len(data)}")
    entries = struct.unpack(f"<{len(data) // 2}H", data)
    return entries, len(data) // stride


@lru_cache(maxsize=None)
def read_palette(path_string: str) -> tuple[tuple[int, int, int], ...]:
    path = Path(path_string)
    lines = [line.strip() for line in path.read_text(encoding="utf-8").replace("\r", "").split("\n") if line.strip()]
    if len(lines) < 19 or lines[0] != "JASC-PAL" or int(lines[2]) != 16:
        raise ValueError(f"{path}: invalid JASC palette")
    colors = []
    for line in lines[3:19]:
        r, g, b = (int(value) for value in line.split())
        colors.append((r, g, b))
    return tuple(colors)


def palette_set(primary: Path, secondary: Path, family: Family) -> tuple[list[tuple[tuple[int, int, int], ...] | None], list[str]]:
    palettes: list[tuple[tuple[int, int, int], ...] | None] = [None] * family.total_palette_count
    warnings: list[str] = []
    for index in range(family.total_palette_count):
        owner = primary if index < family.primary_palette_count else secondary
        path = owner / "palettes" / f"{index:02}.pal"
        if path.exists():
            palettes[index] = read_palette(str(path))
        else:
            warnings.append(f"missing palette {index:02} at {path.relative_to(owner.parent.parent.parent)}")
    return palettes, warnings


def tile_pixel(sheet: tuple[int, int, int, tuple[int, ...]], tile_id: int, x: int, y: int) -> int | None:
    width, height, tiles_per_row, pixels = sheet
    tile_count = tiles_per_row * (height // TILE_SIZE)
    if tile_id < 0 or tile_id >= tile_count:
        return None
    tile_x = (tile_id % tiles_per_row) * TILE_SIZE
    tile_y = (tile_id // tiles_per_row) * TILE_SIZE
    return pixels[(tile_y + y) * width + tile_x + x]


def draw_tile(
    image: Image.Image,
    family: Family,
    primary_sheet: tuple[int, int, int, tuple[int, ...]],
    secondary_sheet: tuple[int, int, int, tuple[int, ...]],
    palettes: list[tuple[tuple[int, int, int], ...] | None],
    entry_raw: int,
    dest_x: int,
    dest_y: int,
) -> None:
    tile_id = entry_raw & 0x03FF
    h_flip = bool(entry_raw & 0x0400)
    v_flip = bool(entry_raw & 0x0800)
    palette_id = (entry_raw >> 12) & 0x0F
    if tile_id < family.primary_tile_limit:
        sheet = primary_sheet
        local_id = tile_id
    else:
        sheet = secondary_sheet
        local_id = tile_id - family.primary_tile_limit
    palette = palettes[palette_id] if palette_id < len(palettes) else None
    pixels = image.load()
    for py in range(TILE_SIZE):
        for px in range(TILE_SIZE):
            sx = TILE_SIZE - 1 - px if h_flip else px
            sy = TILE_SIZE - 1 - py if v_flip else py
            palette_index = tile_pixel(sheet, local_id, sx, sy)
            if palette_index == 0:
                continue
            if palette_index is None or palette is None or palette_index >= len(palette):
                pixels[dest_x + px, dest_y + py] = MAGENTA
            else:
                r, g, b = palette[palette_index]
                pixels[dest_x + px, dest_y + py] = (r, g, b, 255)


def render_metatile(
    family: Family,
    primary_sheet: tuple[int, int, int, tuple[int, ...]],
    secondary_sheet: tuple[int, int, int, tuple[int, ...]],
    palettes: list[tuple[tuple[int, int, int], ...] | None],
    entries: tuple[int, ...],
    local_id: int,
) -> Image.Image:
    image = Image.new("RGBA", (METATILE_SIZE, METATILE_SIZE), (0, 0, 0, 0))
    base = local_id * TILES_PER_METATILE
    positions = ((0, 0), (8, 0), (0, 8), (8, 8))
    for layer in range(2):
        for quadrant, (x, y) in enumerate(positions):
            draw_tile(
                image,
                family,
                primary_sheet,
                secondary_sheet,
                palettes,
                entries[base + layer * 4 + quadrant],
                x,
                y,
            )
    return image


def read_attributes(path: Path, family: Family, count: int) -> list[list[int] | None]:
    if not path.exists():
        return [None] * count
    data = path.read_bytes()
    width = family.attribute_bytes
    if len(data) % width:
        return [None] * count
    values: list[list[int] | None] = []
    for offset in range(0, min(len(data), count * width), width):
        raw = int.from_bytes(data[offset:offset + width], "little")
        if family.attribute_bytes == 4:
            behavior = raw & 0x1FF
            layer_type = (raw >> 29) & 0x3
        else:
            behavior = raw & 0xFF
            layer_type = (raw >> 12) & 0xF
        values.append([behavior, layer_type])
    if len(values) < count:
        values.extend([None] * (count - len(values)))
    return values


def unique_layout_pairs(layouts_path: Path) -> list[dict]:
    data = json.loads(layouts_path.read_text(encoding="utf-8"))
    grouped: dict[tuple[str, str], dict] = {}
    for layout in data.get("layouts", []):
        primary = layout.get("primary_tileset")
        secondary = layout.get("secondary_tileset")
        if not primary or not secondary or primary == "NULL" or secondary == "NULL":
            continue
        key = (primary, secondary)
        item = grouped.setdefault(key, {"primary": primary, "secondary": secondary, "maps": []})
        name = layout.get("name") or layout.get("id")
        if name:
            item["maps"].append(name)
    return list(grouped.values())


def pack_id(family: Family, primary_dir: Path, secondary_dir: Path) -> str:
    return f"{family.id}:{primary_dir.name}:{secondary_dir.name}"


def build_pack(
    repo: Path,
    out_root: Path,
    family: Family,
    revision: str,
    primary_symbol: str,
    secondary_symbol: str,
    primary_dir: Path,
    secondary_dir: Path,
    maps: list[str],
) -> dict:
    primary_tiles = read_tiles(str(primary_dir / "tiles.png"))
    secondary_tiles = read_tiles(str(secondary_dir / "tiles.png"))
    primary_entries, primary_count = read_metatiles(str(primary_dir / "metatiles.bin"))
    secondary_entries, secondary_count = read_metatiles(str(secondary_dir / "metatiles.bin"))
    palettes, warnings = palette_set(primary_dir, secondary_dir, family)

    columns = 16
    records_count = primary_count + secondary_count
    rows = math.ceil(records_count / columns)
    atlas = Image.new("RGBA", (columns * METATILE_SIZE, rows * METATILE_SIZE), (0, 0, 0, 0))

    slot = 0
    for local_id in range(primary_count):
        tile = render_metatile(family, primary_tiles, secondary_tiles, palettes, primary_entries, local_id)
        atlas.alpha_composite(tile, ((slot % columns) * METATILE_SIZE, (slot // columns) * METATILE_SIZE))
        slot += 1
    for local_id in range(secondary_count):
        tile = render_metatile(family, primary_tiles, secondary_tiles, palettes, secondary_entries, local_id)
        atlas.alpha_composite(tile, ((slot % columns) * METATILE_SIZE, (slot // columns) * METATILE_SIZE))
        slot += 1

    family_dir = out_root / family.id
    family_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{primary_dir.name}--{secondary_dir.name}.png"
    atlas_path = family_dir / filename
    atlas.save(atlas_path, optimize=True)

    primary_attrs = read_attributes(primary_dir / "metatile_attributes.bin", family, primary_count)
    secondary_attrs = read_attributes(secondary_dir / "metatile_attributes.bin", family, secondary_count)

    return {
        "id": pack_id(family, primary_dir, secondary_dir),
        "family": family.id,
        "familyLabel": family.label,
        "native": family.native,
        "compatibility": "native" if family.native else "reference",
        "sourceRepo": family.repo,
        "sourceRevision": revision,
        "primary": primary_symbol,
        "secondary": secondary_symbol,
        "primaryDirectory": primary_dir.name,
        "secondaryDirectory": secondary_dir.name,
        "primaryTileLimit": family.primary_tile_limit,
        "primaryMetatileLimit": family.primary_metatile_limit,
        "primaryPaletteCount": family.primary_palette_count,
        "totalPaletteCount": family.total_palette_count,
        "primaryCount": primary_count,
        "secondaryCount": secondary_count,
        "tileSize": METATILE_SIZE,
        "columns": columns,
        "width": atlas.width,
        "height": atlas.height,
        "atlasUrl": f"/gba/generated/{family.id}/{filename}",
        "primaryAttributes": primary_attrs,
        "secondaryAttributes": secondary_attrs,
        "maps": sorted(set(maps)),
        "warnings": warnings,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="public/gba/generated")
    parser.add_argument("--catalog", default="public/gba/catalog.json")
    args = parser.parse_args()

    output = Path(args.output)
    catalog_path = Path(args.catalog)
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True, exist_ok=True)
    catalog_path.parent.mkdir(parents=True, exist_ok=True)

    packs: list[dict] = []
    unresolved: list[str] = []
    revisions: dict[str, str] = {}

    with tempfile.TemporaryDirectory(prefix="arauna-gba-") as tmp:
        tmp_root = Path(tmp)
        for family in FAMILIES:
            print(f"==> {family.label}", flush=True)
            repo, revision = clone_repo(family, tmp_root)
            revisions[family.id] = revision
            primary_index = directory_index(repo, "primary")
            secondary_index = directory_index(repo, "secondary")
            pairs = unique_layout_pairs(repo / "data" / "layouts" / "layouts.json")
            for index, pair in enumerate(pairs, start=1):
                primary_dir = resolve_tileset(primary_index, pair["primary"])
                secondary_dir = resolve_tileset(secondary_index, pair["secondary"])
                if not primary_dir or not secondary_dir:
                    unresolved.append(f"{family.id}: {pair['primary']} + {pair['secondary']}")
                    continue
                print(f"  [{index}/{len(pairs)}] {pair['primary']} + {pair['secondary']}", flush=True)
                packs.append(
                    build_pack(
                        repo,
                        output,
                        family,
                        revision,
                        pair["primary"],
                        pair["secondary"],
                        primary_dir,
                        secondary_dir,
                        pair["maps"],
                    )
                )

    default_id = "emerald:general:petalburg"
    if not any(pack["id"] == default_id for pack in packs):
        raise RuntimeError(f"Required default pack {default_id} was not generated")

    catalog = {
        "format": "arauna-gba-tileset-catalog-v1",
        "generatedFrom": "pret Gen III decomps",
        "defaultPackId": default_id,
        "families": [
            {
                "id": family.id,
                "label": family.label,
                "sourceRepo": family.repo,
                "revision": revisions.get(family.id),
                "native": family.native,
                "primaryTileLimit": family.primary_tile_limit,
                "primaryMetatileLimit": family.primary_metatile_limit,
                "primaryPaletteCount": family.primary_palette_count,
                "totalPaletteCount": family.total_palette_count,
            }
            for family in FAMILIES
        ],
        "packs": sorted(packs, key=lambda item: (item["family"], item["primary"], item["secondary"])),
        "unresolvedPairs": unresolved,
    }
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Generated {len(packs)} real tileset packs; unresolved={len(unresolved)}")
    if unresolved:
        print("Unresolved pairs:")
        for item in unresolved:
            print(f"  - {item}")


if __name__ == "__main__":
    main()
