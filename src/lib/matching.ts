import { haversineKm, type ClusterSummary } from "./clustering";

export const MATCH_RADIUS_KM = 5;
export const INACTIVE_AFTER_HOURS = 24;

/**
 * Heuristic FRP threshold (MW) for level 2 — not derived from any official
 * IGR scale, no calibration data exists yet. Tunable via env var so it can
 * be adjusted from real ingest data without a redeploy.
 */
const DEFAULT_LEVEL2_SUM_FRP_THRESHOLD_MW = 50;
export const LEVEL2_SUM_FRP_THRESHOLD_MW = Number(
  process.env.LEVEL2_FRP_THRESHOLD_MW ?? DEFAULT_LEVEL2_SUM_FRP_THRESHOLD_MW,
);
const RECENT_WINDOW_HOURS = 6;

export type ExistingEventRef = {
  id: string;
  centroidLat: number;
  centroidLon: number;
  pointCount: number;
};

export type ClusterMatch = {
  cluster: ClusterSummary;
  matchedEventId: string | null;
};

/**
 * Matches each new cluster to the closest existing fire_event within
 * MATCH_RADIUS_KM of its previous centroid, so the same fire keeps its id
 * across cron runs instead of spawning a new event every time.
 * PROMPT_INICIAL.md §3.2.4 — each existing event can be matched at most once.
 */
export function matchClustersToEvents(
  clusters: ClusterSummary[],
  existingEvents: ExistingEventRef[],
): ClusterMatch[] {
  const claimed = new Set<string>();
  const matches: ClusterMatch[] = [];

  for (const cluster of clusters) {
    let best: { id: string; distanceKm: number } | null = null;

    for (const event of existingEvents) {
      if (claimed.has(event.id)) continue;
      const distanceKm = haversineKm(
        { lat: cluster.centroidLat, lon: cluster.centroidLon },
        { lat: event.centroidLat, lon: event.centroidLon },
      );
      if (
        distanceKm <= MATCH_RADIUS_KM &&
        (!best || distanceKm < best.distanceKm)
      ) {
        best = { id: event.id, distanceKm };
      }
    }

    if (best) claimed.add(best.id);
    matches.push({ cluster, matchedEventId: best?.id ?? null });
  }

  return matches;
}

/**
 * Heuristic severity level — never the official 112/IGR level, must always
 * be surfaced to users as "estimated" (see CLAUDE.md honesty-of-data rules).
 */
export function computeLevel(
  cluster: ClusterSummary,
  previousPointCount: number | undefined,
): 0 | 1 | 2 {
  const recentCutoff =
    cluster.lastSeen.getTime() - RECENT_WINDOW_HOURS * 60 * 60 * 1000;
  const recentSumFrp = cluster.points
    .filter((p) => p.acqAt.getTime() >= recentCutoff)
    .reduce((sum, p) => sum + (p.frp || 0), 0);

  const isGrowing =
    previousPointCount !== undefined && cluster.pointCount > previousPointCount;

  if (recentSumFrp >= LEVEL2_SUM_FRP_THRESHOLD_MW && isGrowing) return 2;
  return 1;
}

export function isStale(lastDetectedAt: Date, now: Date = new Date()): boolean {
  const hoursSince =
    (now.getTime() - lastDetectedAt.getTime()) / (1000 * 60 * 60);
  return hoursSince >= INACTIVE_AFTER_HOURS;
}
