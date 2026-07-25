"use client";

import { useId, useState } from "react";

export function EmbedCodeButton({ fireId, label }: { fireId?: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const panelId = useId();

  function snippet() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const src = fireId ? `${origin}/embed?id=${fireId}` : `${origin}/embed`;
    return `<iframe src="${src}" width="600" height="450" style="border:0" loading="lazy" title="Mapa de incendios FOCOS"></iframe>`;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be blocked (permissions, non-secure context) — the
      // textarea below stays selectable so the user can still copy by hand.
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-controls={panelId}
        className="text-xs text-orange-300 hover:text-orange-200 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
      >
        {label}
      </button>
      {open && (
        <div
          id={panelId}
          onClick={(e) => e.stopPropagation()}
          className="mt-1.5 rounded border border-gray-600 bg-gray-950 p-2"
        >
          <textarea
            readOnly
            value={snippet()}
            onFocus={(e) => e.currentTarget.select()}
            rows={2}
            aria-label="Código HTML para insertar el mapa"
            className="w-full resize-none rounded border border-gray-700 bg-gray-900 p-1.5 font-mono text-[11px] text-gray-300"
          />
          <button
            type="button"
            onClick={copy}
            className="mt-1.5 rounded bg-orange-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-300"
          >
            {copied ? "¡Copiado!" : "Copiar código"}
          </button>
        </div>
      )}
    </div>
  );
}
