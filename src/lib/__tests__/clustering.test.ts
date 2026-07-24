import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isLowConfidence, parseFirmsCsv } from "../firms";
import { clusterHotspots, haversineKm } from "../clustering";

const fixtureCsv = readFileSync(
  join(__dirname, "fixtures/sample_firms.csv"),
  "utf-8",
);

function loadPoints() {
  return parseFirmsCsv(fixtureCsv, "VIIRS_NOAA20_NRT")
    .filter((p) => !isLowConfidence(p.confidence))
    .map((p) => ({ lat: p.lat, lon: p.lon, frp: p.frp, acqAt: p.acqAt }));
}

describe("haversineKm", () => {
  it("is ~0 for identical points and grows with distance", () => {
    const a = { lat: 40.36, lon: -4.66 };
    expect(haversineKm(a, a)).toBeCloseTo(0, 5);
    expect(haversineKm(a, { lat: 41.36, lon: -4.66 })).toBeGreaterThan(100);
  });
});

describe("clusterHotspots (DBSCAN eps=2.5km, minSamples=3)", () => {
  it("groups nearby points into one fire_event", () => {
    const clusters = clusterHotspots(loadPoints());
    const burgohondo = clusters.find(
      (c) => Math.abs(c.centroidLat - 40.36) < 0.05,
    );
    expect(burgohondo).toBeDefined();
    expect(burgohondo!.pointCount).toBe(4);
  });

  it("keeps far-apart clusters as separate fire_events", () => {
    const clusters = clusterHotspots(loadPoints());
    // Burgohondo (~40.36,-4.66) and the Toledo-area cluster (~39.86,-4.02)
    // are ~70km apart — must never merge into the same event.
    expect(clusters).toHaveLength(2);
    const centroids = clusters.map((c) => [c.centroidLat, c.centroidLon]);
    const distanceBetweenClusters = haversineKm(
      { lat: centroids[0][0], lon: centroids[0][1] },
      { lat: centroids[1][0], lon: centroids[1][1] },
    );
    expect(distanceBetweenClusters).toBeGreaterThan(50);
  });

  it("drops isolated points as noise (below minSamples)", () => {
    const clusters = clusterHotspots(loadPoints());
    const totalClusteredPoints = clusters.reduce(
      (sum, c) => sum + c.pointCount,
      0,
    );
    // 8 non-low-confidence points in the fixture, but only 7 belong to a
    // dense cluster; the lone point near 41.5,-3.0 must be excluded.
    expect(totalClusteredPoints).toBe(7);
  });

  it("computes centroid, FRP aggregates and bbox for a cluster", () => {
    const clusters = clusterHotspots(loadPoints());
    const burgohondo = clusters.find((c) => c.pointCount === 4)!;
    expect(burgohondo.maxFrp).toBeCloseTo(15.1, 5);
    expect(burgohondo.sumFrp).toBeCloseTo(12.4 + 9.8 + 15.1 + 7.6, 5);
    expect(burgohondo.bbox.minLat).toBeLessThanOrEqual(burgohondo.bbox.maxLat);
    expect(burgohondo.bbox.minLon).toBeLessThanOrEqual(burgohondo.bbox.maxLon);
  });
});
