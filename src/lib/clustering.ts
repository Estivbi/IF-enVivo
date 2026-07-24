const EARTH_RADIUS_KM = 6371;

export type ClusterPoint = {
  lat: number;
  lon: number;
  frp: number;
  acqAt: Date;
};

export type ClusterSummary = {
  centroidLat: number;
  centroidLon: number;
  pointCount: number;
  maxFrp: number;
  sumFrp: number;
  firstSeen: Date;
  lastSeen: Date;
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  estHectares: number;
  points: ClusterPoint[];
};

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Spatial DBSCAN over haversine distance. Points that never reach
 * `minSamples` density are treated as noise and dropped — a lone hotspot
 * isn't a fire_event candidate per PROMPT_INICIAL.md §3.2.
 */
export function dbscan<T extends { lat: number; lon: number }>(
  points: T[],
  epsKm: number,
  minSamples: number,
): T[][] {
  const n = points.length;
  const labels = new Array<number>(n).fill(0); // 0 = unvisited, -1 = noise, >0 = cluster id
  let clusterId = 0;

  const neighbors = (i: number): number[] => {
    const result: number[] = [];
    for (let j = 0; j < n; j++) {
      if (i !== j && haversineKm(points[i], points[j]) <= epsKm) {
        result.push(j);
      }
    }
    return result;
  };

  for (let i = 0; i < n; i++) {
    if (labels[i] !== 0) continue;

    const seeds = neighbors(i);
    if (seeds.length + 1 < minSamples) {
      labels[i] = -1;
      continue;
    }

    clusterId++;
    labels[i] = clusterId;

    const queue = [...seeds];
    while (queue.length > 0) {
      const j = queue.shift()!;
      if (labels[j] === -1) labels[j] = clusterId;
      if (labels[j] !== 0) continue;

      labels[j] = clusterId;
      const jNeighbors = neighbors(j);
      if (jNeighbors.length + 1 >= minSamples) {
        queue.push(...jNeighbors);
      }
    }
  }

  const clusters = new Map<number, T[]>();
  for (let i = 0; i < n; i++) {
    if (labels[i] <= 0) continue;
    if (!clusters.has(labels[i])) clusters.set(labels[i], []);
    clusters.get(labels[i])!.push(points[i]);
  }

  return [...clusters.values()];
}

/**
 * Convex hull (Andrew's monotone chain) over raw [lon, lat] pairs. A convex
 * hull's vertex set is invariant under axis scaling (lon/lat degrees vs. a
 * projected km grid are just anisotropic scaling of each other), so this
 * gives the correct hull shape directly in GeoJSON's native [lon, lat]
 * order — reused both for the area estimate below and for the frontend's
 * "estimated perimeter" polygon layer.
 */
export function convexHull(points: { lat: number; lon: number }[]): [number, number][] {
  if (points.length < 3) return [];

  const sorted = [...points].sort((a, b) => (a.lon === b.lon ? a.lat - b.lat : a.lon - b.lon));
  const cross = (
    o: { lat: number; lon: number },
    a: { lat: number; lon: number },
    b: { lat: number; lon: number },
  ) => (a.lon - o.lon) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lon - o.lon);

  const lower: { lat: number; lon: number }[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: { lat: number; lon: number }[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  if (hull.length < 3) return [];
  return hull.map((p): [number, number] => [p.lon, p.lat]);
}

/** Convex hull area in km², planar-projected around the cluster centroid. */
function convexHullAreaKm2(points: ClusterPoint[], centroidLat: number): number {
  const hull = convexHull(points);
  if (hull.length < 3) return 0;

  const kmPerDegLat = 111.32;
  const kmPerDegLon = 111.32 * Math.cos(toRad(centroidLat));
  const xy = hull.map(([lon, lat]) => ({ x: lon * kmPerDegLon, y: lat * kmPerDegLat }));

  let area = 0;
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i];
    const b = xy[(i + 1) % xy.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

export function summarizeCluster(points: ClusterPoint[]): ClusterSummary {
  const centroidLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const centroidLon = points.reduce((s, p) => s + p.lon, 0) / points.length;

  const frps = points.map((p) => p.frp).filter((f) => Number.isFinite(f));
  const times = points.map((p) => p.acqAt.getTime());

  const areaKm2 = convexHullAreaKm2(points, centroidLat);

  return {
    centroidLat,
    centroidLon,
    pointCount: points.length,
    maxFrp: frps.length ? Math.max(...frps) : 0,
    sumFrp: frps.reduce((s, f) => s + f, 0),
    firstSeen: new Date(Math.min(...times)),
    lastSeen: new Date(Math.max(...times)),
    bbox: {
      minLat: Math.min(...points.map((p) => p.lat)),
      maxLat: Math.max(...points.map((p) => p.lat)),
      minLon: Math.min(...points.map((p) => p.lon)),
      maxLon: Math.max(...points.map((p) => p.lon)),
    },
    estHectares: areaKm2 * 100,
    points,
  };
}

// eps=2.5km / min_samples=3 come straight from the spec doc. Haven't had
// a real reason to retune these yet — leaving as-is until FIRMS data shows
// otherwise.
export const DEFAULT_EPS_KM = 2.5;
export const DEFAULT_MIN_SAMPLES = 3;

export function clusterHotspots(
  points: ClusterPoint[],
  epsKm: number = DEFAULT_EPS_KM,
  minSamples: number = DEFAULT_MIN_SAMPLES,
): ClusterSummary[] {
  return dbscan(points, epsKm, minSamples).map(summarizeCluster);
}
