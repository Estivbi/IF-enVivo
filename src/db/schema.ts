import {
  pgTable,
  uuid,
  text,
  doublePrecision,
  smallint,
  integer,
  real,
  timestamp,
  bigserial,
  index,
} from "drizzle-orm/pg-core";

export const fireEvents = pgTable(
  "fire_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    municipality: text("municipality"),
    province: text("province"),
    centroidLat: doublePrecision("centroid_lat").notNull(),
    centroidLon: doublePrecision("centroid_lon").notNull(),
    status: text("status").notNull().default("active"), // active | inactive
    level: smallint("level").notNull().default(0), // 0,1,2 heurístico
    pointCount: integer("point_count").notNull().default(0),
    maxFrp: real("max_frp"),
    sumFrp: real("sum_frp"),
    estHectares: real("est_hectares"),
    firstDetectedAt: timestamp("first_detected_at", { withTimezone: true }).notNull(),
    lastDetectedAt: timestamp("last_detected_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_fire_events_status").on(table.status)],
);

export const hotspotPoints = pgTable(
  "hotspot_points",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    fireEventId: uuid("fire_event_id").references(() => fireEvents.id, {
      onDelete: "cascade",
    }),
    lat: doublePrecision("lat").notNull(),
    lon: doublePrecision("lon").notNull(),
    acqAt: timestamp("acq_at", { withTimezone: true }).notNull(),
    frp: real("frp"),
    confidence: text("confidence"),
    satellite: text("satellite"),
  },
  (table) => [index("idx_hotspot_points_event").on(table.fireEventId)],
);

// Backs a free, code-only rate limiter for the public read endpoints
// (/api/fires, /api/fires/:id/points) — no external service required.
export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  windowStart: timestamp("window_start", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type FireEvent = typeof fireEvents.$inferSelect;
export type NewFireEvent = typeof fireEvents.$inferInsert;
export type HotspotPoint = typeof hotspotPoints.$inferSelect;
export type NewHotspotPoint = typeof hotspotPoints.$inferInsert;
