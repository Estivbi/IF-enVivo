"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiresMap } from "./fires-map";
import { Sidebar } from "./sidebar";
import { WelcomeModal } from "./welcome-modal";
import type { FireEventCollection } from "@/lib/types";

const EMPTY: FireEventCollection = { type: "FeatureCollection", features: [] };
const POLL_INTERVAL_MS = 5 * 60 * 1000;

export function Dashboard() {
  const [fires, setFires] = useState<FireEventCollection>(EMPTY);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleLocate() {
    if (!navigator.geolocation) {
      setLocationError("Tu navegador no admite geolocalización.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.longitude, pos.coords.latitude]);
        setLocating(false);
      },
      () => {
        setLocationError("No se ha podido obtener tu ubicación.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/fires");
      if (!res.ok) throw new Error(`API respondió ${res.status}`);
      setFires((await res.json()) as FireEventCollection);
      setError(null);
    } catch {
      setError("No se ha podido cargar /api/fires.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [load]);

  function handleRetry() {
    setError(null);
    setLoading(true);
    load();
  }

  // Closing the drawer on select too, otherwise picking a fire from the
  // list on a phone leaves the sidebar covering the map you just asked to see.
  function handleSelect(id: string) {
    setSelectedId(id);
    setSidebarOpen(false);
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden">
      <WelcomeModal />
      {/* Overlay semitransparente en móvil/tablet cuando el sidebar está abierto */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Below lg (phone + tablet) this is an overlay drawer (hidden by
          default); lg+ (desktop) it's a normal static sidebar and
          sidebarOpen stops mattering. */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-80 max-w-full transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!sidebarOpen}
      >
        <Sidebar
          fires={fires}
          selectedId={selectedId}
          onSelect={handleSelect}
          loading={loading}
          userLocation={userLocation}
          onLocate={handleLocate}
          locating={locating}
          locationError={locationError}
        />
        {/* Footer con links legales — solo visible en desktop (el sidebar es estático) */}
        <footer className="hidden border-t border-gray-700 px-4 py-3 text-xs text-gray-500 md:block lg:block">
          <div className="flex gap-3">
            <a href="/sobre" className="hover:text-gray-300 transition">Sobre FOCOS</a>
            <span aria-hidden>·</span>
            <a href="/aviso-legal" className="hover:text-gray-300 transition">Aviso legal</a>
            <span aria-hidden>·</span>
            <a href="https://github.com/Estivbi/IF-enVivo" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition">GitHub</a>
          </div>
        </footer>

      </div>

      <main id="main-content" className="relative flex-1">
        {/* Botón hamburguesa para móvil/tablet — SVG en lugar de caracter Unicode */}
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir lista de incendios"
          aria-expanded={sidebarOpen}
          aria-controls="sidebar-nav"
          className="absolute left-2 top-2 z-10 rounded bg-gray-800 px-3 py-2 text-white shadow lg:hidden"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Banner de error con role=alert y botón de reintento */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="absolute left-1/2 top-2 z-10 -translate-x-1/2 flex items-center gap-3 rounded bg-red-700 px-4 py-2 text-sm text-white shadow"
          >
            <span>{error}</span>
            <button
              onClick={handleRetry}
              className="rounded border border-white/40 px-2 py-0.5 text-xs hover:bg-white/20 transition"
            >
              Reintentar
            </button>
          </div>
        )}

        <FiresMap fires={fires} selectedId={selectedId} onSelect={handleSelect} userLocation={userLocation} />
      </main>
    </div>
  );
}
