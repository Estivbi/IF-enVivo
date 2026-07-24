"use client";

import { useEffect, useState } from "react";
import type { FireEventCollection } from "@/lib/types";

// Deliberately just active/inactive — see ADR-0004. A "stable vs growing"
// distinction existed before but relied on comparing satellite-detected
// point counts between cron runs, too noisy a signal to call reliable.
function statusBadge(status: "active" | "inactive"): {
  label: string;
  className: string;
  title: string;
} {
  return status === "active"
    ? {
        label: "Activo",
        className: "bg-orange-900/60 text-orange-200",
        title: "El satélite ha detectado focos nuevos en este incendio en las últimas 24h.",
      }
    : {
        label: "Inactivo",
        className: "bg-gray-700 text-gray-300",
        title: "Sin focos nuevos detectados por el satélite en las últimas 24h.",
      };
}

// Reference link only — no scraping, no copied content. Lets the user check
// official sources (112/Protección Civil) themselves; see ADR-0003.
function officialInfoSearchUrl(
  name: string | null,
  municipality: string | null,
  province: string | null,
): string {
  const place = [municipality, province].filter(Boolean).join(" ");
  const query = `112 incendio ${place}`.trim();
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function formatLastDetected(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return null;
  }
}

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!now) return null;

  return (
    <p
      className="mt-1 font-mono text-xs text-gray-500"
      aria-label={`Hora actual: ${now.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "medium" })}`}
      aria-live="polite"
    >
      {now.toLocaleString("es-ES", {
        dateStyle: "medium",
        timeStyle: "medium",
      })}
    </p>
  );
}

function SkeletonList() {
  return (
    <ul aria-label="Cargando incendios…" aria-busy="true">
      {[1, 2, 3].map((i) => (
        <li key={i} className="border-b border-gray-700 p-4">
          <div className="mb-2 h-4 w-2/3 animate-pulse rounded bg-gray-600" />
          <div className="h-3 w-full animate-pulse rounded bg-gray-700" />
        </li>
      ))}
    </ul>
  );
}

export function Sidebar({
  fires,
  selectedId,
  onSelect,
  loading,
}: {
  fires: FireEventCollection;
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
}) {
  const sorted = [...fires.features].sort((a, b) =>
    a.properties.status === b.properties.status ? 0 : a.properties.status === "active" ? -1 : 1,
  );

  return (
    <aside
      id="sidebar-nav"
      aria-label="Panel de incendios detectados"
      className="flex h-full w-full flex-col overflow-y-auto bg-gray-800 md:w-80 md:shrink-0 md:border-r md:border-gray-700"
    >
      <header className="border-b border-gray-700 p-4">
        <div className="flex items-center gap-2">
          <img
            src="/focosif-svg.svg"
            alt=""
            aria-hidden="true"
            className="h-8 w-8"
          />
          <h1 className="text-lg font-semibold text-white">FOCOS</h1>
        </div>
        <LiveClock />
        {/* Aviso de retraso visible siempre, incluso en móvil sin sidebar expandida */}
        <p className="mt-2 text-xs text-gray-300">
          Datos satelitales NASA FIRMS (VIIRS). Retraso de{" "}
          <strong>1–3 h</strong> respecto al tiempo real.{" "}
          <strong className="text-orange-300">No sustituye al 112.</strong>
        </p>
      </header>

      {/* Leyenda de puntos del mapa */}
      <div className="border-b border-gray-700 px-4 py-2">
        <p className="mb-1.5 text-xs font-medium text-gray-400">Leyenda</p>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ background: "#f97316" }}
              aria-hidden="true"
            />
            Incendio activo (focos en últimas 24 h)
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ background: "#9ca3af" }}
              aria-hidden="true"
            />
            Incendio inactivo
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full opacity-50"
              style={{ background: "#dc2626" }}
              aria-hidden="true"
            />
            Hotspot individual (satélite VIIRS)
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-sm border border-dashed border-red-600 bg-red-600/15"
              aria-hidden="true"
            />
            Superficie estimada (aproximación propia, no un perímetro oficial)
          </div>
        </div>
      </div>

      {loading ? (
        <SkeletonList />
      ) : (
        <ul
          className="flex-1 divide-y divide-gray-700"
          aria-label="Lista de incendios detectados"
        >
          {sorted.length === 0 && (
            <li className="p-4 text-sm text-gray-400">
              Sin incendios activos detectados ahora mismo.
            </li>
          )}
          {sorted.map((f) => {
            const badge = statusBadge(f.properties.status);
            const lastDetected = formatLastDetected(f.properties.lastDetectedAt);
            const isSelected = selectedId === f.properties.id;
            return (
              <li
                key={f.properties.id}
                className={isSelected ? "bg-gray-700" : ""}
              >
                <button
                  onClick={() => onSelect(f.properties.id)}
                  aria-pressed={isSelected}
                  aria-label={`${f.properties.name ?? "Incendio sin nombre"}, estado: ${badge.label}${lastDetected ? `, última detección: ${lastDetected}` : ""}`}
                  className="w-full px-4 pt-3 text-left transition hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-100">
                      {f.properties.name ?? "Incendio sin nombre"}
                    </span>
                    <span
                      title={badge.title}
                      className={`shrink-0 cursor-help rounded px-2 py-0.5 text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-300">{f.properties.desc}</p>
                  {lastDetected && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      Última detección: {lastDetected}
                    </p>
                  )}
                </button>
                <a
                  href={officialInfoSearchUrl(
                    f.properties.name,
                    f.properties.municipality,
                    f.properties.province,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Buscar información oficial sobre ${f.properties.name ?? "este incendio"} (abre en nueva pestaña)`}
                  className="mb-3 ml-4 mt-1 inline-block text-xs text-orange-300 hover:text-orange-200 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
                >
                  Buscar información oficial ↗
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
