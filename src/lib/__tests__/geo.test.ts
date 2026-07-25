import { describe, expect, it } from "vitest";
import { distanceKm, formatDistance } from "../geo";

describe("distanceKm", () => {
  it("returns 0 for the same point", () => {
    expect(distanceKm([-3.7, 40.2], [-3.7, 40.2])).toBe(0);
  });

  it("computes the great-circle distance between Madrid and Barcelona (~500km)", () => {
    const madrid: [number, number] = [-3.7038, 40.4168];
    const barcelona: [number, number] = [2.1734, 41.3851];
    expect(distanceKm(madrid, barcelona)).toBeGreaterThan(480);
    expect(distanceKm(madrid, barcelona)).toBeLessThan(520);
  });
});

describe("formatDistance", () => {
  it("formats sub-km distances in meters", () => {
    expect(formatDistance(0.4)).toBe("a 400 m");
  });

  it("formats km-or-more distances in km", () => {
    expect(formatDistance(12.3)).toBe("a 12 km");
  });
});
