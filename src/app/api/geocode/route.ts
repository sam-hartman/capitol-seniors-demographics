import { NextRequest } from "next/server";

const USER_AGENT = "CSH-Demographics/1.0 (sam-hartman; capitol-seniors-housing-tool)";

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  boundingbox?: [string, string, string, string];
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.trim().length < 3) {
    return Response.json(
      { success: false, error: "Query must be at least 3 characters" },
      { status: 400 }
    );
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "us");

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return Response.json(
        { success: false, error: `Geocoder returned ${res.status}` },
        { status: 502 }
      );
    }
    const results = (await res.json()) as NominatimResult[];
    if (results.length === 0) {
      return Response.json(
        { success: false, error: "Address not found" },
        { status: 404 }
      );
    }
    const data = results.map((r) => ({
      lat: Number(r.lat),
      lon: Number(r.lon),
      label: r.display_name,
    }));
    return Response.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { success: false, error: `Geocoding failed: ${message}` },
      { status: 500 }
    );
  }
}
