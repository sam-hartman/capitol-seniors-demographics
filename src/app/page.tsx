import { DemographicsApp } from "@/components/DemographicsApp";

interface Props {
  searchParams: Promise<{
    addr?: string;
    lat?: string;
    lon?: string;
    rings?: string;
    source?: string;
  }>;
}

export default async function Home({ searchParams }: Props) {
  const sp = await searchParams;
  const lat = sp.lat ? Number(sp.lat) : undefined;
  const lon = sp.lon ? Number(sp.lon) : undefined;
  const rings = sp.rings
    ? sp.rings
        .split(",")
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0 && n <= 25)
    : undefined;
  return (
    <DemographicsApp
      initialAddress={sp.addr}
      initialLat={Number.isFinite(lat) ? lat : undefined}
      initialLon={Number.isFinite(lon) ? lon : undefined}
      initialRings={rings && rings.length === 3 ? rings : undefined}
      initialSource={sp.source === "esri" ? "esri" : "census"}
    />
  );
}
