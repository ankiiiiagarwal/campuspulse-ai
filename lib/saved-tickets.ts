const KEY = "cp_saved_tickets";

export function listSavedTickets(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c) => String(c).trim()).filter(Boolean).slice(0, 20);
  } catch {
    return [];
  }
}

export function rememberTicket(code: string) {
  const ticket = code.trim().toUpperCase();
  if (!ticket || typeof window === "undefined") return;
  const next = [ticket, ...listSavedTickets().filter((c) => c !== ticket)].slice(0, 20);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("cp-tickets"));
}
