import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
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
import { isSpain, reverseGeocode } from "@/lib/geocode";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function updateExistingEvent(
  eventId: string,
  cluster: ClusterSummary,
  previousPointCount: number | undefined,
): Promise<void> {
  await db
    .update(fireEvents)
    .set({
      centroidLat: cluster.centroidLat,
      centroidLon: cluster.centroidLon,
      status: "active",
      level: computeLevel(cluster, previousPointCount),
      pointCount: cluster.pointCount,
      maxFrp: cluster.maxFrp,
      sumFrp: cluster.sumFrp,
      estHectares: cluster.estHectares,
      lastDetectedAt: cluster.lastSeen,
      updatedAt: new Date(),
    })
    .where(eq(fireEvents.id, eventId));
}

/**
 * The FIRMS bbox (PROMPT_INICIAL.md §3.1) also catches northern Algeria and
 * Morocco. Geocode a brand-new cluster up front and only create a
 * fire_event if it's actually in Spain — otherwise skip it entirely.
 */
async function createEventIfSpain(
  cluster: ClusterSummary,
  nominatimUserAgent: string | undefined,
): Promise<{ eventId: string | null; skippedOutsideSpain: boolean }> {
  const place = nominatimUserAgent
    ? await reverseGeocode(cluster.centroidLat, cluster.centroidLon, nominatimUserAgent)
    : null;

  if (place && !isSpain(place)) {
    return { eventId: null, skippedOutsideSpain: true };
  }

  const [inserted] = await db
    .insert(fireEvents)
    .values({
      name: place?.name ?? null,
      municipality: place?.municipality ?? null,
      province: place?.province ?? null,
      centroidLat: cluster.centroidLat,
      centroidLon: cluster.centroidLon,
      status: "active",
      level: computeLevel(cluster, undefined),
      pointCount: cluster.pointCount,
      maxFrp: cluster.maxFrp,
      sumFrp: cluster.sumFrp,
      estHectares: cluster.estHectares,
      firstDetectedAt: cluster.firstSeen,
      lastDetectedAt: cluster.lastSeen,
    })
    .returning({ id: fireEvents.id });

  return { eventId: inserted.id, skippedOutsideSpain: false };
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

  let created = 0;
  let skippedOutsideSpain = 0;
  for (const match of matches) {
    if (match.matchedEventId) {
      const previous = activeEvents.find((e) => e.id === match.matchedEventId);
      await updateExistingEvent(match.matchedEventId, match.cluster, previous?.pointCount);
      await insertNewPoints(match.matchedEventId, match.cluster, previous?.lastDetectedAt ?? null);
      continue;
    }

    const { eventId, skippedOutsideSpain: skipped } = await createEventIfSpain(
      match.cluster,
      nominatimUserAgent,
    );
    if (skipped) {
      skippedOutsideSpain++;
      continue;
    }
    if (eventId) {
      created++;
      await insertNewPoints(eventId, match.cluster, null);
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
    eventsCreated: created,
    eventsSkippedOutsideSpain: skippedOutsideSpain,
    eventsClosed: closed,
  });
}
