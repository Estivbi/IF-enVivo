"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  type GeoJSONSource,
  type StyleSpecification,
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

const STREETS_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
// Esri World Imagery — free, no API key, no usage cap for this kind of
// low-volume public app. Kept as a plain style object (no external style.json
// fetch needed) so switching basemaps can't hit the same kind of external
// service issue the GIBS vector layer did.
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [{ id: "satellite", type: "raster", source: "satellite" }],
};

type Basemap = "streets" | "satellite";

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
  onSelect,
}: {
  fires: FireEventCollection;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [basemap, setBasemap] = useState<Basemap>("streets");

  // 'style.load' fires asynchronously (and again on every setStyle() call),
  // which can resolve after the /api/fires fetch already updated `fires` —
  // read these refs instead of closure-captured props/state so re-adding
  // sources after a basemap switch always uses the latest data.
  const firesRef = useRef(fires);
  firesRef.current = fires;
  const hotspotPointsRef = useRef<HotspotPointCollection>(EMPTY_POINTS);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: STREETS_STYLE,
      center: SPAIN_CENTER,
      zoom: 5.5,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl(), "top-right");

    // Fires on the initial style load and again after every setStyle() call
    // (basemap switch) — re-adding our sources/layers here keeps them alive
    // across a full basemap swap instead of only on first mount.
    map.on("style.load", () => {
      // Raw hotspot "cloud" for the selected fire — populated lazily from
      // /api/fires/:id/points. NASA GIBS's own vector-tile hotspot layer
      // returns 404 on every tile/date tested as of this writing, so this
      // uses our own already-ingested points instead of that external
      // service.
      map.addSource("hotspot-points", {
        type: "geojson",
        data: hotspotPointsRef.current as unknown as GeoJSON.FeatureCollection,
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

      const popup = new Popup({ closeButton: false, offset: 12, className: "fire-popup" });
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
      map.on("click", "fire-events-circles", (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) onSelectRef.current(id);
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
        hotspotPointsRef.current = data;
        const source = map.getSource("hotspot-points") as GeoJSONSource | undefined;
        source?.setData(data as unknown as GeoJSON.FeatureCollection);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, fires]);

  function switchBasemap(next: Basemap) {
    const map = mapRef.current;
    if (!map || next === basemap) return;
    setBasemap(next);
    map.setStyle(next === "streets" ? STREETS_STYLE : SATELLITE_STYLE);
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute bottom-6 left-2 z-10 flex overflow-hidden rounded border border-gray-700 text-xs shadow">
        <button
          onClick={() => switchBasemap("streets")}
          className={`px-2 py-1 ${basemap === "streets" ? "bg-gray-800 text-white" : "bg-white text-gray-700"}`}
        >
          Calle
        </button>
        <button
          onClick={() => switchBasemap("satellite")}
          className={`px-2 py-1 ${basemap === "satellite" ? "bg-gray-800 text-white" : "bg-white text-gray-700"}`}
        >
          Satélite
        </button>
      </div>
    </div>
  );
}
