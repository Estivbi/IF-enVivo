# ADR-0002: Nivel heurístico sin umbral de FRP inventado

## Contexto
`PROMPT_INICIAL.md` §3.2.6 pedía `level = 2` cuando `sum_frp` en las últimas
6h superase "un umbral", sin especificar cuál. Al implementarlo se usó un
valor provisional (50 MW) sin ninguna base — ni oficial ni derivada de datos
reales, porque el pipeline nunca había corrido contra incendios reales.

## Opciones consideradas
1. **Mantener un umbral de FRP inventado**, configurable por env var para
   ajustarlo más adelante con datos reales.
2. **Eliminar el umbral de FRP y basar el nivel solo en la tendencia
   observada** (¿el `point_count` del cluster crece respecto a la ejecución
   anterior del cron?), sin ningún número de intensidad inventado.

## Decisión
Opción 2. La gravedad real de un incendio (nivel IGR) es una decisión de las
autoridades (112), no de este pipeline — inventar un número de MW para
aproximarla es dar una falsa sensación de precisión. `level` se reduce a:
- `2` si el cluster tiene más puntos que en la ejecución anterior (creciendo)
- `1` si está activo pero estable o decreciente
- `0` si está inactivo (sin puntos nuevos en 24h)

Ningún dato de intensidad (FRP) entra en esta decisión — solo el recuento de
detecciones entre ejecuciones, que es puramente observacional.

## Consecuencias
- Se gana: cero números inventados en la lógica de nivel; más honesto con
  la sección "honestidad de datos" de `CLAUDE.md`.
- Se sacrifica: un incendio con FRP muy alta pero estable (ni creciendo ni
  apagándose) no se distingue de uno pequeño y estable — ambos son `level 1`.
  Aceptable: la intensidad real (`sum_frp`, `max_frp`) sigue expuesta tal
  cual en `/api/fires` para quien quiera leerla directamente, solo que no
  se traduce en un "nivel" heurístico.

## Quién debe implementarlo
`@backend` (`src/lib/matching.ts`).
