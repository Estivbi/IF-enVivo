const NOMINATIM_MIN_INTERVAL_MS = 1000; // Nominatim usage policy: max 1 req/sec
let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  const wait = NOMINATIM_MIN_INTERVAL_MS - elapsed;
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestAt = Date.now();
}

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  province?: string;
  state?: string;
  country_code?: string;
};

export type GeocodedPlace = {
  name: string;
  municipality: string | null;
  province: string | null;
  countryCode: string | null;
};

/**
 * Reverse-geocodes a fire_event centroid via Nominatim. Rate-limited to
 * 1 req/sec (module-level throttle) — call only lazily, when
 * fire_events.name IS NULL, and cache the result in the DB row.
 */
export async function reverseGeocode(
  lat: number,
  lon: number,
  userAgent: string,
): Promise<GeocodedPlace> {
  await throttle();

  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=12`;
  const res = await fetch(url, {
    headers: { "User-Agent": userAgent },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Nominatim request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { address?: NominatimAddress };
  const address = data.address ?? {};

  const municipality =
    address.city ?? address.town ?? address.village ?? address.municipality ?? null;
  const province = address.province ?? address.state ?? null;

  const name =
    municipality && province
      ? `Incendio de ${municipality} (${province})`
      : municipality
        ? `Incendio de ${municipality}`
        : "Incendio sin municipio identificado";

  return {
    name,
    municipality,
    province,
    countryCode: address.country_code ?? null,
  };
}

// The FIRMS bbox (PROMPT_INICIAL.md §3.1) also catches northern Algeria and
// Morocco — filter to Spain only once we know the country from geocoding.
export function isSpain(place: GeocodedPlace): boolean {
  return place.countryCode === "es";
}
