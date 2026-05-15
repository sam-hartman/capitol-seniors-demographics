# Capitol Seniors Housing — Site Demographics Studio

Address-based demographic intelligence for senior housing site selection. Drop a U.S. address and get five indicators across 1, 3, and 5 mile rings.

## Indicators

- Median Home Value (owner-occupied)
- Median Household Income
- Total Population
- Total Households Age 45–64
- Total Seniors Age 75+

## Data Sources

- **Geocoding:** OpenStreetMap Nominatim (no key)
- **Demographics:** US Census Bureau, ACS 5-Year Estimates (no key required for low-volume use)
- **Tract geometry:** Census TIGERweb GeoServices REST API
- **Map tiles:** CARTO Voyager basemap on OpenStreetMap data

## Methodology

For each address, the app pulls Census tracts whose centroid falls within the maximum ring (5 mi + buffer) via TIGERweb, then bulk-fetches ACS 5-Year tract data for the parent counties. Tracts inside each ring are aggregated:

- **Counts** (population, households, seniors): summed across in-ring tracts.
- **Medians** (home value, income): population-weighted average of tract medians.

This is a tract-centroid approximation — true ring medians require record-level data. For production-grade CRE analysis, the upgrade path is **ESRI ArcGIS GeoEnrichment** (true ring-based aggregation, ~$0.10–0.40/call).

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind v4
- Leaflet for mapping
- Lucide icons
- Deployed on Vercel

## Local Development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Features

- Address search with autocomplete (Nominatim, US-restricted)
- Live map with concentric 1/3/5 mile rings
- Branded stats panel
- Built-in tutorial walkthrough (`?` button, top-right)
- Print-to-PDF report
- URL state (shareable links preserve the active address)
