import { NextRequest } from "next/server";

const USER_AGENT = "CSH-Demographics/1.0 (sam-hartman; capitol-seniors-housing-tool)";

interface NominatimReverse {
  lat?: string;
  lon?: string;
  display_name?: string;
  error?: string;
}

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json(
      { success: false, error: "lat and lon are required numeric params" },
      { status: 400 }
    );
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("format", "json");
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "0");

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      return Response.json(
        { success: false, error: `Reverse geocoder ${res.status}` },
        { status: 502 }
      );
    }
    const data = (await res.json()) as NominatimReverse;
    if (data.error || !data.display_name) {
      return Response.json({
        success: true,
        data: {
          lat,
          lon,
          label: `Custom point · ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        },
      });
    }
    return Response.json({
      success: true,
      data: { lat, lon, label: data.display_name },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { success: false, error: `Reverse geocoding failed: ${message}` },
      { status: 500 }
    );
  }
}
