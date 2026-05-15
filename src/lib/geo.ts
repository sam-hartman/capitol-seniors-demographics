export const MILES_PER_DEGREE_LAT = 69.0;

export function milesPerDegreeLon(lat: number): number {
  return Math.cos((lat * Math.PI) / 180) * 69.172;
}

export function haversineMiles(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const R = 3958.7613; // Earth radius (miles)
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bboxAroundPoint(
  center: { lat: number; lon: number },
  radiusMiles: number
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const dLat = radiusMiles / MILES_PER_DEGREE_LAT;
  const dLon = radiusMiles / milesPerDegreeLon(center.lat);
  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLon: center.lon - dLon,
    maxLon: center.lon + dLon,
  };
}
