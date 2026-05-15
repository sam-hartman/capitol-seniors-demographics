import { NextRequest } from "next/server";
import { computeDemographics } from "@/lib/census";

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json(
      { success: false, error: "lat and lon are required numeric query params" },
      { status: 400 }
    );
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return Response.json(
      { success: false, error: "lat/lon out of range" },
      { status: 400 }
    );
  }

  try {
    const result = await computeDemographics({ lat, lon });
    return Response.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { success: false, error: `Demographics computation failed: ${message}` },
      { status: 500 }
    );
  }
}
