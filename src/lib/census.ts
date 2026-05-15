import { bboxAroundPoint, haversineMiles } from "./geo";

const USER_AGENT = "CSH-Demographics/1.0 (sam-hartman; capitol-seniors-housing-tool)";

// Census Tracts (full attributes — Generalized_ACS folders strip fields)
const TIGERWEB_TRACTS =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/0/query";

const ACS_YEAR = 2023;
const ACS_BASE = `https://api.census.gov/data/${ACS_YEAR}/acs/acs5`;

export const DEFAULT_RING_MILES = [1, 3, 5] as const;

const ACS_VARS = [
  "B25077_001E", // Median home value (owner-occupied)
  "B19013_001E", // Median household income
  "B01003_001E", // Total population
  // Households 45-64 (tenure by age of householder)
  "B25007_006E", // owner 45-54
  "B25007_007E", // owner 55-64
  "B25007_016E", // renter 45-54
  "B25007_017E", // renter 55-64
  // Population 75+ (sex by age)
  "B01001_023E", // male 75-79
  "B01001_024E", // male 80-84
  "B01001_025E", // male 85+
  "B01001_047E", // female 75-79
  "B01001_048E", // female 80-84
  "B01001_049E", // female 85+
];

interface TigerTract {
  geoid: string;
  state: string;
  county: string;
  tract: string;
  centLat: number;
  centLon: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Fetch ${res.status} for ${url}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

async function queryTracts(
  center: { lat: number; lon: number },
  radiusMiles: number
): Promise<TigerTract[]> {
  const bbox = bboxAroundPoint(center, radiusMiles);
  const params = new URLSearchParams({
    where: "1=1",
    geometry: JSON.stringify({
      xmin: bbox.minLon,
      ymin: bbox.minLat,
      xmax: bbox.maxLon,
      ymax: bbox.maxLat,
      spatialReference: { wkid: 4326 },
    }),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "GEOID,STATE,COUNTY,TRACT,CENTLAT,CENTLON",
    returnGeometry: "false",
    f: "json",
  });

  type ArcGisResp = {
    features?: Array<{
      attributes: {
        GEOID: string;
        STATE: string;
        COUNTY: string;
        TRACT: string;
        CENTLAT: string | number;
        CENTLON: string | number;
      };
    }>;
    error?: { code: number; message: string };
  };

  const data = await fetchJson<ArcGisResp>(`${TIGERWEB_TRACTS}?${params.toString()}`);
  if (data.error) {
    throw new Error(`TIGERweb error ${data.error.code}: ${data.error.message}`);
  }
  if (!data.features) {
    throw new Error("TIGERweb returned no features array");
  }
  return data.features.map((f) => ({
    geoid: f.attributes.GEOID,
    state: f.attributes.STATE,
    county: f.attributes.COUNTY,
    tract: f.attributes.TRACT,
    centLat: Number(f.attributes.CENTLAT),
    centLon: Number(f.attributes.CENTLON),
  }));
}

interface TractAcs {
  geoid: string;
  values: Record<string, number | null>;
}

async function fetchAcsForCounty(
  state: string,
  county: string
): Promise<TractAcs[]> {
  const apiKey = process.env.CENSUS_API_KEY;
  const keyParam = apiKey ? `&key=${apiKey}` : "";
  const url = `${ACS_BASE}?get=${ACS_VARS.join(",")}&for=tract:*&in=state:${state}+county:${county}${keyParam}`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate: 86400 },
    redirect: "manual",
  });

  if (res.status === 302) {
    throw new Error(
      "Census API key required. Sign up free at https://api.census.gov/data/key_signup.html and set CENSUS_API_KEY in Vercel env vars."
    );
  }
  if (!res.ok) {
    throw new Error(`Census ACS ${res.status}`);
  }

  const rows = (await res.json()) as string[][];
  if (!rows || rows.length < 2) return [];
  const headers = rows[0];
  const idx = (k: string) => headers.indexOf(k);
  const stateIdx = idx("state");
  const countyIdx = idx("county");
  const tractIdx = idx("tract");

  return rows.slice(1).map((row) => {
    const geoid = `${row[stateIdx]}${row[countyIdx]}${row[tractIdx]}`;
    const values: Record<string, number | null> = {};
    for (const v of ACS_VARS) {
      const raw = row[idx(v)];
      const num = raw == null ? null : Number(raw);
      values[v] = num != null && num < 0 ? null : num;
    }
    return { geoid, values };
  });
}

export interface RingMetrics {
  radiusMiles: number;
  tractCount: number;
  totalPopulation: number;
  totalHouseholds45to64: number;
  totalSeniors75plus: number;
  medianHomeValue: number | null;
  medianHouseholdIncome: number | null;
}

export interface DemographicsResult {
  rings: RingMetrics[];
  meta: {
    acsYear: number;
    acsDataset: string;
    tractsConsidered: number;
    note: string;
  };
}

function popWeightedMedian(
  rows: Array<{ value: number | null; weight: number }>
): number | null {
  let num = 0;
  let den = 0;
  for (const r of rows) {
    if (r.value == null || r.weight <= 0) continue;
    num += r.value * r.weight;
    den += r.weight;
  }
  if (den === 0) return null;
  return Math.round(num / den);
}

export async function computeDemographics(
  center: { lat: number; lon: number },
  ringMiles: number[] = [...DEFAULT_RING_MILES]
): Promise<DemographicsResult> {
  const sortedRings = [...ringMiles].sort((a, b) => a - b);
  const maxRadius = Math.max(...sortedRings);
  const tracts = await queryTracts(center, maxRadius + 1.5);

  const tractsWithDist = tracts.map((t) => ({
    ...t,
    distance: haversineMiles(center, { lat: t.centLat, lon: t.centLon }),
  }));

  const counties = new Set(
    tractsWithDist
      .filter((t) => t.distance <= maxRadius + 0.5)
      .map((t) => `${t.state}|${t.county}`)
  );

  const acsByCounty = await Promise.all(
    Array.from(counties).map(async (key) => {
      const [state, county] = key.split("|");
      return { key, rows: await fetchAcsForCounty(state, county) };
    })
  );

  const acsByGeoid = new Map<string, TractAcs>();
  for (const c of acsByCounty) {
    for (const row of c.rows) acsByGeoid.set(row.geoid, row);
  }

  const rings: RingMetrics[] = sortedRings.map((radius) => {
    const inside = tractsWithDist.filter((t) => t.distance <= radius);

    let totalPopulation = 0;
    let totalHouseholds45to64 = 0;
    let totalSeniors75plus = 0;
    const homeValueRows: Array<{ value: number | null; weight: number }> = [];
    const incomeRows: Array<{ value: number | null; weight: number }> = [];

    for (const t of inside) {
      const acs = acsByGeoid.get(t.geoid);
      if (!acs) continue;
      const v = acs.values;

      const pop = v.B01003_001E ?? 0;
      totalPopulation += pop;

      const hh4564 =
        (v.B25007_006E ?? 0) +
        (v.B25007_007E ?? 0) +
        (v.B25007_016E ?? 0) +
        (v.B25007_017E ?? 0);
      totalHouseholds45to64 += hh4564;

      const seniors75 =
        (v.B01001_023E ?? 0) +
        (v.B01001_024E ?? 0) +
        (v.B01001_025E ?? 0) +
        (v.B01001_047E ?? 0) +
        (v.B01001_048E ?? 0) +
        (v.B01001_049E ?? 0);
      totalSeniors75plus += seniors75;

      homeValueRows.push({ value: v.B25077_001E, weight: pop });
      incomeRows.push({ value: v.B19013_001E, weight: pop });
    }

    return {
      radiusMiles: radius,
      tractCount: inside.length,
      totalPopulation: Math.round(totalPopulation),
      totalHouseholds45to64: Math.round(totalHouseholds45to64),
      totalSeniors75plus: Math.round(totalSeniors75plus),
      medianHomeValue: popWeightedMedian(homeValueRows),
      medianHouseholdIncome: popWeightedMedian(incomeRows),
    };
  });

  return {
    rings,
    meta: {
      acsYear: ACS_YEAR,
      acsDataset: "ACS 5-year",
      tractsConsidered: tractsWithDist.length,
      note: "Tract-level approximation: tracts whose centroid falls within each ring are aggregated. Medians are population-weighted averages of tract medians (true ring medians require record-level data).",
    },
  };
}
