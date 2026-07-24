"use client";

import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  type GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FireEventCollection, HotspotPointCollection } from "@/lib/types";

const SPAIN_CENTER: [number, number] = [-3.7, 40.2];

const LEVEL_COLOR: Record<number, string> = {
  0: "#9ca3af", // inactive/gray
  1: "#f97316", // orange
  2: "#dc2626", // red
};

const EMPTY_POINTS: HotspotPointCollection = { type: "FeatureCollection", features: [] };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function FiresMap({
  fires,
  selectedId,
}: {
  fires: FireEventCollection;
  selectedId: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // 'load' fires asynchronously (style/sprite/glyphs), which can resolve
  // after the /api/fires fetch already updated `fires` — read this ref
  // instead of the closure-captured prop so 'load' always sees the latest
  // data instead of locking in whatever `fires` was at mount time (likely
  // still empty).
  const firesRef = useRef(fires);
  firesRef.current = fires;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: SPAIN_CENTER,
      zoom: 5.5,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl(), "top-right");

    map.on("load", () => {
      // Raw hotspot "cloud" for the selected fire — populated lazily from
      // /api/fires/:id/points (see the selectedId effect below). NASA GIBS's
      // own vector-tile hotspot layer returns 404 on every tile/date tested
      // as of this writing, so this uses our own already-ingested points
      // instead of that external service.
      map.addSource("hotspot-points", {
        type: "geojson",
        data: EMPTY_POINTS as unknown as GeoJSON.FeatureCollection,
      });
      map.addLayer({
        id: "hotspot-points-circles",
        type: "circle",
        source: "hotspot-points",
        paint: {
          "circle-radius": 4,
          "circle-color": "#dc2626",
          "circle-opacity": 0.5,
        },
      });

      map.addSource("fire-events", {
        type: "geojson",
        data: firesRef.current as unknown as GeoJSON.FeatureCollection,
      });
      map.addLayer({
        id: "fire-events-circles",
        type: "circle",
        source: "fire-events",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "pointCount"], 3, 6, 30, 18],
          "circle-color": [
            "match",
            ["get", "level"],
            0, LEVEL_COLOR[0],
            1, LEVEL_COLOR[1],
            2, LEVEL_COLOR[2],
            LEVEL_COLOR[0],
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      const popup = new Popup({ closeButton: false, offset: 12 });
      map.on("mouseenter", "fire-events-circles", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features?.[0];
        if (!feature) return;
        const props = feature.properties as {
          name?: string;
          desc?: string;
          municipality?: string;
          province?: string;
        };
        const searchQuery = `112 incendio ${[props.municipality, props.province].filter(Boolean).join(" ")}`.trim();
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
        popup
          .setLngLat((feature.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(
            `<strong>${escapeHtml(props.name ?? "Incendio sin nombre")}</strong><br/>${escapeHtml(props.desc ?? "")}<br/><em>Nivel estimado, no oficial</em><br/><a href="${searchUrl}" target="_blank" rel="noopener noreferrer">Buscar información oficial ↗</a>`,
          )
          .addTo(map);
      });
      map.on("mouseleave", "fire-events-circles", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("fire-events") as GeoJSONSource | undefined;
    source?.setData(fires as unknown as GeoJSON.FeatureCollection);
  }, [fires]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const feature = fires.features.find((f) => f.properties.id === selectedId);
    if (!feature) return;
    map.flyTo({ center: feature.geometry.coordinates, zoom: 10 });

    let cancelled = false;
    fetch(`/api/fires/${selectedId}/points`)
      .then((res) => (res.ok ? (res.json() as Promise<HotspotPointCollection>) : null))
      .then((data) => {
        if (cancelled || !data) return;
        const source = map.getSource("hotspot-points") as GeoJSONSource | undefined;
        source?.setData(data as unknown as GeoJSON.FeatureCollection);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, fires]);

  return <div ref={containerRef} className="h-full w-full" />;
}
