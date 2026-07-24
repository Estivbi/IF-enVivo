import { sql } from "drizzle-orm";
import { db } from "@/db/client";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;

export type RateLimitResult = { allowed: boolean; count: number };

/**
 * Fixed-window rate limit backed by Neon (rate_limit_buckets) — no external
 * service needed. Atomic upsert: resets the counter once the window has
 * elapsed, otherwise increments it, in a single round trip.
 */
export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  const windowStartThreshold = new Date(Date.now() - WINDOW_MS).toISOString();

  const result = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limit_buckets (key, count, window_start)
    VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limit_buckets.window_start < ${windowStartThreshold}::timestamptz
        THEN 1
        ELSE rate_limit_buckets.count + 1
      END,
      window_start = CASE
        WHEN rate_limit_buckets.window_start < ${windowStartThreshold}::timestamptz
        THEN now()
        ELSE rate_limit_buckets.window_start
      END
    RETURNING count
  `);

  const count = Number(result.rows[0]?.count ?? 0);
  return { allowed: count <= MAX_REQUESTS_PER_WINDOW, count };
}

export function clientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() ?? "unknown";
}
