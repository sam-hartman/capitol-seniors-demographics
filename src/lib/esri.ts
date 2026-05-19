// ESRI ArcGIS GeoEnrichment adapter.
//
// Burns ~11 credits per call (one analysisVariables call returns ALL rings
// in one response, but each variable × each study area = 1 credit).
//   - 3 variables × 3 rings = 9 credits ← KeyUSFacts only
//   - +2 vars from incomebyage × 3 rings = +6
//   - +6 vars from Age × 3 rings = +18
//   Total ~33 credits per enrich call.
//
// We cache responses by (lat, lon, rings) tuple to avoid double-charging.

import type { DemographicsResult, EsriExtras, RingMetrics } from "./census";

const ENRICH_URL =
  "https://geoenrich.arcgis.com/arcgis/rest/services/World/geoenrichmentserver/Geoenrichment/enrich";

// ESRI variable IDs — verified via dataCollections metadata.
// ~29 vars × 3 rings = ~87 credits per call. Cached 24h.
const ANALYSIS_VARS = [
  // KeyUSFacts — current-year Esri estimates
  "KeyUSFacts.TOTPOP_CY",
  "KeyUSFacts.MEDHINC_CY",
  "KeyUSFacts.MEDVAL_CY",
  // 5-year forecasts (2030)
  "KeyUSFacts.TOTPOP_FY",
  "KeyUSFacts.POPGRWCYFY",
  "KeyUSFacts.MHIGRWCYFY",
  // Total caregivers 45-64
  "incomebyage.IA45BASECY",
  "incomebyage.IA55BASECY",
  // Income-qualified caregivers 45-64 (HH income >=$75K)
  "incomebyage.A45I75_CY",
  "incomebyage.A45I100_CY",
  "incomebyage.A45I150_CY",
  "incomebyage.A45I200_CY",
  "incomebyage.A55I75_CY",
  "incomebyage.A55I100_CY",
  "incomebyage.A55I150_CY",
  "incomebyage.A55I200_CY",
  // Age — total seniors 75+
  "Age.MALE75",
  "Age.MALE80",
  "Age.MALE85",
  "Age.FEM75",
  "Age.FEM80",
  "Age.FEM85",
  // Income-qualified senior HHs 75+ (HH income >=$50K; industry IL threshold)
  "incomebyage.A75I50_CY",
  "incomebyage.A75I75_CY",
  "incomebyage.A75I100_CY",
  "incomebyage.A75I150_CY",
  "incomebyage.A75I200_CY",
  // Tapestry
  "TapestryHouseholds.THHSNAME",
  "TapestryHouseholds.THHSCODE",
];

// Server-side cache, lifetime = process lifetime + Next.js revalidate.
const memCache = new Map<
  string,
  { result: DemographicsResult; expiresAt: number }
>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cacheKey(lat: number, lon: number, rings: number[]): string {
  return `${lat.toFixed(5)}_${lon.toFixed(5)}_${rings.join(",")}`;
}

interface EnrichResponse {
  results?: Array<{
    value?: {
      FeatureSet?: Array<{
        features?: Array<{
          attributes: Record<string, number | string | null>;
        }>;
      }>;
    };
    error?: { code: number; message: string };
  }>;
  error?: { code: number; message: string };
}

function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function maybeNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export class EsriCreditError extends Error {
  constructor(public code: number, message: string) {
    super(message);
    this.name = "EsriCreditError";
  }
}

export async function computeDemographicsViaEsri(
  center: { lat: number; lon: number },
  ringMiles: number[]
): Promise<DemographicsResult> {
  const apiKey = process.env.ESRI_API_KEY;
  if (!apiKey) throw new Error("ESRI_API_KEY not configured");

  const sortedRings = [...ringMiles].sort((a, b) => a - b);
  const key = cacheKey(center.lat, center.lon, sortedRings);

  // Cache hit — no credits burned.
  const cached = memCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const studyAreas = [
    {
      geometry: { x: center.lon, y: center.lat },
      areaType: "RingBuffer",
      bufferUnits: "esriMiles",
      bufferRadii: sortedRings,
    },
  ];

  const body = new URLSearchParams({
    studyAreas: JSON.stringify(studyAreas),
    analysisVariables: JSON.stringify(ANALYSIS_VARS),
    f: "json",
    token: apiKey,
  });

  const res = await fetch(ENRICH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`ESRI HTTP ${res.status}`);
  }

  const data = (await res.json()) as EnrichResponse;
  if (data.error) {
    throw new EsriCreditError(data.error.code, data.error.message);
  }
  if (data.results?.[0]?.error) {
    const e = data.results[0].error!;
    throw new EsriCreditError(e.code, e.message);
  }

  const features = data.results?.[0]?.value?.FeatureSet?.[0]?.features ?? [];
  if (features.length === 0) {
    throw new Error("ESRI returned no features");
  }

  // Features come back in the same order as bufferRadii (smallest first).
  const rings: RingMetrics[] = sortedRings.map((radius, i) => {
    const a = features[i]?.attributes ?? {};
    return {
      radiusMiles: radius,
      tractCount: 0,
      totalPopulation: Math.round(num(a.TOTPOP_CY)),
      totalHouseholds45to64: Math.round(
        num(a.IA45BASECY) + num(a.IA55BASECY)
      ),
      totalSeniors75plus: Math.round(
        num(a.MALE75) +
          num(a.MALE80) +
          num(a.MALE85) +
          num(a.FEM75) +
          num(a.FEM80) +
          num(a.FEM85)
      ),
      medianHomeValue: maybeNum(a.MEDVAL_CY),
      medianHouseholdIncome: maybeNum(a.MEDHINC_CY),
    };
  });

  const esriExtras: EsriExtras[] = sortedRings.map((_, i) => {
    const a = features[i]?.attributes ?? {};
    const segName = typeof a.THHSNAME === "string" ? a.THHSNAME : null;
    const segCode = typeof a.THHSCODE === "string" ? a.THHSCODE : null;
    const qualCaregivers =
      num(a.A45I75_CY) +
      num(a.A45I100_CY) +
      num(a.A45I150_CY) +
      num(a.A45I200_CY) +
      num(a.A55I75_CY) +
      num(a.A55I100_CY) +
      num(a.A55I150_CY) +
      num(a.A55I200_CY);
    const qualSeniors =
      num(a.A75I50_CY) +
      num(a.A75I75_CY) +
      num(a.A75I100_CY) +
      num(a.A75I150_CY) +
      num(a.A75I200_CY);
    return {
      population2030: a.TOTPOP_FY != null ? Math.round(num(a.TOTPOP_FY)) : null,
      popGrowthPct: a.POPGRWCYFY != null ? Number(a.POPGRWCYFY) : null,
      incomeGrowthPct: a.MHIGRWCYFY != null ? Number(a.MHIGRWCYFY) : null,
      tapestrySegmentName: segName && segName.trim() ? segName : null,
      tapestrySegmentCode: segCode && segCode.trim() ? segCode : null,
      qualifiedCaregivers45to64: qualCaregivers > 0 ? Math.round(qualCaregivers) : null,
      qualifiedSeniorHH75plus: qualSeniors > 0 ? Math.round(qualSeniors) : null,
    };
  });

  const result: DemographicsResult = {
    rings,
    meta: {
      acsRelease: "Esri GeoEnrichment (2025 current-year + 2030 forecasts)",
      acsYears: "2025 estimates + 5-yr forecast",
      tractsConsidered: 0,
      note: "ESRI GeoEnrichment with true areal apportionment (tracts contribute proportionally to overlap area). Variables are current-year Esri estimates with proprietary forecasts and Tapestry psychographic segmentation. More accurate than tract-centroid aggregation for ring boundary effects.",
    },
    esriExtras,
  };

  memCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}
