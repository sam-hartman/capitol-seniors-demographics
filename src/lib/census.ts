import { bboxAroundPoint, haversineMiles } from "./geo";

const USER_AGENT = "CSH-Demographics/1.0 (sam-hartman; capitol-seniors-housing-tool)";

const TIGERWEB_TRACTS =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/0/query";

const CENSUS_REPORTER_BASE = "https://api.censusreporter.org/1.0/data/show/latest";

export const DEFAULT_RING_MILES = [1, 3, 5] as const;

// Census table IDs requested
const TABLES = ["B25077", "B19013", "B01003", "B25007", "B01001"] as const;

// Variable IDs we extract (Census Reporter format: no _E suffix, no underscore)
const VARS = {
  homeValue: "B25077001",
  income: "B19013001",
  population: "B01003001",
  // Households 45-64 (tenure by age of householder)
  hhOwn4554: "B25007006",
  hhOwn5564: "B25007007",
  hhRent4554: "B25007016",
  hhRent5564: "B25007017",
  // Population 75+ (sex by age)
  m7579: "B01001023",
  m8084: "B01001024",
  m85: "B01001025",
  f7579: "B01001047",
  f8084: "B01001048",
  f85: "B01001049",
} as const;

interface TigerTract {
  geoid: string;
  state: string;
  county: string;
  tract: string;
  centLat: number;
  centLon: number;
}

async function fetchJson<T>(url: string, revalidate = 86400): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Fetch ${res.status} for ${url}: ${body.slice(0, 300)}`);
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
    throw new Error(`TIGERweb ${data.error.code}: ${data.error.message}`);
  }
  if (!data.features) {
    throw new Error("TIGERweb returned no features");
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

interface CensusReporterResponse {
  data: Record<
    string,
    Record<string, { estimate: Record<string, number | null> }>
  >;
  release?: { id: string; name: string; years: string };
}

interface TractAcs {
  geoid: string;
  values: Record<string, number | null>;
  releaseName?: string;
  releaseYears?: string;
}

async function fetchAcsForCounty(
  state: string,
  county: string
): Promise<{ tracts: TractAcs[]; release?: { name: string; years: string } }> {
  // Census Reporter: all tracts in a county = "140|05000US{state}{county}"
  const geoIds = `140|05000US${state}${county}`;
  const url = `${CENSUS_REPORTER_BASE}?table_ids=${TABLES.join(",")}&geo_ids=${encodeURIComponent(geoIds)}`;
  const data = await fetchJson<CensusReporterResponse>(url);

  const release = data.release
    ? { name: data.release.name, years: data.release.years }
    : undefined;

  const tracts: TractAcs[] = Object.entries(data.data ?? {}).map(([geoIdKey, tables]) => {
    // geoIdKey: "14000US11001000201" → tract GEOID = "11001000201"
    const tractGeoid = geoIdKey.replace(/^14000US/, "");
    const values: Record<string, number | null> = {};
    for (const [tableId, table] of Object.entries(tables)) {
      void tableId;
      for (const [varKey, val] of Object.entries(table.estimate ?? {})) {
        const num = typeof val === "number" ? val : val == null ? null : Number(val);
        values[varKey] = Number.isFinite(num as number) && (num as number) >= 0 ? (num as number) : null;
      }
    }
    return { geoid: tractGeoid, values };
  });

  return { tracts, release };
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
    acsRelease: string;
    acsYears: string;
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
      return { key, ...(await fetchAcsForCounty(state, county)) };
    })
  );

  const acsByGeoid = new Map<string, TractAcs>();
  let release: { name: string; years: string } | undefined;
  for (const c of acsByCounty) {
    if (!release && c.release) release = c.release;
    for (const row of c.tracts) acsByGeoid.set(row.geoid, row);
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

      const pop = v[VARS.population] ?? 0;
      totalPopulation += pop;

      totalHouseholds45to64 +=
        (v[VARS.hhOwn4554] ?? 0) +
        (v[VARS.hhOwn5564] ?? 0) +
        (v[VARS.hhRent4554] ?? 0) +
        (v[VARS.hhRent5564] ?? 0);

      totalSeniors75plus +=
        (v[VARS.m7579] ?? 0) +
        (v[VARS.m8084] ?? 0) +
        (v[VARS.m85] ?? 0) +
        (v[VARS.f7579] ?? 0) +
        (v[VARS.f8084] ?? 0) +
        (v[VARS.f85] ?? 0);

      homeValueRows.push({ value: v[VARS.homeValue], weight: pop });
      incomeRows.push({ value: v[VARS.income], weight: pop });
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
      acsRelease: release?.name ?? "ACS 5-year",
      acsYears: release?.years ?? "",
      tractsConsidered: tractsWithDist.length,
      note: "Tract-level approximation: tracts whose centroid falls within each ring are aggregated. Medians are population-weighted averages of tract medians (true ring medians require record-level data).",
    },
  };
}
