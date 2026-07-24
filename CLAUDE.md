# FOCOS — Contexto del proyecto

## Qué es
Web pública que **detecta incendios automáticamente** a partir de datos
satelitales (NASA FIRMS/VIIRS) y los muestra en un mapa en tiempo casi real.
No es un dashboard de un incendio concreto: es un pipeline de detección + API
+ frontend. Genérico para cualquier incendio, en cualquier momento, sin
listas mantenidas a mano.

Marca personal: **Stibios** (no es una empresa registrada — no presentarlo
como tal en ningún texto ni commit).

## Por qué existe
Nació a raíz del incendio de Burgohondo (Ávila, jul 2026). El objetivo no es
cubrir un incendio, sino tener una herramienta reutilizable para cualquiera.

## Stack
- **Frontend**: Next.js 15 + TypeScript + Tailwind + MapLibre GL (mismo patrón
  que MadRing Guide).
- **Backend**: API routes de Next.js + Vercel Cron Jobs (nada de servidor
  dedicado en esta v1 — ver ADR-001 si el arquitecto decide migrar a un agente
  Stibios con FastAPI/Celery/Redis más adelante).
- **DB**: Neon Postgres.
- **Fuente de datos**: NASA FIRMS API (VIIRS NRT), reverse geocoding con
  Nominatim (OSM).
- **Deploy**: Vercel.

## Principio de arquitectura (heredado del SearchMO Playbook, aplicado donde
tiene sentido en este proyecto — no es un sistema de ranking, así que solo
aplican los principios generales, no los específicos de ML):
- **Sin servicios de pago.** FIRMS, Nominatim, GIBS, Neon (free tier), Vercel
  (free tier) — todo gratuito. Si algún agente propone añadir un servicio de
  pago, debe pasar por `@arquitecto` primero y quedar documentado.
- Nada de artefactos pesados baked-in en el build; si algún día hay caché de
  tiles o datos grandes, van a un bucket, no al repo.
- CI en cada PR: tests + build limpio antes de mergear. No hay push directo a
  main.

## Decisión clave de producto: detección automática, no manual
El pipeline agrupa (clustering DBSCAN espacio-temporal) los puntos crudos de
FIRMS en "incendios" (`fire_events`), les da nombre por geocodificación
inversa, y mantiene su identidad entre ejecuciones del cron. **Nunca** se
edita una lista de incendios a mano — si alguien propone eso, es un paso
atrás en el diseño.

## Honestidad de datos (aplica a cualquier texto que se muestre al usuario)
- Los hotspots satelitales tienen retraso de 1-3h y **no son** el nivel
  oficial de gravedad (IGR) del 112 — todo `level` calculado por el sistema
  debe etiquetarse como "estimado", nunca como oficial.
- VIIRS/MODIS pueden fallar bajo nubes densas o humo espeso — no prometer
  cobertura total en ningún copy de la interfaz.

## Variables de entorno
```
FIRMS_MAP_KEY=...
DATABASE_URL=...
NOMINATIM_USER_AGENT=...
CRON_SECRET=...
```

## Especificación técnica completa
El detalle de arquitectura, esquema SQL, algoritmo de clustering y endpoints
está en `PROMPT_INICIAL.md`, en la raíz del paquete de entrega. Léelo antes de
tocar código — `@arquitecto` lo usa como base para el primer ADR.

## Equipo de agentes de este repo
Ver `.claude/agents/`. Roles: `arquitecto`, `backend`, `frontend`, `seguridad`,
`pr-reviewer`. Invocación explícita con `@nombre-agente` en Claude Code.
Flujo recomendado para cualquier feature nueva:
`@arquitecto` (decide diseño) → `@backend`/`@frontend` (implementan) →
`@seguridad` (si toca datos públicos o el endpoint de cron) →
`@pr-reviewer` (último filtro antes de merge a main).
