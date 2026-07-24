import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { fireEvents, hotspotPoints } from "@/db/schema";
import { fetchFirmsHotspots, isLowConfidence } from "@/lib/firms";
import { clusterHotspots, type ClusterSummary } from "@/lib/clustering";
import {
  computeLevel,
  isStale,
  matchClustersToEvents,
  type ExistingEventRef,
} from "@/lib/matching";
import { reverseGeocode } from "@/lib/geocode";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function upsertCluster(
  cluster: ClusterSummary,
  matchedEventId: string | null,
  previousPointCount: number | undefined,
): Promise<string> {
  const level = computeLevel(cluster, previousPointCount);

  if (matchedEventId) {
    await db
      .update(fireEvents)
      .set({
        centroidLat: cluster.centroidLat,
        centroidLon: cluster.centroidLon,
        status: "active",
        level,
        pointCount: cluster.pointCount,
        maxFrp: cluster.maxFrp,
        sumFrp: cluster.sumFrp,
        estHectares: cluster.estHectares,
        lastDetectedAt: cluster.lastSeen,
        updatedAt: new Date(),
      })
      .where(eq(fireEvents.id, matchedEventId));
    return matchedEventId;
  }

  const [inserted] = await db
    .insert(fireEvents)
    .values({
      centroidLat: cluster.centroidLat,
      centroidLon: cluster.centroidLon,
      status: "active",
      level,
      pointCount: cluster.pointCount,
      maxFrp: cluster.maxFrp,
      sumFrp: cluster.sumFrp,
      estHectares: cluster.estHectares,
      firstDetectedAt: cluster.firstSeen,
      lastDetectedAt: cluster.lastSeen,
    })
    .returning({ id: fireEvents.id });

  return inserted.id;
}

async function insertNewPoints(
  fireEventId: string,
  cluster: ClusterSummary,
  sinceExclusive: Date | null,
) {
  const newPoints = cluster.points.filter(
    (p) => !sinceExclusive || p.acqAt.getTime() > sinceExclusive.getTime(),
  );
  if (newPoints.length === 0) return;

  await db.insert(hotspotPoints).values(
    newPoints.map((p) => ({
      fireEventId,
      lat: p.lat,
      lon: p.lon,
      acqAt: p.acqAt,
      frp: p.frp,
    })),
  );
}

// Vercel Cron Jobs trigger via GET; POST is kept for manual/webhook runs.
export async function GET(req: NextRequest) {
  return runIngest(req);
}

export async function POST(req: NextRequest) {
  return runIngest(req);
}

async function runIngest(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const firmsMapKey = process.env.FIRMS_MAP_KEY;
  const nominatimUserAgent = process.env.NOMINATIM_USER_AGENT;
  if (!firmsMapKey) {
    return NextResponse.json(
      { error: "FIRMS_MAP_KEY is not configured" },
      { status: 500 },
    );
  }

  const rawHotspots = await fetchFirmsHotspots(firmsMapKey);
  const filtered = rawHotspots.filter((p) => !isLowConfidence(p.confidence));
  const clusters = clusterHotspots(
    filtered.map((p) => ({
      lat: p.lat,
      lon: p.lon,
      frp: p.frp,
      acqAt: p.acqAt,
    })),
  );

  const activeEvents = await db
    .select({
      id: fireEvents.id,
      centroidLat: fireEvents.centroidLat,
      centroidLon: fireEvents.centroidLon,
      pointCount: fireEvents.pointCount,
      lastDetectedAt: fireEvents.lastDetectedAt,
    })
    .from(fireEvents)
    .where(eq(fireEvents.status, "active"));

  const existingRefs: ExistingEventRef[] = activeEvents.map((e) => ({
    id: e.id,
    centroidLat: e.centroidLat,
    centroidLon: e.centroidLon,
    pointCount: e.pointCount,
  }));

  const matches = matchClustersToEvents(clusters, existingRefs);
  const claimedIds = new Set(
    matches.map((m) => m.matchedEventId).filter((id): id is string => !!id),
  );

  const touchedEventIds: string[] = [];
  for (const match of matches) {
    const previous = activeEvents.find((e) => e.id === match.matchedEventId);
    const eventId = await upsertCluster(
      match.cluster,
      match.matchedEventId,
      previous?.pointCount,
    );
    await insertNewPoints(
      eventId,
      match.cluster,
      previous?.lastDetectedAt ?? null,
    );
    touchedEventIds.push(eventId);
  }

  // Lazy reverse geocoding — only events that still have no name, throttled
  // to 1 req/sec inside reverseGeocode() per Nominatim's usage policy.
  let geocoded = 0;
  if (nominatimUserAgent && touchedEventIds.length > 0) {
    const unnamed = await db
      .select({
        id: fireEvents.id,
        centroidLat: fireEvents.centroidLat,
        centroidLon: fireEvents.centroidLon,
      })
      .from(fireEvents)
      .where(and(isNull(fireEvents.name), eq(fireEvents.status, "active")));

    for (const event of unnamed) {
      const place = await reverseGeocode(
        event.centroidLat,
        event.centroidLon,
        nominatimUserAgent,
      );
      await db
        .update(fireEvents)
        .set({
          name: place.name,
          municipality: place.municipality,
          province: place.province,
        })
        .where(eq(fireEvents.id, event.id));
      geocoded++;
    }
  }

  // Auto-close: active events that got no cluster this run and haven't
  // received new points in 24h (PROMPT_INICIAL.md §3.2.5).
  let closed = 0;
  for (const event of activeEvents) {
    if (claimedIds.has(event.id)) continue;
    if (!isStale(event.lastDetectedAt)) continue;
    await db
      .update(fireEvents)
      .set({ status: "inactive", level: 0, updatedAt: new Date() })
      .where(eq(fireEvents.id, event.id));
    closed++;
  }

  return NextResponse.json({
    hotspotsFetched: rawHotspots.length,
    hotspotsAfterConfidenceFilter: filtered.length,
    clustersDetected: clusters.length,
    eventsUpdated: matches.filter((m) => m.matchedEventId).length,
    eventsCreated: matches.filter((m) => !m.matchedEventId).length,
    eventsClosed: closed,
    eventsGeocoded: geocoded,
  });
}
