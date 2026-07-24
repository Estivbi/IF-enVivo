"use client";

import { useCallback, useEffect, useState } from "react";
import { FiresMap } from "./fires-map";
import { Sidebar } from "./sidebar";
import type { FireEventCollection } from "@/lib/types";

const EMPTY: FireEventCollection = { type: "FeatureCollection", features: [] };
const POLL_INTERVAL_MS = 5 * 60 * 1000;

export function Dashboard() {
  const [fires, setFires] = useState<FireEventCollection>(EMPTY);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/fires");
      if (!res.ok) throw new Error(`API respondió ${res.status}`);
      setFires((await res.json()) as FireEventCollection);
      setError(null);
    } catch {
      setError("No se ha podido cargar /api/fires. Reintentando...");
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="flex h-screen w-screen">
      <Sidebar fires={fires} selectedId={selectedId} onSelect={setSelectedId} />
      <div className="relative flex-1">
        {error && (
          <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded bg-red-600 px-3 py-1.5 text-sm text-white shadow">
            {error}
          </div>
        )}
        <FiresMap fires={fires} selectedId={selectedId} />
      </div>
    </div>
  );
}
