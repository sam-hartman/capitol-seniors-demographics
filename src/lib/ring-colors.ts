// Single source of truth for ring colors.
// Three distinct hues: deep navy (innermost), warm gold (middle), deep teal (outer).
// Each used in three places: stats panel column dots, map ring strokes/fills,
// and the map legend below the map.

export const RING_COLORS = [
  { stroke: "#0f2540", fill: "rgba(15,37,64,0.16)", name: "navy" },
  { stroke: "#b8924a", fill: "rgba(184,146,74,0.18)", name: "gold" },
  { stroke: "#2d6a7a", fill: "rgba(45,106,122,0.16)", name: "teal" },
] as const;

export const RING_STROKES = RING_COLORS.map((c) => c.stroke);
export const RING_FILLS = RING_COLORS.map((c) => c.fill);
