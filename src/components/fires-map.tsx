"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  type GeoJSONSource,
  type MapGeoJSONFeature,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FireEventCollection, HotspotPointCollection } from "@/lib/types";

const SPAIN_CENTER: [number, number] = [-3.7, 40.2];

const STATUS_COLOR: Record<string, string> = {
  active: "#f97316", // orange
  inactive: "#9ca3af", // gray
};

const EMPTY_POINTS: HotspotPointCollection = { type: "FeatureCollection", features: [] };

const STREETS_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
// Esri World Imagery — free, no key, plenty for how little traffic this
// gets. Wrote it as a plain style object instead of pointing at a
// style.json URL so there's one less external fetch that could go down.
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
    // Place names/boundaries overlay — World_Imagery on its own has no
    // labels at all, this is Esri's own "hybrid" companion layer for it.
    "satellite-labels": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
    },
  },
  layers: [
    { id: "satellite", type: "raster", source: "satellite" },
    { id: "satellite-labels", type: "raster", source: "satellite-labels" },
  ],
};

type Basemap = "streets" | "satellite";

// Extra vision layers — additive overlays, independent of the Calle/Satélite
// basemap choice and of each other. All verified reachable with curl before
// wiring them in (GIBS's own hotspot layer taught us not to trust "official
// free API" claims at face value).
function gibsTrueColorUrl(): string {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${yesterday}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
}

// EUMETSAT WMS — omitting TIME entirely uses the server's own "default"
// (nearestValue="1" in its capabilities), which tracks its latest available
// pass, so this stays current without us computing a timestamp ourselves.
function eumetsatWmsUrl(layer: string): string {
  return `https://view.eumetsat.int/geoserver/ows?service=WMS&version=1.3.0&request=GetMap&layers=${layer}&bbox={bbox-epsg-3857}&width=256&height=256&crs=EPSG:3857&format=image/png&transparent=true`;
}

type OverlayId = "gibs" | "eumetsat-msg" | "eumetsat-mtg";
const OVERLAYS: { id: OverlayId; label: string; title: string; sourceId: string; layerId: string }[] = [
  {
    id: "gibs",
    label: "Imagen NASA",
    title: "Imagen real del satélite VIIRS (día anterior), donde se ve el humo.",
    sourceId: "overlay-gibs",
    layerId: "overlay-gibs-layer",
  },
  {
    id: "eumetsat-msg",
    label: "Focos EUMETSAT",
    title:
      "Detección de fuego del satélite MSG, resolución ~3km/píxel — a mucho zoom se ve en bloques grandes porque esa es la resolución real, no un error.",
    sourceId: "overlay-eumetsat-msg",
    layerId: "overlay-eumetsat-msg-layer",
  },
  {
    id: "eumetsat-mtg",
    label: "Temp. fuego EUMETSAT",
    title:
      "Temperatura del fuego del satélite MTG (más resolución que MSG, pero sigue siendo una imagen de satélite, no un mapa de precisión local).",
    sourceId: "overlay-eumetsat-mtg",
    layerId: "overlay-eumetsat-mtg-layer",
  },
];

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
  const [basemap, setBasemap] = useState<Basemap>("satellite");
  const [activeOverlays, setActiveOverlays] = useState<Set<OverlayId>>(new Set());
  // Read inside style.load (fires again on every basemap switch) so an
  // overlay a user turned on stays on across a Calle/Satélite swap.
  const activeOverlaysRef = useRef(activeOverlays);
  activeOverlaysRef.current = activeOverlays;

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
      style: SATELLITE_STYLE,
      center: SPAIN_CENTER,
      zoom: 5.5,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl(), "top-right");

    // Fires on the initial style load and again after every setStyle() call
    // (basemap switch) — re-adding our sources/layers here keeps them alive
    // across a full basemap swap instead of only on first mount.
    map.on("style.load", () => {
      // Additive vision overlays (GIBS true-color, EUMETSAT) — added first so
      // they sit below our own markers/points/perimeter, never covering them.
      // Off by default; visibility is restored from the ref so a toggle a
      // user already made survives a basemap switch.
      map.addSource("overlay-gibs", {
        type: "raster",
        tiles: [gibsTrueColorUrl()],
        tileSize: 256,
        maxzoom: 9,
        attribution: "NASA GIBS / VIIRS",
      });
      map.addLayer({
        id: "overlay-gibs-layer",
        type: "raster",
        source: "overlay-gibs",
        layout: { visibility: activeOverlaysRef.current.has("gibs") ? "visible" : "none" },
        paint: { "raster-opacity": 0.85 },
      });

      // MSG/SEVIRI's native resolution is ~3km/pixel, so this renders as
      // big blocky squares when zoomed in close — that's the sensor's real
      // resolution, not a rendering bug (confirmed by inspecting the raw
      // GetMap response directly). Left visible at every zoom on purpose:
      // Carolina wants to keep seeing it rather than have it disappear.
      map.addSource("overlay-eumetsat-msg", {
        type: "raster",
        tiles: [eumetsatWmsUrl("msg_fes:fire")],
        tileSize: 256,
        attribution: "EUMETSAT",
      });
      map.addLayer({
        id: "overlay-eumetsat-msg-layer",
        type: "raster",
        source: "overlay-eumetsat-msg",
        layout: { visibility: activeOverlaysRef.current.has("eumetsat-msg") ? "visible" : "none" },
        paint: { "raster-opacity": 0.85 },
      });

      map.addSource("overlay-eumetsat-mtg", {
        type: "raster",
        tiles: [eumetsatWmsUrl("mtg_fd:rgb_firetemperature")],
        tileSize: 256,
        attribution: "EUMETSAT",
      });
      map.addLayer({
        id: "overlay-eumetsat-mtg-layer",
        type: "raster",
        source: "overlay-eumetsat-mtg",
        layout: { visibility: activeOverlaysRef.current.has("eumetsat-mtg") ? "visible" : "none" },
        paint: { "raster-opacity": 0.85 },
      });

      // Raw hotspot "cloud" for the selected fire, from /api/fires/:id/points.
      // Originally tried NASA GIBS's own hotspot overlay for this but it
      // 404s on literally every tile/date I throw at it (checked with curl,
      // not just in the browser) — probably down on their end. Using our
      // own already-ingested points instead works just as well anyway.
      map.addSource("hotspot-points", {
        type: "geojson",
        data: hotspotPointsRef.current as unknown as GeoJSON.FeatureCollection,
      });
      // Our own estimate (convex hull of the raw detections) — not an
      // official burned-area perimeter. Copernicus EFFIS would give us the
      // real thing but its service has been down all day; see ADR-0005.
      map.addLayer({
        id: "hotspot-perimeter-fill",
        type: "fill",
        source: "hotspot-points",
        filter: ["==", ["get", "kind"], "estimated_perimeter"],
        paint: {
          "fill-color": "#dc2626",
          "fill-opacity": 0.15,
        },
      });
      map.addLayer({
        id: "hotspot-perimeter-outline",
        type: "line",
        source: "hotspot-points",
        filter: ["==", ["get", "kind"], "estimated_perimeter"],
        paint: {
          "line-color": "#dc2626",
          "line-width": 1.5,
          "line-dasharray": [2, 2],
        },
      });
      map.addLayer({
        id: "hotspot-points-circles",
        type: "circle",
        source: "hotspot-points",
        filter: ["==", ["get", "kind"], "hotspot"],
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
            ["get", "status"],
            "active", STATUS_COLOR.active,
            "inactive", STATUS_COLOR.inactive,
            STATUS_COLOR.active,
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Popup reutilizable — se abre en mouseenter (escritorio) y en click
      // (táctil/teclado) para que sea accesible en todos los dispositivos.
      const popup = new Popup({ closeButton: true, offset: 12, className: "fire-popup" });

      function showPopup(feature: MapGeoJSONFeature, lngLat: [number, number]) {
        const props = feature.properties as {
          name?: string;
          desc?: string;
          municipality?: string;
          province?: string;
        };
        const searchQuery = `112 incendio ${[props.municipality, props.province].filter(Boolean).join(" ")}`.trim();
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
        popup
          .setLngLat(lngLat)
          .setHTML(
            `<strong>${escapeHtml(props.name ?? "Incendio sin nombre")}</strong><br/>${escapeHtml(props.desc ?? "")}<br/><em>Detección automática, no sustituye al 112</em><br/><a href="${searchUrl}" target="_blank" rel="noopener noreferrer">Buscar información oficial ↗</a>`,
          )
          .addTo(map);
      }

      map.on("mouseenter", "fire-events-circles", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features?.[0];
        if (!feature) return;
        showPopup(feature, (feature.geometry as GeoJSON.Point).coordinates as [number, number]);
      });
      map.on("mouseleave", "fire-events-circles", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
      map.on("click", "fire-events-circles", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        // En táctil/teclado el mouseenter no se dispara — mostrar popup en click
        if (!popup.isOpen()) {
          showPopup(feature, (feature.geometry as GeoJSON.Point).coordinates as [number, number]);
        }
        const id = feature.properties?.id as string | undefined;
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

  function toggleOverlay(overlay: (typeof OVERLAYS)[number]) {
    const map = mapRef.current;
    if (!map) return;
    setActiveOverlays((prev) => {
      const next = new Set(prev);
      const willBeVisible = !next.has(overlay.id);
      if (willBeVisible) next.add(overlay.id);
      else next.delete(overlay.id);
      if (map.getLayer(overlay.layerId)) {
        map.setLayoutProperty(overlay.layerId, "visibility", willBeVisible ? "visible" : "none");
      }
      return next;
    });
  }

  return (
    <div
      className="relative h-full w-full"
      role="application"
      aria-label="Mapa de incendios forestales en España"
    >
      <div ref={containerRef} className="h-full w-full" />
      <div
        className="absolute bottom-6 left-2 z-10 flex overflow-hidden rounded border border-gray-700 text-xs shadow"
        role="group"
        aria-label="Tipo de mapa base"
      >
        <button
          onClick={() => switchBasemap("streets")}
          aria-pressed={basemap === "streets"}
          aria-label="Vista de calle"
          className={`px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 ${basemap === "streets" ? "bg-gray-800 text-white" : "bg-white text-gray-700"}`}
        >
          Calle
        </button>
        <button
          onClick={() => switchBasemap("satellite")}
          aria-pressed={basemap === "satellite"}
          aria-label="Vista satélite"
          className={`px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 ${basemap === "satellite" ? "bg-gray-800 text-white" : "bg-white text-gray-700"}`}
        >
          Satélite
        </button>
      </div>
      <div
        className="absolute bottom-16 left-2 z-10 flex flex-col gap-1 rounded border border-gray-700 bg-gray-800/90 p-1.5 text-xs shadow"
        role="group"
        aria-label="Capas de visión adicionales"
      >
        {OVERLAYS.map((overlay) => {
          const isOn = activeOverlays.has(overlay.id);
          return (
            <button
              key={overlay.id}
              onClick={() => toggleOverlay(overlay)}
              aria-pressed={isOn}
              title={overlay.title}
              className={`cursor-help rounded px-2 py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 ${
                isOn ? "bg-orange-600 text-white" : "text-gray-300 hover:bg-gray-700"
              }`}
            >
              {overlay.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
