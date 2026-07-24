import Papa from "papaparse";

// Bbox: España peninsular + Baleares + Canarias
const SPAIN_BBOX = "-9.8,27.5,4.4,43.9";
const DAYS_BACK = 2;

export type RawHotspot = {
  lat: number;
  lon: number;
  brightness: number;
  confidence: string;
  acqAt: Date;
  frp: number;
  satellite: string;
};

type FirmsCsvRow = {
  latitude: string;
  longitude: string;
  brightness: string;
  confidence: string;
  acq_date: string;
  acq_time: string;
  frp: string;
};

function parseAcqDateTime(acqDate: string, acqTime: string): Date {
  const hhmm = acqTime.padStart(4, "0");
  const hh = hhmm.slice(0, 2);
  const mm = hhmm.slice(2, 4);
  return new Date(`${acqDate}T${hh}:${mm}:00Z`);
}

export async function fetchFirmsHotspots(
  mapKey: string,
  source: string = "VIIRS_NOAA20_NRT",
): Promise<RawHotspot[]> {
  // Never log `url` — it embeds FIRMS_MAP_KEY in the path.
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/${source}/${SPAIN_BBOX}/${DAYS_BACK}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`FIRMS request failed: ${res.status} ${res.statusText}`);
  }
  const csv = await res.text();
  return parseFirmsCsv(csv, source);
}

export function parseFirmsCsv(csv: string, satellite: string): RawHotspot[] {
  const parsed = Papa.parse<FirmsCsvRow>(csv.trim(), {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data
    .filter((row) => row.latitude && row.longitude)
    .map((row) => ({
      lat: Number(row.latitude),
      lon: Number(row.longitude),
      brightness: Number(row.brightness),
      confidence: row.confidence,
      acqAt: parseAcqDateTime(row.acq_date, row.acq_time),
      frp: Number(row.frp),
      satellite,
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
}

// VIIRS confidence: "l" | "n" | "h". MODIS confidence: 0-100 numeric string.
export function isLowConfidence(confidence: string): boolean {
  const c = confidence.trim().toLowerCase();
  if (c === "l" || c === "low") return true;
  const numeric = Number(c);
  if (Number.isFinite(numeric)) return numeric < 30;
  return false;
}

