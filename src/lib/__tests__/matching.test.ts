import { describe, expect, it } from "vitest";
import type { ClusterSummary } from "../clustering";
import {
  computeLevel,
  isStale,
  matchClustersToEvents,
  MATCH_RADIUS_KM,
} from "../matching";

function fakeCluster(overrides: Partial<ClusterSummary> = {}): ClusterSummary {
  return {
    centroidLat: 40.36,
    centroidLon: -4.66,
    pointCount: 4,
    maxFrp: 10,
    sumFrp: 30,
    firstSeen: new Date("2026-07-20T00:00:00Z"),
    lastSeen: new Date("2026-07-20T02:00:00Z"),
    bbox: { minLat: 40.35, maxLat: 40.37, minLon: -4.67, maxLon: -4.65 },
    estHectares: 12,
    points: [],
    ...overrides,
  };
}

describe("matchClustersToEvents", () => {
  it("matches a cluster to an existing event within 5km", () => {
    const cluster = fakeCluster();
    const existing = [
      { id: "evt-1", centroidLat: 40.361, centroidLon: -4.661, pointCount: 3 },
    ];
    const [match] = matchClustersToEvents([cluster], existing);
    expect(match.matchedEventId).toBe("evt-1");
  });

  it("does not match beyond MATCH_RADIUS_KM", () => {
    const cluster = fakeCluster();
    const existing = [
      { id: "evt-far", centroidLat: 41.5, centroidLon: -3.0, pointCount: 3 },
    ];
    const [match] = matchClustersToEvents([cluster], existing);
    expect(match.matchedEventId).toBeNull();
  });

  it("never claims the same existing event twice", () => {
    const clusterA = fakeCluster({ centroidLat: 40.360, centroidLon: -4.660 });
    const clusterB = fakeCluster({ centroidLat: 40.361, centroidLon: -4.661 });
    const existing = [
      { id: "evt-1", centroidLat: 40.3605, centroidLon: -4.6605, pointCount: 3 },
    ];
    const matches = matchClustersToEvents([clusterA, clusterB], existing);
    const claimedIds = matches.map((m) => m.matchedEventId);
    expect(claimedIds.filter((id) => id === "evt-1")).toHaveLength(1);
    expect(claimedIds.filter((id) => id === null)).toHaveLength(1);
  });
});

describe("computeLevel", () => {
  it("returns level 2 when recent FRP is high and the cluster is growing", () => {
    const cluster = fakeCluster({
      sumFrp: 80,
      points: [
        { lat: 40.36, lon: -4.66, frp: 80, acqAt: new Date("2026-07-20T02:00:00Z") },
      ],
      lastSeen: new Date("2026-07-20T02:00:00Z"),
    });
    expect(computeLevel(cluster, 2)).toBe(2);
  });

  it("returns level 1 when stable or below threshold", () => {
    const cluster = fakeCluster({
      points: [
        { lat: 40.36, lon: -4.66, frp: 5, acqAt: new Date("2026-07-20T02:00:00Z") },
      ],
    });
    expect(computeLevel(cluster, 10)).toBe(1);
  });
});

describe("isStale", () => {
  it("flags events with no new points in 24h", () => {
    const now = new Date("2026-07-22T00:00:00Z");
    expect(isStale(new Date("2026-07-20T00:00:00Z"), now)).toBe(true);
    expect(isStale(new Date("2026-07-21T23:00:00Z"), now)).toBe(false);
  });
});

// MATCH_RADIUS_KM is exported for reuse by the ingest route's DB queries.
describe("MATCH_RADIUS_KM", () => {
  it("is 5km per PROMPT_INICIAL.md §3.2.4", () => {
    expect(MATCH_RADIUS_KM).toBe(5);
  });
});
