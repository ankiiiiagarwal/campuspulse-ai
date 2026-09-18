export interface Building {
  id: string;
  name: string;
  lat: number;
  lng: number;
  locationWeight: number;
}

/** Editable campus box — fictional North Ridge campus, Delhi NCR-ish. */
export const CAMPUS = {
  name: "North Ridge Campus",
  center: { lat: 28.6102, lng: 77.0379 },
  bounds: {
    south: 28.6078,
    west: 77.0352,
    north: 28.6126,
    east: 77.0404,
  },
  defaultZoom: 17,
};

export const BUILDINGS: Building[] = [
  { id: "library", name: "Library", lat: 28.6108, lng: 77.0385, locationWeight: 5 },
  { id: "hostel-a", name: "Hostel A", lat: 28.6092, lng: 77.0368, locationWeight: 5 },
  { id: "hostel-b", name: "Hostel B", lat: 28.609, lng: 77.0378, locationWeight: 5 },
  { id: "lecture-hall", name: "Lecture Hall Complex", lat: 28.6105, lng: 77.0372, locationWeight: 4 },
  { id: "academic", name: "Academic Block", lat: 28.611, lng: 77.037, locationWeight: 4 },
  { id: "mess", name: "Mess", lat: 28.6094, lng: 77.0386, locationWeight: 5 },
  { id: "admin", name: "Admin Block", lat: 28.6112, lng: 77.0388, locationWeight: 3 },
  { id: "labs", name: "Lab Block", lat: 28.6102, lng: 77.0365, locationWeight: 5 },
  { id: "main-road", name: "Main Road", lat: 28.6114, lng: 77.038, locationWeight: 5 },
  { id: "garden", name: "Garden", lat: 28.61, lng: 77.0392, locationWeight: 2 },
  { id: "parking", name: "Parking", lat: 28.6096, lng: 77.036, locationWeight: 2 },
  { id: "sports", name: "Sports Complex", lat: 28.6086, lng: 77.0382, locationWeight: 3 },
];

export function buildingByName(name: string): Building | undefined {
  const needle = name.trim().toLowerCase();
  return BUILDINGS.find(
    (b) => b.name.toLowerCase() === needle || b.id === needle || needle.includes(b.id.replace("-", " ")),
  );
}

export function buildingById(id: string): Building | undefined {
  return BUILDINGS.find((b) => b.id === id);
}

export function nearestBuilding(lat: number, lng: number): Building {
  let best = BUILDINGS[0];
  let bestD = Number.POSITIVE_INFINITY;
  for (const b of BUILDINGS) {
    const d = (b.lat - lat) ** 2 + (b.lng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

export function locationWeightFor(buildingName: string): number {
  return buildingByName(buildingName)?.locationWeight ?? 3;
}

export function inferBuildingFromText(text: string): Building | undefined {
  const t = text.toLowerCase();
  const aliases: Array<[string[], string]> = [
    [["library", "lib "], "library"],
    [["hostel b", "hostel-b", "b-block hostel", "hostel b "], "hostel-b"],
    [["hostel a", "hostel-a", "a-block hostel"], "hostel-a"],
    [["lecture", "lhc", "lh "], "lecture-hall"],
    [["academic"], "academic"],
    [["mess", "canteen", "dining"], "mess"],
    [["admin"], "admin"],
    [["lab", "labs"], "labs"],
    [["main road", "main gate", "pathway", "path way"], "main-road"],
    [["garden", "lawn"], "garden"],
    [["parking"], "parking"],
    [["sports", "ground"], "sports"],
    [["hostel"], "hostel-b"],
  ];
  for (const [words, id] of aliases) {
    if (words.some((w) => t.includes(w))) return buildingById(id);
  }
  return undefined;
}

export type PinKind = "critical" | "open" | "on_it" | "resolved";

export function pinKind(status: string, severity: string): PinKind {
  if (status === "resolved") return "resolved";
  if (status === "on_it") return "on_it";
  if (severity === "critical") return "critical";
  return "open";
}

export const PIN_COLORS: Record<PinKind, string> = {
  critical: "#c43828",
  open: "#e3a008",
  on_it: "#2b5ea8",
  resolved: "#2f7d4a",
};
