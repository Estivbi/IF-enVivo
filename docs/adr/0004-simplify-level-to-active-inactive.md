# ADR-0004: Quitar el nivel "estable/creciendo" — solo activo/inactivo

## Contexto
ADR-0002 ya había quitado el umbral de FRP inventado, dejando `level` (2 =
creciendo, 1 = estable) basado solo en si `point_count` subía entre
ejecuciones del cron. En uso real esto seguía generando confusión: todos
los incendios mostraban la misma etiqueta durante horas, y no quedaba claro
de dónde salía el dato. Al revisarlo con Carol, el problema de fondo es que
"focos detectados por el satélite en esta pasada" es un proxy ruidoso —
varía por ángulo de la pasada, nubosidad, hora del día — no por si el
incendio realmente crece o no. No es un dato en el que se pueda confiar.

## Opciones consideradas
1. Mantener el cálculo actual pero explicarlo mejor en la UI (tooltip).
2. Simplificar a solo `active`/`inactive` — el único estado respaldado por
   un dato 100% real y verificable: ¿ha tenido detecciones nuevas en las
   últimas 24h o no?

## Decisión
Opción 2. Se eliminan las columnas `level` y `times_observed` de
`fire_events` (migración `drizzle/0003_drop_level.sql`), la función
`computeLevel` de `src/lib/matching.ts`, y toda mención a "nivel estimado"
en el frontend. El badge ahora solo dice "Activo" o "Inactivo".

## Consecuencias
- Se gana: cero interpretación inventada — cada estado mostrado se puede
  verificar directamente (`last_detected_at` dentro de las últimas 24h).
- Se sacrifica: no hay ninguna señal de tendencia (creciendo/decreciendo) en
  la UI. Si en el futuro se quiere recuperar esa información, debería venir
  de una fuente real (p.ej. perímetros de área quemada de Copernicus EFFIS,
  ver conversación sobre superficie quemada) en vez de inferirse del ruido
  de detección del propio FIRMS.

## Quién debe implementarlo
`@backend` (schema, ingest, matching) + `@frontend` (sidebar, popup del mapa).
