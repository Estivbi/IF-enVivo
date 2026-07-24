import { haversineKm, type ClusterSummary } from "./clustering";

// 5km gives some slack for the centroid to drift a bit between runs
// without losing the fire's identity — much bigger than that and we'd risk
// merging two genuinely separate fires that just happen to be close.
export const MATCH_RADIUS_KM = 5;
export const INACTIVE_AFTER_HOURS = 24;

export type ExistingEventRef = {
  id: string;
  centroidLat: number;
  centroidLon: number;
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

export function isStale(lastDetectedAt: Date, now: Date = new Date()): boolean {
  const hoursSince =
    (now.getTime() - lastDetectedAt.getTime()) / (1000 * 60 * 60);
  return hoursSince >= INACTIVE_AFTER_HOURS;
}
