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
function officialInfoSearchUrl(municipality: string | null, province: string | null): string {
  const place = [municipality, province].filter(Boolean).join(" ");
  const query = `112 incendio ${place}`.trim();
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
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
    <p className="mt-1 font-mono text-xs text-gray-500">
      {now.toLocaleString("es-ES", {
        dateStyle: "medium",
        timeStyle: "medium",
      })}
    </p>
  );
}

export function Sidebar({
  fires,
  selectedId,
  onSelect,
}: {
  fires: FireEventCollection;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const sorted = [...fires.features].sort((a, b) =>
    a.properties.status === b.properties.status ? 0 : a.properties.status === "active" ? -1 : 1,
  );

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto bg-gray-800 md:w-80 md:shrink-0 md:border-r md:border-gray-700">
      <div className="border-b border-gray-700 p-4">
        <h1 className="text-lg font-semibold text-white">FOCOS</h1>
        <LiveClock />
        <p className="mt-2 text-xs text-gray-400">
          Detección automática de incendios a partir de datos satelitales
          (NASA FIRMS). Los hotspots tienen retraso de 1-3h — esto{" "}
          <strong className="text-gray-300">no sustituye</strong> al aviso
          oficial del 112.
        </p>
      </div>

      <ul className="flex-1 divide-y divide-gray-700">
        {sorted.length === 0 && (
          <li className="p-4 text-sm text-gray-400">
            Sin incendios activos detectados ahora mismo.
          </li>
        )}
        {sorted.map((f) => {
          const badge = statusBadge(f.properties.status);
          return (
            <li
              key={f.properties.id}
              className={selectedId === f.properties.id ? "bg-gray-700" : ""}
            >
              <button
                onClick={() => onSelect(f.properties.id)}
                className="w-full px-4 pt-3 text-left transition hover:bg-gray-700"
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
                <p className="mt-1 text-xs text-gray-400">{f.properties.desc}</p>
              </button>
              <a
                href={officialInfoSearchUrl(f.properties.municipality, f.properties.province)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="mb-3 ml-4 mt-1 inline-block text-xs text-orange-300 hover:text-orange-200 hover:underline"
              >
                Buscar información oficial ↗
              </a>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
