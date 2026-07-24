# FOCOS

Detección automática de incendios a partir de datos satelitales (NASA FIRMS/VIIRS),
mostrados en un mapa en tiempo casi real. Genérico: sin listas de incendios
mantenidas a mano — todo sale de un pipeline de clustering espacio-temporal.

Pipeline de detección + API + frontend — genérico para cualquier incendio en
España, sin listas mantenidas a mano.

## Stack

- Next.js 15 + TypeScript + Tailwind + MapLibre GL
- Drizzle ORM + Neon Postgres
- NASA FIRMS (VIIRS NRT) + reverse geocoding con Nominatim
- Vercel (hosting) + GitHub Actions (disparo del cron — ver ADR-0001)

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # rellenar FIRMS_MAP_KEY, DATABASE_URL, NOMINATIM_USER_AGENT, CRON_SECRET
npm run db:push              # crea el esquema en Neon a partir de src/db/schema.ts
npm run dev
```

- `npm test` — tests unitarios (clustering, parseo FIRMS, matching de eventos)
- `npm run lint` — lint
- `npm run build` — build de producción
- `npm run db:studio` — explorar la base de datos con Drizzle Studio

## Pipeline de ingesta

`GET /api/cron/ingest` (protegido con `CRON_SECRET` vía `Authorization: Bearer`)
hace fetch de FIRMS, filtra confianza baja, agrupa con DBSCAN
(`src/lib/clustering.ts`), matchea contra `fire_events` existentes
(`src/lib/matching.ts`), geocodifica de forma perezosa
(`src/lib/geocode.ts`) y cierra eventos inactivos tras 24h sin puntos nuevos.
El disparo cada 20 min corre por [GitHub Actions](./.github/workflows/cron-ingest.yml)
en vez de Vercel Cron Jobs — el plan Hobby (gratis) de Vercel solo permite
crons diarios, ver [ADR-0001](./docs/adr/0001-cron-scheduling.md). Requiere
dos secrets en el repo (Settings → Secrets and variables → Actions):

- `CRON_SECRET` — el mismo valor que en las env vars de Vercel
- `INGEST_URL` — la URL pública de producción, p.ej.
  `https://focos.vercel.app/api/cron/ingest`

Para probarlo en local sin esperar al cron:

```bash
curl -X POST http://localhost:3000/api/cron/ingest \
  -H "Authorization: Bearer $CRON_SECRET"
```

## API pública

- `GET /api/fires` — GeoJSON de `fire_events` (`?status=active|all`)
- `GET /api/fires/:id/points` — puntos crudos de un incendio concreto

Ambos llevan rate limiting (60 req/min por IP) respaldado en la propia tabla
`rate_limit_buckets` de Neon — sin servicio externo, gratis (`src/lib/rate-limit.ts`).
La caché (`Cache-Control: s-maxage=60`) cubre el tráfico normal; el rate
limit cubre a quien varía el query string para saltarse esa caché.

## Notas de honestidad de datos

Los hotspots satelitales tienen retraso de 1-3h y **nunca sustituyen** al
aviso oficial del 112. El estado mostrado (`active`/`inactive`) es
deliberadamente simple: solo indica si ha habido detecciones nuevas en las
últimas 24h, sin inventar niveles de gravedad ni tendencias (ver ADR-0002
y ADR-0004 en `docs/adr/`). VIIRS puede fallar bajo nubes densas o humo
espeso.
