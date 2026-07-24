"use client";

import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  type GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FireEventCollection } from "@/lib/types";

const SPAIN_CENTER: [number, number] = [-3.7, 40.2];

const LEVEL_COLOR: Record<number, string> = {
  0: "#9ca3af", // inactive/gray
  1: "#f97316", // orange
  2: "#dc2626", // red
};

const GIBS_LAYER = "VIIRS_SNPP_Thermal_Anomalies_375m_All";
// GIBS retired the raster PNG hotspot layer — it now only ships this as
// vector tiles (.mvt), matrix set/source-layer per its own published style:
// https://gibs.earthdata.nasa.gov/vector-styles/v1.0/FIRMS_VIIRS_Thermal_Anomalies.json
const GIBS_SOURCE_LAYER = `${GIBS_LAYER}_v1_NRT`;

function gibsFireTileUrl(): string {
  // NRT imagery for "today" isn't published yet (its own processing lag, on
  // top of the 1-3h satellite delay) — request yesterday, the most recent
  // day reliably available.
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${GIBS_LAYER}/default/${yesterday}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.mvt`;
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
      map.addSource("gibs-heat", {
        type: "vector",
        tiles: [gibsFireTileUrl()],
        maxzoom: 8,
        attribution: "NASA GIBS / VIIRS",
      });
      map.addLayer({
        id: "gibs-heat-layer",
        type: "circle",
        source: "gibs-heat",
        "source-layer": GIBS_SOURCE_LAYER,
        paint: {
          "circle-radius": ["step", ["zoom"], 1, 5, 2, 8, 3],
          "circle-color": "rgb(240, 40, 40)",
          "circle-opacity": 0.65,
        },
      });

      map.addSource("fire-events", {
        type: "geojson",
        data: fires as unknown as GeoJSON.FeatureCollection,
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
        const props = feature.properties as { name?: string; desc?: string };
        popup
          .setLngLat((feature.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(
            `<strong>${props.name ?? "Incendio sin nombre"}</strong><br/>${props.desc ?? ""}<br/><em>Nivel estimado, no oficial</em>`,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [selectedId, fires]);

  return <div ref={containerRef} className="h-full w-full" />;
}
