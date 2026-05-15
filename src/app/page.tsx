import { DemographicsApp } from "@/components/DemographicsApp";

interface Props {
  searchParams: Promise<{ addr?: string; lat?: string; lon?: string }>;
}

export default async function Home({ searchParams }: Props) {
  const sp = await searchParams;
  const lat = sp.lat ? Number(sp.lat) : undefined;
  const lon = sp.lon ? Number(sp.lon) : undefined;
  return (
    <DemographicsApp
      initialAddress={sp.addr}
      initialLat={Number.isFinite(lat) ? lat : undefined}
      initialLon={Number.isFinite(lon) ? lon : undefined}
    />
  );
}
