import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { fireEvents } from "@/db/schema";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

// Public, read-only, no auth — cache aggressively so a traffic spike can't
// hammer Neon directly (see .claude/agents/seguridad.md). Cache-Control
// covers repeat requests for the same URL; checkRateLimit below covers the
// case where a client varies the query string to dodge that cache.
export const revalidate = 60;

const querySchema = z.object({
  status: z.enum(["active", "all"]).default("active"),
});

function describe(event: typeof fireEvents.$inferSelect): string {
  const parts = [`${event.pointCount} focos activos`];
  if (event.maxFrp != null) parts.push(`FRP máx ${event.maxFrp.toFixed(1)} MW`);
  parts.push(`detectado desde ${event.firstDetectedAt.toISOString()}`);
  return parts.join(" · ");
}

export async function GET(req: NextRequest) {
  const { allowed } = await checkRateLimit(`fires:${clientIp(req)}`);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const parsed = querySchema.safeParse({
    status: req.nextUrl.searchParams.get("status") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query params", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const rows =
    parsed.data.status === "active"
      ? await db.select().from(fireEvents).where(eq(fireEvents.status, "active"))
      : await db.select().from(fireEvents);

  const geojson = {
    type: "FeatureCollection" as const,
    features: rows.map((event) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [event.centroidLon, event.centroidLat],
      },
      properties: {
        id: event.id,
        name: event.name,
        municipality: event.municipality,
        province: event.province,
        status: event.status,
        pointCount: event.pointCount,
        maxFrp: event.maxFrp,
        sumFrp: event.sumFrp,
        estHectares: event.estHectares,
        firstDetectedAt: event.firstDetectedAt.toISOString(),
        lastDetectedAt: event.lastDetectedAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
        desc: describe(event),
      },
    })),
  };

  return NextResponse.json(geojson, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
