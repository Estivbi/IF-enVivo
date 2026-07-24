# FOCOS

Detección automática de incendios a partir de datos satelitales (NASA FIRMS/VIIRS),
mostrados en un mapa en tiempo casi real. Genérico: sin listas de incendios
mantenidas a mano — todo sale de un pipeline de clustering espacio-temporal.

Ver [`CLAUDE.md`](./CLAUDE.md) para el contexto del proyecto y
[`PROMPT_INICIAL.md`](./PROMPT_INICIAL.md) para la spec técnica completa.

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

## Notas de honestidad de datos

Los hotspots satelitales tienen retraso de 1-3h y **no son** el nivel oficial
de gravedad (IGR) del 112. El `level` (0/1/2) es un cálculo heurístico
propio — se muestra siempre como "estimado" en la interfaz, nunca como dato
oficial. VIIRS puede fallar bajo nubes densas o humo espeso.

## Equipo de agentes (Claude Code)

Ver [`.claude/agents/`](./.claude/agents/): `arquitecto`, `backend`,
`frontend`, `seguridad`, `pr-reviewer`. Flujo recomendado para cualquier
feature nueva en `CLAUDE.md`.
