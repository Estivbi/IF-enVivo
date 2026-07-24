export type FireEventProperties = {
  id: string;
  name: string | null;
  municipality: string | null;
  province: string | null;
  status: "active" | "inactive";
  pointCount: number;
  maxFrp: number | null;
  sumFrp: number | null;
  estHectares: number | null;
  firstDetectedAt: string;
  lastDetectedAt: string;
  updatedAt: string;
  desc: string;
};

export type FireEventFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: FireEventProperties;
};

export type FireEventCollection = {
  type: "FeatureCollection";
  features: FireEventFeature[];
};

export type HotspotPointProperties = {
  kind: "hotspot";
  id: number;
  acqAt: string;
  frp: number | null;
  confidence: string | null;
  satellite: string | null;
};

export type HotspotPointFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: HotspotPointProperties;
};

// Our own convex-hull estimate of the burned area, not an official
// perimeter — see ADR-0005.
export type EstimatedPerimeterFeature = {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: [number, number][][] };
  properties: { kind: "estimated_perimeter" };
};

export type HotspotPointCollection = {
  type: "FeatureCollection";
  features: (HotspotPointFeature | EstimatedPerimeterFeature)[];
};
