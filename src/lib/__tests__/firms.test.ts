import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isLowConfidence, parseFirmsCsv } from "../firms";

const fixtureCsv = readFileSync(
  join(__dirname, "fixtures/sample_firms.csv"),
  "utf-8",
);

describe("parseFirmsCsv", () => {
  it("parses all rows with numeric lat/lon/frp", () => {
    const points = parseFirmsCsv(fixtureCsv, "VIIRS_NOAA20_NRT");
    expect(points).toHaveLength(9);
    expect(points[0]).toMatchObject({
      lat: 40.36,
      lon: -4.66,
      confidence: "h",
      satellite: "VIIRS_NOAA20_NRT",
    });
    expect(points[0].acqAt.toISOString()).toBe("2026-07-20T01:30:00.000Z");
  });
});

describe("isLowConfidence", () => {
  it("flags VIIRS low-confidence letter codes", () => {
    expect(isLowConfidence("l")).toBe(true);
    expect(isLowConfidence("n")).toBe(false);
    expect(isLowConfidence("h")).toBe(false);
  });

  it("flags MODIS numeric confidence below 30", () => {
    expect(isLowConfidence("15")).toBe(true);
    expect(isLowConfidence("75")).toBe(false);
  });
});
