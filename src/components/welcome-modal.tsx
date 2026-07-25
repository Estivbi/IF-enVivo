"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "focos-welcome-dismissed";

export function WelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
    >
      <div className="max-w-sm rounded-lg border border-gray-700 bg-gray-800 p-5 text-gray-100 shadow-xl">
        <h2 id="welcome-modal-title" className="text-lg font-semibold text-orange-300">
          ¿Qué es FOCOS?
        </h2>
        <p className="mt-2 text-sm text-gray-300">
          Un mapa de incendios forestales en España detectados por satélite (NASA
          FIRMS), con datos que se actualizan cada hora.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-gray-300">
          <li>
            📍 Pulsa <strong className="text-gray-100">&ldquo;Incendios cerca de mí&rdquo;</strong> para
            ver si hay alguno cerca de tu ubicación.
          </li>
          <li>
            🔥 Toca un incendio de la lista o del mapa para ver detalles y hacer zoom.
          </li>
        </ul>
        <p className="mt-3 text-xs text-gray-400">
          Los datos tienen 1–3 h de retraso y{" "}
          <strong className="text-orange-300">no sustituyen al 112</strong>.
        </p>
        <button
          onClick={dismiss}
          autoFocus
          className="mt-4 w-full rounded bg-orange-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-300"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
