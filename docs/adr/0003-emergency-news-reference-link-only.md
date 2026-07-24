# ADR-0003: Info de emergencias — enlace de referencia, sin scraping

## Contexto
Se propuso enriquecer `fire_events` con noticias de servicios de emergencia
(112, Protección Civil), posiblemente extraídas de cuentas verificadas de
X/Twitter.

## Opciones consideradas
1. **Scraping de X sin su API oficial.** Descartado sin discusión: viola
   los Términos de Servicio de X (prohíben expresamente el scraping
   automatizado), independientemente del coste.
2. **API oficial de X (lectura).** El tier gratuito no da acceso de lectura
   útil; el más barato con lectura real ronda ~100 USD/mes — un servicio de
   pago recurrente que viola el principio "cero servicios de pago" de
   `CLAUDE.md`. Requeriría ADR propio con aprobación explícita si se
   quisiera adoptar más adelante.
3. **Feeds RSS/Atom oficiales de 112 autonómicos.** Gratis y legal donde
   existan, pero no todas las comunidades autónomas publican uno, y mapear
   incendio → comunidad → feed es trabajo de investigación previo no hecho
   todavía. Queda como posible ampliación futura, no descartado.
4. **Enlace de referencia, sin ingesta.** Cada `fire_event` muestra un
   enlace saliente ("Buscar información oficial ↗") a una búsqueda con el
   municipio/provincia — el usuario decide qué fuente consultar y verifica
   por su cuenta. Cero scraping, cero coste, cero riesgo legal.

## Decisión
Opción 4, con la variante de "enlace saliente sin copiar contenido"
(nunca se reproduce texto de terceros dentro de FOCOS, solo se linka).
Implementado en el sidebar (`src/components/sidebar.tsx`) y en el popup del
mapa (`src/components/fires-map.tsx`).

## Consecuencias
- Se gana: nada que mantener, nada que viole ToS, cero coste, disponible ya.
- Se sacrifica: no hay datos de emergencia dentro de la propia UI — el
  usuario tiene que salir de FOCOS para verificar. Aceptable para una v1;
  la opción 3 (feeds oficiales) queda documentada como candidata para
  cuando se investigue qué comunidades autónomas los publican.

## Quién debe implementarlo
`@frontend` (ya implementado — enlace de búsqueda, sin backend nuevo).
