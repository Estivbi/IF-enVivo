# ADR-0005: Polígono propio (casco convexo) mientras Copernicus EFFIS no responde

## Contexto
Se quería mostrar la superficie quemada real de cada incendio, no solo los
puntos de detección. La opción preferida era Copernicus EFFIS (perímetros
oficiales de área quemada, gratis, sin clave — ver conversación previa), pero
su servicio de mapas (`maps.effis.emergency.copernicus.eu`) lleva caído
(502/timeout, intermitente) desde antes de las 12:00 del 24/07/2026, en
múltiples comprobaciones a lo largo de varias horas.

## Opciones consideradas
1. Esperar a que EFFIS vuelva antes de mostrar nada.
2. Pintar ya un polígono propio (casco convexo de los `hotspot_points` de
   cada incendio) como aproximación, dejando claro que no es un perímetro
   oficial, y sustituirlo/complementarlo por EFFIS en cuanto responda.

## Decisión
Opción 2. `src/lib/clustering.ts` ya calculaba el área de este casco convexo
(`est_hectares`) pero no exponía las coordenadas del polígono en sí — se
extrajo `convexHull()` como función reutilizable. `/api/fires/:id/points`
ahora incluye, además de los puntos, un Feature de tipo `Polygon` con
`properties.kind = "estimated_perimeter"`. El mapa lo pinta como relleno
semitransparente con borde discontinuo, claramente distinto visualmente de
los incendios activos y con su propia entrada en la leyenda.

## Consecuencias
- Se gana: superficie visual ya disponible hoy, sin depender de un servicio
  externo caído, con datos que ya teníamos.
- Se sacrifica: es una aproximación (el casco convexo de puntos activos
  sobrestima o infraestima el área real quemada dependiendo de la forma del
  incendio) — no es un perímetro oficial. Etiquetado como tal en la leyenda
  y en el propio nombre de la propiedad (`estimated_perimeter`).
- Pendiente: sustituir o complementar por los perímetros reales de EFFIS en
  cuanto su servicio vuelva a responder (hay una comprobación programada).

## Quién debe implementarlo
`@backend` (`convexHull`, endpoint) + `@frontend` (capa del mapa, leyenda).
