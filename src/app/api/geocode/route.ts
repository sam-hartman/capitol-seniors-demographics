import { NextRequest } from "next/server";

const USER_AGENT = "CSH-Demographics/1.0 (sam-hartman; capitol-seniors-housing-tool)";

// Photon is OpenStreetMap-backed and built specifically for type-ahead.
// Free, no API key, returns reasonable results for partial queries
// (Nominatim by contrast wants the full address).
const PHOTON_URL = "https://photon.komoot.io/api";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

interface Hit {
  lat: number;
  lon: number;
  label: string;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_value?: string;
  };
}

function photonLabel(p: PhotonFeature["properties"]): string {
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const head = p.name && p.name !== p.street ? p.name : street || p.street || "";
  const cityState = [p.city, p.state].filter(Boolean).join(", ");
  if (head && cityState) return `${head} · ${cityState}`;
  if (head) return head;
  return cityState || "Unknown";
}

async function tryPhoton(q: string): Promise<Hit[]> {
  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "8");
  url.searchParams.set("lang", "en");
  // Bias toward US results.
  url.searchParams.set("lat", "39.5");
  url.searchParams.set("lon", "-98.35");

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  const json = (await res.json()) as { features?: PhotonFeature[] };
  const features = json.features ?? [];

  // Prefer US results when present.
  const us = features.filter((f) => f.properties.countrycode === "US");
  const pool = us.length > 0 ? us : features;

  return pool.map((f) => {
    const [lon, lat] = f.geometry.coordinates;
    return {
      lat,
      lon,
      label: photonLabel(f.properties),
    };
  });
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

async function tryNominatim(q: string): Promise<Hit[]> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "us");
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const results = (await res.json()) as NominatimResult[];
  return results.map((r) => ({
    lat: Number(r.lat),
    lon: Number(r.lon),
    label: r.display_name,
  }));
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.trim().length < 2) {
    return Response.json(
      { success: false, error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  try {
    let hits: Hit[] = [];
    try {
      hits = await tryPhoton(q);
    } catch {
      // Photon down or rate-limited — fall back to Nominatim.
      hits = await tryNominatim(q);
    }
    if (hits.length === 0) {
      // Photon returned nothing — try Nominatim before giving up.
      try {
        hits = await tryNominatim(q);
      } catch {
        // ignore
      }
    }
    if (hits.length === 0) {
      return Response.json(
        { success: false, error: "No matches found" },
        { status: 404 }
      );
    }
    return Response.json({ success: true, data: hits });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { success: false, error: `Geocoding failed: ${message}` },
      { status: 500 }
    );
  }
}
