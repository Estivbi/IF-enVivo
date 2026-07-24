CREATE TABLE fire_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  municipality TEXT,
  province TEXT,
  centroid_lat DOUBLE PRECISION NOT NULL,
  centroid_lon DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  level SMALLINT NOT NULL DEFAULT 0,
  point_count INT NOT NULL DEFAULT 0,
  max_frp REAL,
  sum_frp REAL,
  est_hectares REAL,
  first_detected_at TIMESTAMPTZ NOT NULL,
  last_detected_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hotspot_points (
  id BIGSERIAL PRIMARY KEY,
  fire_event_id UUID REFERENCES fire_events(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  acq_at TIMESTAMPTZ NOT NULL,
  frp REAL,
  confidence TEXT,
  satellite TEXT
);

CREATE INDEX idx_fire_events_status ON fire_events(status);
CREATE INDEX idx_hotspot_points_event ON hotspot_points(fire_event_id);
