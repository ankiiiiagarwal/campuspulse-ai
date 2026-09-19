export interface Building {
  id: string;
  name: string;
  locationWeight: number;
}

/** Default world view (India) until GPS or an admin-drawn campus boundary exists. */
export const CAMPUS = {
  name: "Campus",
  center: { lat: 20.5937, lng: 78.9629 },
  defaultZoom: 5,
};

export const GENERIC_PLACE: Building = {
  id: "campus",
  name: "Campus",
  locationWeight: 3,
};

/** Optional named labels for classify / location weight — not map pins or the source of truth. */
export const BUILDINGS: Building[] = [
  { id: "library", name: "Library", locationWeight: 5 },
  { id: "hostel-a", name: "Hostel A", locationWeight: 5 },
  { id: "hostel-b", name: "Hostel B", locationWeight: 5 },
  { id: "lecture-hall", name: "Lecture Hall Complex", locationWeight: 4 },
  { id: "academic", name: "Academic Block", locationWeight: 4 },
  { id: "mess", name: "Mess", locationWeight: 5 },
  { id: "admin", name: "Admin Block", locationWeight: 3 },
  { id: "labs", name: "Lab Block", locationWeight: 5 },
  { id: "main-road", name: "Main Road", locationWeight: 5 },
  { id: "garden", name: "Garden", locationWeight: 2 },
  { id: "parking", name: "Parking", locationWeight: 2 },
  { id: "sports", name: "Sports Complex", locationWeight: 3 },
];

export function buildingByName(name: string): Building | undefined {
  const needle = name.trim().toLowerCase();
  const exact = BUILDINGS.find(
    (b) => b.name.toLowerCase() === needle || b.id === needle || needle.includes(b.id.replace("-", " ")),
  );
  if (exact) return exact;
  return inferBuildingFromText(name);
}

export function buildingById(id: string): Building | undefined {
  return BUILDINGS.find((b) => b.id === id);
}

/**
 * Location is 15% of priority. Do not key this off a hardcoded Delhi map —
 * reports store department + free-text place ("Hostel, second floor"), not a
 * building id. Weight comes from category and the words in place/description.
 */
export function locationWeightFor(
  buildingName: string,
  extra?: { category?: string; description?: string },
): number {
  const text = `${buildingName} ${extra?.description || ""}`.toLowerCase();
  let weight = 3;

  const categoryWeights: Record<string, number> = {
    "Road / path / safety": 5,
    "Electrical / lights": 5,
    Hostel: 5,
    Washroom: 4,
    "Water / leakage": 4,
    Mess: 4,
    "Wi-Fi / network": 3,
    Furniture: 2,
    Other: 2,
  };
  if (extra?.category && categoryWeights[extra.category] != null) {
    weight = Math.max(weight, categoryWeights[extra.category]);
  }

  const hints: Array<[RegExp, number]> = [
    [/\b(library|exam|lecture|lhc)\b/, 5],
    [/\b(hostel|dorm)\b/, 5],
    [/\b(lab|laboratory)\b/, 5],
    [/\b(road|path|gate|stairs|street)\b/, 5],
    [/\b(washroom|toilet|bathroom|latrine)\b/, 4],
    [/\b(mess|canteen|dining|kitchen)\b/, 4],
    [/\b(garden|lawn|parking)\b/, 2],
  ];
  for (const [re, w] of hints) {
    if (re.test(text)) weight = Math.max(weight, w);
  }

  const named = buildingByName(buildingName.split(",")[0].trim());
  if (named) weight = Math.max(weight, named.locationWeight);

  return Math.min(5, Math.max(1, weight));
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
