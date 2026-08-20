const SECONDARY_BY_LAYOUT: Record<string, string> = {
  LAYOUT_PETALBURG_CITY: "gTileset_Petalburg",
  LAYOUT_SLATEPORT_CITY: "gTileset_Slateport",
  LAYOUT_MAUVILLE_CITY: "gTileset_Mauville",
  LAYOUT_RUSTBORO_CITY: "gTileset_Rustboro",
  LAYOUT_FORTREE_CITY: "gTileset_Fortree",
  LAYOUT_LILYCOVE_CITY: "gTileset_Lilycove",
  LAYOUT_MOSSDEEP_CITY: "gTileset_Mossdeep",
  LAYOUT_SOOTOPOLIS_CITY: "gTileset_Sootopolis",
  LAYOUT_EVER_GRANDE_CITY: "gTileset_EverGrande",
  LAYOUT_LITTLEROOT_TOWN: "gTileset_Petalburg",
  LAYOUT_OLDALE_TOWN: "gTileset_Petalburg",
  LAYOUT_DEWFORD_TOWN: "gTileset_Dewford",
  LAYOUT_LAVARIDGE_TOWN: "gTileset_Lavaridge",
  LAYOUT_FALLARBOR_TOWN: "gTileset_Fallarbor",
  LAYOUT_VERDANTURF_TOWN: "gTileset_Mauville",
  LAYOUT_PACIFIDLOG_TOWN: "gTileset_Pacifidlog",

  LAYOUT_ROUTE101: "gTileset_Petalburg",
  LAYOUT_ROUTE102: "gTileset_Petalburg",
  LAYOUT_ROUTE103: "gTileset_Petalburg",
  LAYOUT_ROUTE104: "gTileset_Rustboro",
  LAYOUT_ROUTE105: "gTileset_Dewford",
  LAYOUT_ROUTE106: "gTileset_Dewford",
  LAYOUT_ROUTE107: "gTileset_Dewford",
  LAYOUT_ROUTE108: "gTileset_Slateport",
  LAYOUT_ROUTE109: "gTileset_Slateport",
  LAYOUT_ROUTE110: "gTileset_Mauville",
  LAYOUT_ROUTE111: "gTileset_Mauville",
  LAYOUT_ROUTE112: "gTileset_Lavaridge",
  LAYOUT_ROUTE113: "gTileset_Fallarbor",
  LAYOUT_ROUTE114: "gTileset_Fallarbor",
  LAYOUT_ROUTE115: "gTileset_Fallarbor",
  LAYOUT_ROUTE116: "gTileset_Rustboro",
  LAYOUT_ROUTE117: "gTileset_Mauville",
  LAYOUT_ROUTE118: "gTileset_Mauville",
  LAYOUT_ROUTE119: "gTileset_Fortree",
  LAYOUT_ROUTE120: "gTileset_Fortree",
};

export function secondaryTilesetForEmeraldLayout(layoutId: string | null | undefined) {
  if (!layoutId) return undefined;
  return SECONDARY_BY_LAYOUT[layoutId.trim().toUpperCase()];
}
