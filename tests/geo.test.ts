import { describe, expect, it } from "vitest";
import { assertIssueLocation, focusPoints, pointInPolygon, rectangleRing } from "@/lib/geo";

describe("point in polygon", () => {
  const square = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 2 },
    { lat: 2, lng: 2 },
    { lat: 2, lng: 0 },
  ];

  it("includes an interior point", () => {
    expect(pointInPolygon({ lat: 1, lng: 1 }, square)).toBe(true);
  });

  it("excludes an exterior point", () => {
    expect(pointInPolygon({ lat: 3, lng: 3 }, square)).toBe(false);
  });

  it("counts a point on the edge as inside", () => {
    expect(pointInPolygon({ lat: 0, lng: 1 }, square)).toBe(true);
  });

  it("builds a rectangle ring from two corners", () => {
    const ring = rectangleRing([
      { lat: 10, lng: 20 },
      { lat: 12, lng: 24 },
    ]);
    expect(ring).toHaveLength(4);
    expect(pointInPolygon({ lat: 11, lng: 22 }, ring)).toBe(true);
    expect(pointInPolygon({ lat: 9, lng: 22 }, ring)).toBe(false);
  });
});

describe("focus points", () => {
  it("keeps a tight campus cluster and drops a far GPS outlier", () => {
    const campus = [
      { lat: 28.61, lng: 77.04 },
      { lat: 28.6102, lng: 77.0401 },
      { lat: 28.611, lng: 77.041 },
    ];
    const mixed = [...campus, { lat: 26.36, lng: 86.53 }];
    expect(focusPoints(mixed)).toEqual(campus);
  });

  it("keeps every pin when they already sit on one campus", () => {
    const campus = [
      { lat: 28.61, lng: 77.04 },
      { lat: 28.6105, lng: 77.0395 },
    ];
    expect(focusPoints(campus)).toEqual(campus);
  });
});


describe("optional reporting area", () => {
  it("allows global locations with no area, restricts a saved area, and reopens after removal", () => {
    const boundary = { type: "rectangle" as const, vertices: [{lat:10,lng:10},{lat:11,lng:11}], updated_at: new Date().toISOString() };
    expect(() => assertIssueLocation(-33.86,151.21,null)).not.toThrow();
    expect(() => assertIssueLocation(10.5,10.5,boundary)).not.toThrow();
    expect(() => assertIssueLocation(-33.86,151.21,boundary)).toThrow(/outside/);
    expect(() => assertIssueLocation(-33.86,151.21,null)).not.toThrow();
  });
});
