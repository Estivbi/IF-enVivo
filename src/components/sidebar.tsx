"use client";

import type { FireEventCollection } from "@/lib/types";

const LEVEL_LABEL: Record<number, string> = {
  0: "Inactivo",
  1: "Estable",
  2: "En crecimiento",
};

export function Sidebar({
  fires,
  selectedId,
  onSelect,
}: {
  fires: FireEventCollection;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const sorted = [...fires.features].sort((a, b) => b.properties.level - a.properties.level);

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-4">
        <h1 className="text-lg font-semibold">FOCOS</h1>
        <p className="mt-1 text-xs text-gray-500">
          Detección automática de incendios a partir de datos satelitales
          (NASA FIRMS). Los hotspots tienen retraso de 1-3h y el nivel
          mostrado es <strong>estimado</strong>, no el nivel oficial del 112.
        </p>
      </div>

      <ul className="flex-1 divide-y divide-gray-100">
        {sorted.length === 0 && (
          <li className="p-4 text-sm text-gray-500">
            Sin incendios activos detectados ahora mismo.
          </li>
        )}
        {sorted.map((f) => (
          <li key={f.properties.id}>
            <button
              onClick={() => onSelect(f.properties.id)}
              className={`w-full px-4 py-3 text-left transition hover:bg-gray-50 ${
                selectedId === f.properties.id ? "bg-orange-50" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {f.properties.name ?? "Incendio sin nombre"}
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    f.properties.level === 2
                      ? "bg-red-100 text-red-700"
                      : f.properties.level === 1
                        ? "bg-orange-100 text-orange-700"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {LEVEL_LABEL[f.properties.level]}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">{f.properties.desc}</p>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
