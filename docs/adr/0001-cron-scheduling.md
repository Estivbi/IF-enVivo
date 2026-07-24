# ADR-0001: Disparo del cron de ingesta (`/api/cron/ingest`)

## Contexto
`PROMPT_INICIAL.md` §8.3 pide un cron cada 20 min contra `/api/cron/ingest`,
configurado inicialmente en `vercel.json`. Vercel Cron Jobs en el plan Hobby
(gratuito) solo admite una ejecución al día — cualquier expresión más
frecuente bloquea el deploy con "Upgrade to the Pro plan". Un cron diario no
sirve: rompe el requisito de detección en tiempo casi real.

## Opciones consideradas
1. **Vercel Pro** (~20 USD/mes) — desbloquea cron cada 20 min sin cambiar nada
   más. Descartado: viola el principio "cero servicios de pago" de
   `CLAUDE.md`.
2. **cron-job.org** (u otro cron externo gratuito) — hace `GET` periódico a
   la URL pública con el header `Authorization`. Gratis, pero añade una
   cuenta y un dashboard más que mantener fuera del repo.
3. **GitHub Actions `schedule`** — el repo ya vive en GitHub; un workflow con
   `cron: '*/20 * * * *'` hace `curl` al endpoint. Gratis (Actions públicas o
   minutos incluidos en repos privados), versionado como código junto al
   resto del proyecto, sin cuenta externa nueva.

## Decisión
GitHub Actions (opción 3). El schedule vive en
`.github/workflows/cron-ingest.yml`, autenticado con el mismo `CRON_SECRET`
que ya protegía el endpoint. Se retira el bloque `crons` de `vercel.json`
(bloqueaba el deploy en Hobby).

## Consecuencias
- Se gana: cero coste recurrente, todo el disparo queda versionado en el
  repo, mismo mecanismo de auth (`CRON_SECRET`) que ya existía.
- Se sacrifica: GitHub Actions no garantiza el minuto exacto bajo carga alta
  de la plataforma (retraso ocasional de minutos) — aceptable para un
  pipeline de detección con ventana de 20 min y datos FIRMS que ya llegan
  con 1-3h de retraso propio.
- Requiere 2 secrets nuevos en GitHub (Settings → Secrets and variables →
  Actions): `CRON_SECRET` (el mismo valor que en Vercel) y `INGEST_URL` (la
  URL pública de producción, p.ej. `https://focos.vercel.app/api/cron/ingest`).

## Quién debe implementarlo
`@backend` (workflow + retirada del cron de `vercel.json`).
