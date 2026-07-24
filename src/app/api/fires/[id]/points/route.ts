import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { hotspotPoints } from "@/db/schema";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { convexHull } from "@/lib/clustering";

export const revalidate = 60;

const paramsSchema = z.object({ id: z.uuid() });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { allowed } = await checkRateLimit(`fires-points:${clientIp(req)}`);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid fire_event id" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(hotspotPoints)
    .where(eq(hotspotPoints.fireEventId, parsed.data.id));

  const pointFeatures = rows.map((point) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [point.lon, point.lat],
    },
    properties: {
      kind: "hotspot" as const,
      id: point.id,
      acqAt: point.acqAt.toISOString(),
      frp: point.frp,
      confidence: point.confidence,
      satellite: point.satellite,
    },
  }));

  // Own estimate only — a convex hull of the raw detections, not an
  // official burned-area perimeter (we wanted Copernicus EFFIS for that,
  // but its WFS service has been down for hours; see ADR-0005).
  const hull = convexHull(rows.map((p) => ({ lat: p.lat, lon: p.lon })));
  const perimeterFeature = hull.length >= 3
    ? [
        {
          type: "Feature" as const,
          geometry: { type: "Polygon" as const, coordinates: [[...hull, hull[0]]] },
          properties: { kind: "estimated_perimeter" as const },
        },
      ]
    : [];

  const geojson = {
    type: "FeatureCollection" as const,
    features: [...perimeterFeature, ...pointFeatures],
  };

  return NextResponse.json(geojson, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
