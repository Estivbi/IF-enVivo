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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Closing the drawer on select too, otherwise picking a fire from the
  // list on a phone leaves the sidebar covering the map you just asked to see.
  function handleSelect(id: string) {
    setSelectedId(id);
    setSidebarOpen(false);
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Below md this is an overlay drawer (hidden by default); md+ it's
          just a normal static sidebar and sidebarOpen stops mattering. */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-80 max-w-full transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar fires={fires} selectedId={selectedId} onSelect={handleSelect} />
      </div>
      <div className="relative flex-1">
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir lista de incendios"
          className="absolute left-2 top-2 z-10 rounded bg-gray-800 px-3 py-2 text-sm text-white shadow md:hidden"
        >
          ☰
        </button>
        {error && (
          <div className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded bg-red-600 px-3 py-1.5 text-sm text-white shadow">
            {error}
          </div>
        )}
        <FiresMap fires={fires} selectedId={selectedId} onSelect={handleSelect} />
      </div>
    </div>
  );
}
