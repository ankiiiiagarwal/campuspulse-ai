import { createHash } from "crypto";
import { haversineMeters } from "./duplicates";
import { normalizeReportText, floorHint } from "./report-language";
import { proofState } from "./verification";
import type { AppSnapshot, IncidentKind, Issue } from "./types";

export interface IncidentSuggestion {
  id: string; kind: IncidentKind; title: string; place: string;
  issue_ids: string[]; explanation: string; next_step: string;
}
const labels = {
  power: ["Possible power disruption", "Different equipment stopped working in the same place and time window.", "Ask the electrical team to inspect the local supply, then check each affected service."],
  network: ["Possible network outage", "Multiple reports describe network failures in the same place and time window.", "Ask IT to inspect the access point and upstream connection."],
  water: ["Possible water leakage", "Multiple reports describe leaking water or its effects in the same place and time window.", "Inspect the source of the leak and any wet surfaces; check electrical hazards nearby."],
} as const;

function signals(issue: Issue): Set<string> {
  const t = normalizeReportText(issue.description);
  const out = new Set<string>();
  const failed = /\b(down|outage|off|dead|not working|stopped working|no power|not turning on|not connecting|disconnected|unavailable|no internet|no wifi|no connection|failed)\b/.test(t);
  // Positive or explicitly negated observations must not become outage evidence.
  if (/\b(working fine|working normally|no (?:water )?(?:leak|leakage|outage)|not (?:leaking|down|off))\b/.test(t)) return out;
  if (failed) {
    if (/\b(wifi|internet|network|router)\b/.test(t)) out.add("network");
    if (/\b(light|lights|lighting)\b/.test(t)) out.add("light");
    if (/\b(projector)\b/.test(t)) out.add("projector");
    if (/\b(fan|fans)\b/.test(t)) out.add("fan");
    if (/\b(power|electricity)\b/.test(t)) out.add("power");
  }
  if (/\b(leak|leaking|leakage|dripping|flood|flooding|wet floor|damp wall)\b/.test(t)) out.add("water");
  return out;
}

export function sameIncidentPlace(a: Issue, b: Issue): boolean {
  if (haversineMeters(a, b) > 60) return false;
  if (a.location_id || b.location_id) return !!a.location_id && a.location_id === b.location_id;
  const left = normalizeReportText(a.building), right = normalizeReportText(b.building);
  // A department name alone is too broad to establish a common physical location.
  if (!left || /^(campus|library|hostel|mess|it)$/.test(left)) return false;
  return left === right && floorHint(a.building) === floorHint(b.building);
}

export function detectIncidents(snap: AppSnapshot, now = Date.now()): IncidentSuggestion[] {
  const records = snap.incidents ?? [];
  const used = new Set(records.filter(r => r.decision === "confirmed").flatMap(r => r.issue_ids));
  const recent = snap.issues.filter(i => i.status !== "resolved" && now - Date.parse(i.created_at) >= 0 && now - Date.parse(i.created_at) <= 6 * 3600000)
    .sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const result: IncidentSuggestion[] = [];
  for (const kind of ["power", "water", "network"] as IncidentKind[]) {
    const rejected = new Set(records.filter(r => r.kind === kind && r.decision === "separate").flatMap(r => r.issue_ids));
    const eligible = recent.filter(i => !used.has(i.id) && !rejected.has(i.id) && [...signals(i)].some(s => kind === "power" ? s !== "water" : s === kind));
    for (const first of eligible) {
      if (used.has(first.id)) continue;
      const group: Issue[] = [first];
      for (const item of eligible) {
        if (item.id === first.id || used.has(item.id)) continue;
        if (group.every(other => sameIncidentPlace(item, other) && Math.abs(Date.parse(item.created_at) - Date.parse(other.created_at)) <= 30 * 60000)) group.push(item);
      }
      if (group.length < 2) continue;
      const all = new Set(group.flatMap(i => [...signals(i)]));
      if (kind === "power" && (all.size < 2 || !["power", "light", "fan", "projector"].some(s => all.has(s)))) continue;
      const ids = group.map(i => i.id).sort();
      const id = createHash("sha256").update(`${kind}:${ids.join(":")}`).digest("hex");
      const [title, explanation, next_step] = labels[kind];
      result.push({ id, kind, title, explanation, next_step, place: first.building, issue_ids: ids });
      ids.forEach(i => used.add(i));
    }
  }
  return result;
}

export function incidentProgress(issues: Issue[]): string {
  if (!issues.length) return "Reports unavailable";
  if (issues.some(i => i.status !== "resolved")) return "Investigating";
  if (issues.every(i => proofState(i) === "verified")) return "Community-confirmed";
  return "Awaiting student confirmation";
}
