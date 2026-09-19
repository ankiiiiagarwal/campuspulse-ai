import { BUILDINGS, inferBuildingFromText } from "./campus";
import { normalizeReportText } from "./report-language";
import { departmentForReport } from "./departments";
import { geminiGenerate } from "./gemini";
import { groqChat } from "./groq";
import type { Category, ClassifyResult, Department, Severity } from "./types";

export const CATEGORY_TABLE: Record<
  Category,
  { department: Department; defaultSafety: number }
> = {
  "Electrical / lights": { department: "Campus", defaultSafety: 4 },
  "Water / leakage": { department: "Campus", defaultSafety: 3 },
  "Wi-Fi / network": { department: "IT", defaultSafety: 2 },
  Furniture: { department: "Campus", defaultSafety: 2 },
  Washroom: { department: "Campus", defaultSafety: 3 },
  Hostel: { department: "Hostel", defaultSafety: 3 },
  Mess: { department: "Mess", defaultSafety: 3 },
  "Road / path / safety": { department: "Campus", defaultSafety: 5 },
  Other: { department: "Campus", defaultSafety: 2 },
};

const KEYWORD_RULES: Array<{ category: Category; words: string[] }> = [
  { category: "Wi-Fi / network", words: ["wifi", "wi-fi", "wi fi", "internet", "router", "lan", "network", "ethernet"] },
  { category: "Electrical / lights", words: ["light", "tube", "electrical", "electric", "shock", "spark", "wiring", "wire", "socket", "switch", "fan", "projector", "power"] },
  { category: "Water / leakage", words: ["leak", "leaking", "tap", "drip", "water", "plumbing", "pipe", "flood", "wet floor"] },
  { category: "Washroom", words: ["washroom", "toilet", "bathroom", "latrine", "flush", "urinal"] },
  { category: "Mess", words: ["mess", "food", "canteen", "dining", "meal", "lunch"] },
  { category: "Road / path / safety", words: ["dark", "pathway", "path", "road", "street", "unsafe", "night", "pothole", "lighting on the path"] },
  { category: "Furniture", words: ["chair", "desk", "bench", "table", "furniture", "broken lock", "door lock"] },
  { category: "Hostel", words: ["hostel", "warden", "room window", "hostel room"] },
];

function severityFromSafety(safety: number): Severity {
  if (safety >= 5) return "critical";
  if (safety >= 4) return "high";
  if (safety >= 3) return "medium";
  return "low";
}

function bumpSafety(text: string, category: Category, base: number): number {
  const t = normalizeReportText(text);
  let safety = base;
  if (category === "Road / path / safety" || /\b(dark|unsafe|night|assault)\b/.test(t)) safety = Math.max(safety, 5);
  if (/\b(shock|spark|exposed wire|live wire|short circuit)\b/.test(t)) safety = Math.max(safety, 5);
  if (category === "Water / leakage" && /\b(wir(e|ing)|electrical|socket|switch)\b/.test(t)) safety = Math.max(safety, 5);
  if (category === "Electrical / lights") safety = Math.max(safety, 4);
  if (category === "Wi-Fi / network" && /\b(exam|lab|library|dead|down|hostel)\b/.test(t)) safety = Math.max(safety, 4);
  return Math.min(5, safety);
}

export function classifyWithKeywords(description: string, hintBuilding?: string): ClassifyResult {
  const t = normalizeReportText(description);
  let category: Category = "Other";
  let bestHits = 0;
  for (const rule of KEYWORD_RULES) {
    const hits = rule.words.filter((w) => t.includes(w)).length;
    if (hits > bestHits) {
      bestHits = hits;
      category = rule.category;
    }
  }
  const meta = CATEGORY_TABLE[category];
  const safety = bumpSafety(description, category, meta.defaultSafety);
  const inferred = inferBuildingFromText(description);
  const building =
    hintBuilding ||
    inferred?.name ||
    BUILDINGS.find((b) => t.includes(b.name.toLowerCase()))?.name;
  return {
    category,
    severity: severityFromSafety(safety),
    department: departmentForReport(category, building),
    safety,
    building,
    source: "fallback",
  };
}

function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const CATEGORIES = Object.keys(CATEGORY_TABLE) as Category[];

function coerceCategory(value: unknown): Category {
  const raw = String(value ?? "").toLowerCase();
  const found = CATEGORIES.find((c) => c.toLowerCase() === raw || raw.includes(c.toLowerCase().split(" / ")[0].toLowerCase()));
  if (found) return found;
  if (raw.includes("wifi") || raw.includes("network")) return "Wi-Fi / network";
  if (raw.includes("electric") || raw.includes("light")) return "Electrical / lights";
  if (raw.includes("water") || raw.includes("leak")) return "Water / leakage";
  if (raw.includes("wash") || raw.includes("toilet")) return "Washroom";
  if (raw.includes("road") || raw.includes("path") || raw.includes("safety")) return "Road / path / safety";
  if (raw.includes("furn")) return "Furniture";
  if (raw.includes("hostel")) return "Hostel";
  if (raw.includes("mess")) return "Mess";
  return "Other";
}

const CLASSIFY_SYSTEM =
  "You classify campus facility reports. Reply with JSON only: {category, severity, department, safety, building}. category must be one of: Electrical / lights, Water / leakage, Wi-Fi / network, Furniture, Washroom, Hostel, Mess, Road / path / safety, Other. severity: low|medium|high|critical. department must be one of: IT, Hostel, Mess, Campus, Library. Route Wi-Fi to IT, mess/food to Mess, hostel rooms to Hostel, library building (non-Wi-Fi) to Library, everything else to Campus. safety is 1-5 (dark path, exposed wiring, water+wiring = 5). building is the named campus building or empty.";

function resultFromModel(raw: string | null, description: string, hintBuilding: string | undefined, source: "gemini" | "groq"): ClassifyResult | null {
  const parsed = extractJson(raw || "");
  if (!parsed) return null;
  const category = coerceCategory(parsed.category);
  const meta = CATEGORY_TABLE[category];
  let safety = Number(parsed.safety);
  if (!Number.isFinite(safety)) safety = meta.defaultSafety;
  safety = bumpSafety(description, category, Math.round(safety));
  const severityRaw = String(parsed.severity || "").toLowerCase();
  const severity = (["low", "medium", "high", "critical"].includes(severityRaw)
    ? severityRaw
    : severityFromSafety(safety)) as Severity;
  const building = String(hintBuilding || parsed.building || inferBuildingFromText(description)?.name || "");
  return {
    category,
    severity,
    department: departmentForReport(category, building || hintBuilding),
    safety,
    building,
    source,
  };
}

async function classifyWithGemini(description: string, hintBuilding?: string): Promise<ClassifyResult | null> {
  const raw = await geminiGenerate({
    system: CLASSIFY_SYSTEM,
    messages: [{ role: "user", content: `Report: ${description}\nHint building: ${hintBuilding || "unknown"}` }],
    temperature: 0.1,
    maxOutputTokens: 256,
    json: true,
    timeoutMs: 12000,
  });
  return resultFromModel(raw, description, hintBuilding, "gemini");
}

async function classifyWithGroq(description: string, hintBuilding?: string): Promise<ClassifyResult | null> {
  const raw = await groqChat({
    system: CLASSIFY_SYSTEM,
    messages: [{ role: "user", content: `Report: ${description}\nHint building: ${hintBuilding || "unknown"}` }],
    temperature: 0.1,
    json: true,
    timeoutMs: 8000,
  });
  return resultFromModel(raw, description, hintBuilding, "groq");
}

export async function classifyReport(description: string, hintBuilding?: string): Promise<ClassifyResult> {
  const gemini = await classifyWithGemini(description, hintBuilding);
  if (gemini) return gemini;
  const groq = await classifyWithGroq(description, hintBuilding);
  if (groq) return groq;
  return classifyWithKeywords(description, hintBuilding);
}
