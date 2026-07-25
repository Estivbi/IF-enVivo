"use client";

import { useCallback, useEffect, useState } from "react";
import { FiresMap } from "./fires-map";
import type { FireEventCollection } from "@/lib/types";

const EMPTY: FireEventCollection = { type: "FeatureCollection", features: [] };
const POLL_INTERVAL_MS = 5 * 60 * 1000;

// Minimal shell for /embed — no sidebar, no error banner (there's no room
// in a news site's iframe), just the map plus a credit link back to FOCOS.
export function EmbedMap({ fireId }: { fireId?: string }) {
  const [fires, setFires] = useState<FireEventCollection>(EMPTY);
  const [selectedId, setSelectedId] = useState<string | null>(fireId ?? null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/fires");
      if (res.ok) setFires((await res.json()) as FireEventCollection);
    } catch {
      // Silent by design — next poll retries; an error banner would eat too
      // much of an already-small embedded widget.
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="relative h-screen w-screen">
      <FiresMap fires={fires} selectedId={selectedId} onSelect={setSelectedId} embed />
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 rounded bg-gray-900/85 px-2.5 py-1.5 text-xs font-medium text-white shadow backdrop-blur transition hover:bg-gray-900"
      >
        🔥 FOCOS
      </a>
    </div>
  );
}
