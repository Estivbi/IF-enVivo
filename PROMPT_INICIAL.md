# FOCOS — Sistema de detección y visualización de incendios en tiempo real
### Spec técnica para Claude Code

---

## 1. Objetivo

Construir una web pública que **detecta incendios automáticamente** a partir de datos satelitales — sin listas mantenidas a mano — y los muestra en un mapa en tiempo casi real. Genérico: debe funcionar igual para Burgohondo que para cualquier incendio futuro en España (o ampliable a otros países).

No es un dashboard de un incendio concreto: es un **pipeline de detección + servicio de datos + frontend**, tres piezas desacopladas.

---

## 2. Arquitectura general

```
NASA FIRMS API (VIIRS/MODIS hotspots)
        │  cron cada 20-30 min
        ▼
┌─────────────────────────────┐
│  Worker de ingesta + cluster │  → Python (FastAPI/Celery beat) o Node (Vercel Cron)
│  - fetch CSV FIRMS           │
│  - DBSCAN espacio-temporal   │
│  - reverse geocoding (Nominatim) │
│  - upsert en Neon Postgres   │
└─────────────────────────────┘
        │
        ▼
   Neon Postgres (fire_events + hotspot_points)
        │
        ▼
   API pública /api/fires (Next.js route, GeoJSON)
        │
        ▼
   Frontend Next.js 15 + MapLibre GL
```

**Decisión de infraestructura — dos caminos, elegir uno:**

- **A) MVP rápido, todo en Vercel**: Next.js con API routes + Vercel Cron Jobs ejecutando el fetch+cluster en Node (usar `density-clustering` o `turf.js` para DBSCAN). Cero infra nueva, todo serverless, gratis en el tier actual de Vercel/Neon.
- **B) Agente Stibios nº6**: reutilizar el patrón ya existente (FastAPI + Celery beat + Redis + Docker en el Mac Mini/Hetzner) como un agente más junto a Dev Briefing, News Intelligence, etc. Mejor si luego quieres que este pipeline razone con LLM (p.ej. resumir noticias del 112 con Gemini) o si quieres reutilizar la cola de Celery ya montada.

Recomendación: empezar por **A** para tener algo funcionando esta semana; migrar a **B** solo si el proyecto crece (p.ej. añades scraping de 112 + resumen con IA).

Sin servicios de pago: FIRMS, Nominatim, GIBS y Neon free tier cubren todo el flujo.

---

## 3. Fuente de datos y algoritmo de detección

### 3.1 NASA FIRMS API
- Registrar `MAP_KEY` gratis: https://firms.modaps.eosdis.nasa.gov/api/map_key/
- Endpoint de área (últimas 24-48h, VIIRS NOAA-20 NRT, bbox España peninsular + Baleares + Canarias):
  ```
  https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/VIIRS_NOAA20_NRT/-9.8,27.5,4.4,43.9/2
  ```
- Columnas relevantes: `latitude, longitude, brightness, confidence, acq_date, acq_time, frp` (Fire Radiative Power — proxy de intensidad).
- Límite: 5000 transacciones / 10 min. Con un cron cada 20-30 min sobra de margen.

### 3.1b Fuentes satelitales adicionales (opcional, no bloqueante para el MVP)
FIRMS es suficiente para arrancar, pero puede complementarse más adelante:
- **Copernicus EFFIS** (JRC/UE): API WFS/WMS gratuita, específica de incendios en Europa, con perímetros de área quemada y su propio feed de focos activos. Útil como verificación cruzada: si un cluster de FIRMS coincide con un foco de EFFIS, sube la confianza del `fire_event`.
- **Meteosat / LSA SAF Fire Product** (EUMETSAT): satélite geoestacionario, actualiza cada 15 min (frente a las 2-4 pasadas/día de VIIRS por ser polar), a cambio de peor resolución (~3km). Gratis con registro. Pensado para v2, no para el MVP — reduce la latencia de detección a costa de precisión espacial.

No añadir ninguna de las dos en la v1: mantener el pipeline simple con FIRMS solo hasta que el clustering y la API estén sólidos.

### 3.2 Clustering espacio-temporal (esto es "la detección")
Los puntos crudos de FIRMS son detecciones individuales de píxel, no incendios. Hay que agruparlos:

1. Filtrar puntos con `confidence != low` de las últimas 48h.
2. DBSCAN con `eps ≈ 2.5 km` (convertir a grados aprox. o usar distancia haversine), `min_samples = 3`.
3. Cada cluster resultante = un incendio candidato. Calcular:
   - `centroid` (lat/lon medio)
   - `point_count`
   - `max_frp`, `sum_frp`
   - `first_seen` / `last_seen` (min/max de `acq_date+acq_time` del cluster)
   - `bbox` del cluster → estimación de hectáreas (área del hull convexo)
4. **Persistencia entre ejecuciones**: al recalcular, matchear cada cluster nuevo con el `fire_event` existente más cercano (< 5 km del centroid anterior) para mantener el mismo ID a lo largo de los días en vez de crear un incendio nuevo cada vez. Si no hay match → nuevo `fire_event`.
5. **Cierre automático**: si un `fire_event` no recibe puntos nuevos en 24h, marcar `status = 'inactive'`.
6. **Nivel de gravedad heurístico** (no oficial, solo indicativo — dejar claro en la UI que el nivel real del 112 puede diferir):
   - `level 2` si `sum_frp` en últimas 6h supera un umbral y el cluster crece (`point_count` sube respecto a la ejecución anterior)
   - `level 1` si hay actividad pero estable/decreciente
   - `level 0` si inactivo

### 3.3 Nombrado automático
Reverse geocoding del centroid con Nominatim (OpenStreetMap, gratis, respetar rate limit de 1 req/seg):
```
https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json&zoom=12
```
Nombrar el incendio como `"Incendio de {municipio} ({provincia})"`. Cachear el resultado en el propio `fire_event` para no volver a pedirlo.

---

## 4. Esquema de base de datos (Neon Postgres)

```sql
CREATE TABLE fire_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,                    -- generado por reverse geocoding
  municipality TEXT,
  province TEXT,
  centroid_lat DOUBLE PRECISION NOT NULL,
  centroid_lon DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active | inactive
  level SMALLINT NOT NULL DEFAULT 0,      -- 0,1,2 heurístico
  point_count INT NOT NULL DEFAULT 0,
  max_frp REAL,
  sum_frp REAL,
  est_hectares REAL,
  first_detected_at TIMESTAMPTZ NOT NULL,
  last_detected_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hotspot_points (
  id BIGSERIAL PRIMARY KEY,
  fire_event_id UUID REFERENCES fire_events(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  acq_at TIMESTAMPTZ NOT NULL,
  frp REAL,
  confidence TEXT,
  satellite TEXT
);

CREATE INDEX idx_fire_events_status ON fire_events(status);
CREATE INDEX idx_hotspot_points_event ON hotspot_points(fire_event_id);
```

---

## 5. API pública

`GET /api/fires` → GeoJSON `FeatureCollection`, un `Feature` por `fire_event` activo (o `?status=all` para históricos), con `properties` = todos los campos de la tabla. Cachear con `revalidate: 60` (ISR) o `stale-while-revalidate` para no golpear la DB en cada carga del frontend.

`GET /api/fires/:id/points` → puntos crudos de un incendio concreto (para mostrar la "nube" de detecciones al hacer zoom).

---

## 6. Frontend (Next.js 15)

- Reutilizar el patrón de **MadRing Guide** (Next.js 15 + MapLibre GL + Serwist + Vercel).
- Ruta `/` — dashboard completo (como el prototipo ya hecho: sidebar con lista, capa GIBS de calor, toggles de basemap).
- Los marcadores, niveles y descripciones **ya no se editan a mano**: todo sale de `/api/fires`. El `desc` se puede generar como texto simple: `"{point_count} focos activos · FRP máx {max_frp} MW · detectado desde {first_detected_at}"`.
- Mantener capa NASA GIBS (VIIRS) como overlay visual además de los marcadores clusterizados — son complementarios: GIBS da la textura de calor cruda, los `fire_events` dan el resumen.

---

## 7. Variables de entorno

```
FIRMS_MAP_KEY=...          # firms.modaps.eosdis.nasa.gov/api/map_key
DATABASE_URL=...           # Neon
NOMINATIM_USER_AGENT=...   # requerido por la policy de uso de Nominatim
CRON_SECRET=...            # si se protege el endpoint de cron con un token
```

---

## 8. Tareas para Claude Code (orden sugerido)

1. Scaffold Next.js 15 + TypeScript + Tailwind, conectar Neon (Drizzle o Prisma, lo que ya uses en otros proyectos).
2. Migración SQL del esquema de §4.
3. Endpoint interno `/api/cron/ingest` (protegido con `CRON_SECRET`): fetch FIRMS → parseo CSV → clustering DBSCAN → matching con eventos existentes → upsert. Configurar en `vercel.json` un cron cada 20 min.
4. Reverse geocoding perezoso (solo si `name IS NULL`) para no saturar Nominatim.
5. Endpoint público `/api/fires`.
6. Página `/` (dashboard completo, reusar diseño ya validado del prototipo HTML/Leaflet que ya tengo — migrar a MapLibre GL + React).
7. Tests: un test unitario del clustering con un CSV de ejemplo fijo (fixture), verificando que N puntos cercanos generan 1 evento y puntos lejanos generan eventos separados.
8. Deploy en Vercel, dominio tipo `focos.stibios.com`.

---

## 9. Notas de honestidad de datos (importante para la UI)

- Los hotspots satelitales tienen retraso de 1-3h y **no equivalen** a nivel oficial de gravedad (IGR) del 112 — dejar un disclaimer visible en la UI.
- VIIRS/MODIS pueden fallar en detectar incendios bajo nubes densas o humo muy espeso.
- El `level` calculado es heurístico propio, no el índice oficial autonómico — nombrarlo así en la interfaz ("nivel estimado") para no inducir a error.
