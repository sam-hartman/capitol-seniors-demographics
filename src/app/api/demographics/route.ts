import { NextRequest } from "next/server";
import { computeDemographics, DEFAULT_RING_MILES } from "@/lib/census";
import { computeDemographicsViaEsri } from "@/lib/esri";

const RING_MIN = 0.25;
const RING_MAX = 25;

function parseRings(raw: string | null): number[] {
  if (!raw) return [...DEFAULT_RING_MILES];
  const parsed = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= RING_MIN && n <= RING_MAX);
  return parsed.length > 0 ? parsed : [...DEFAULT_RING_MILES];
}

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  const rings = parseRings(request.nextUrl.searchParams.get("rings"));
  const source = request.nextUrl.searchParams.get("source");

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json(
      { success: false, error: "lat and lon are required numeric query params" },
      { status: 400 }
    );
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return Response.json(
      { success: false, error: "lat/lon out of range" },
      { status: 400 }
    );
  }

  // ESRI is opt-in (?source=esri) — burns ~33 credits unless cached.
  // Default remains Census (free).
  if (source === "esri") {
    try {
      const result = await computeDemographicsViaEsri({ lat, lon }, rings);
      return Response.json({ success: true, data: result, source: "esri" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      // Fall through to Census on ESRI failure rather than block the user.
      try {
        const fallback = await computeDemographics({ lat, lon }, rings);
        return Response.json({
          success: true,
          data: fallback,
          source: "census",
          esriError: message,
        });
      } catch (fbErr) {
        return Response.json(
          { success: false, error: `Both backends failed: ${message}` },
          { status: 500 }
        );
      }
    }
  }

  try {
    const result = await computeDemographics({ lat, lon }, rings);
    return Response.json({ success: true, data: result, source: "census" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
