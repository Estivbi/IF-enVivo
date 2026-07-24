export type FireEventProperties = {
  id: string;
  name: string | null;
  municipality: string | null;
  province: string | null;
  status: "active" | "inactive";
  level: 0 | 1 | 2;
  levelIsEstimated: true;
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

export type HotspotPointCollection = {
  type: "FeatureCollection";
  features: HotspotPointFeature[];
};
