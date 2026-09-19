import { describe, expect, it } from "vitest";
import { locationWeightFor } from "@/lib/campus";

describe("location weight", () => {
  it("scores a hostel washroom from category and text, not a Delhi coordinate", () => {
    expect(
      locationWeightFor("Hostel, second floor", {
        category: "Washroom",
        description: "Flush is broken in the hostel washroom",
      }),
    ).toBe(5);
  });

  it("keeps Wi-Fi / IT at a mid weight unless the place is a lab or library", () => {
    expect(locationWeightFor("IT", { category: "Wi-Fi / network", description: "Router is down" })).toBe(3);
    expect(locationWeightFor("Library, reading room", { category: "Wi-Fi / network", description: "wifi dead" })).toBe(5);
  });

  it("treats a dark path as the highest location weight", () => {
    expect(
      locationWeightFor("Campus, behind the hostels", {
        category: "Road / path / safety",
        description: "Pathway is completely dark at night",
      }),
    ).toBe(5);
  });
});
