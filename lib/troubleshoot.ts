import { classifyWithKeywords } from "./classify";
import { ticketEtaNote } from "./eta";
import { geminiGenerate } from "./gemini";
import { groqChat } from "./groq";
import { getIssueByCode } from "./store";
import type { IssueWithCluster } from "./types";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatContext {
  page?: string;
  ticketCode?: string;
  lang?: string;
}

export interface ChatAnswer {
  reply: string;
  suggestReport: boolean;
  source: "gemini" | "groq" | "fallback";
}

interface Guide {
  id: string;
  words: string[];
  title: string;
  steps: string[];
  reportWhen: string;
  department: string;
  suggestReport: boolean;
}

const DANGER_WORDS =
  /\b(shock|spark|sparks|smoke|fire|gas leak|exposed wire|live wire|short circuit|electrocute|collapsed|assault|bleeding|unconscious)\b/i;

const GUIDES: Guide[] = [
  {
    id: "wifi",
    words: [
      "wifi",
      "wi-fi",
      "wi fi",
      "internet",
      "network",
      "router",
      "lan",
      "ethernet",
      "net nahi",
      "net nahi chal",
      "hotspot",
    ],
    title: "Campus Wi-Fi",
    steps: [
      "Confirm it is campus Wi-Fi, not mobile data. Turn mobile data off for a minute.",
      "Toggle Airplane mode on for 10 seconds, then off, and reconnect to the campus SSID.",
      "Forget the campus network, then join it again with the usual password.",
      "Try one other device or a friend’s phone in the same spot. If only your device fails, restart it.",
      "Move a few metres — near a window, corridor, or another floor — to see if it is a dead zone.",
    ],
    reportWhen:
      "If a whole room, floor, or building is down, or it stays dead after the steps above, file a report for IT. Do not unplug or reset corridor routers.",
    department: "IT",
    suggestReport: true,
  },
  {
    id: "electrical",
    words: ["light", "lights", "tube", "fan", "switch", "socket", "power", "electric", "bijli", "projector", "bulb"],
    title: "Lights and power",
    steps: [
      "Try the wall switch a couple of times. Check if other lights or the fan in the same room still work.",
      "If a neighbouring room or the corridor has power, note that — it helps Campus staff find the circuit.",
      "Stay away from the fixture. Do not open the tube light, climb on furniture, or touch a socket that smells or feels warm.",
    ],
    reportWhen:
      "File a report for Campus if the light or fan stays dead, flickers, or the switch is broken. If you see sparks, smoke, or a bare wire, leave the area and report it as critical.",
    department: "Campus",
    suggestReport: true,
  },
  {
    id: "water",
    words: ["leak", "leaking", "tap", "drip", "water", "pipe", "plumbing", "flood", "wet", "nal", "pani"],
    title: "Water and leaks",
    steps: [
      "Turn the tap fully closed. If it still drips, it needs a washer or valve — that is a staff job.",
      "If water is spreading, keep people off the wet floor and keep it away from sockets and extension boards.",
      "Do not try to open pipes or use tape on a burst line.",
    ],
    reportWhen:
      "File a report for Campus with the building and floor. If water is near wiring or flooding a room, treat it as urgent and report immediately.",
    department: "Campus",
    suggestReport: true,
  },
  {
    id: "washroom",
    words: ["washroom", "toilet", "bathroom", "flush", "urinal", "latrine", "clog", "dirty"],
    title: "Washroom",
    steps: [
      "Try another stall or the next washroom on the floor so you are not stuck.",
      "If a tap is running, close it fully. Do not put a hand or stick into a clogged drain.",
      "Do not pour chemicals or open cleaners into the flush.",
    ],
    reportWhen: "File a report for Campus (or Hostel if you are in a hostel). Mention the building, floor, and whether it is a tap, flush, or cleanliness issue.",
    department: "Campus",
    suggestReport: true,
  },
  {
    id: "furniture",
    words: ["chair", "desk", "bench", "table", "furniture", "broken lock", "door lock", "almirah"],
    title: "Furniture",
    steps: [
      "Do not sit or lean on a cracked chair, bench, or desk.",
      "If it is light and safe, slide it aside so nobody else uses it. Do not try to nail or glue it.",
    ],
    reportWhen: "File a report for Campus. A photo of the break helps them bring the right spare.",
    department: "Campus",
    suggestReport: true,
  },
  {
    id: "mess",
    words: ["mess", "food", "canteen", "dining", "meal", "lunch", "dinner", "hygiene"],
    title: "Mess and food",
    steps: [
      "If a batch looks off, skip it and tell the counter staff once if they are there.",
      "Do not eat food that smells wrong or has visible spoilage.",
    ],
    reportWhen: "File a report for Mess with the meal time and what was wrong. This is not something to “fix” yourself.",
    department: "Mess",
    suggestReport: true,
  },
  {
    id: "hostel",
    words: ["hostel", "warden", "room window", "hostel room", "cupboard"],
    title: "Hostel room",
    steps: [
      "Note the hostel name, block, and floor. Try the obvious switch or latch once if it is safe.",
      "Do not force a jammed door or window if the frame looks cracked.",
    ],
    reportWhen: "File a report so it routes to Hostel. Add the room area (not your name or room number if you want to stay anonymous).",
    department: "Hostel",
    suggestReport: true,
  },
  {
    id: "safety",
    words: ["dark", "pathway", "path", "road", "street", "unsafe", "night", "pothole", "street light"],
    title: "Path and night safety",
    steps: [
      "Do not wait in an unlit stretch. Use a lit route or walk with someone.",
      "You cannot safely “fix” a dark path or a pothole yourself.",
    ],
    reportWhen: "File a report for Campus right away. Pin the exact spot on the map.",
    department: "Campus",
    suggestReport: true,
  },
  {
    id: "how-report",
    words: ["how to report", "file a report", "submit issue", "complaint", "report kaise", "how do i report"],
    title: "How to report here",
    steps: [
      "Open Report. No login, no name.",
      "Write what is broken in a sentence, or hold the mic and speak.",
      "Pick the place (IT, Hostel, Mess, Campus, or Library), add the floor or spot, then mark the issue location. If an admin has set a reporting area, choose a pin inside it.",
      "Submit. You get a ticket ID. If the same issue is already open nearby, you can tap Me too instead.",
    ],
    reportWhen: "Use Report when a safe retry did not help, or when the job needs staff (wiring, leaks, dark paths, mess, washrooms).",
    department: "—",
    suggestReport: true,
  },
  {
    id: "how-track",
    words: ["track", "ticket", "status", "where is my", "ticket id", "look up"],
    title: "How to track a ticket",
    steps: [
      "Paste the ticket ID in the Track box at the top of any student page.",
      "The ticket page shows Open → Assigned → On it → Resolved, plus department and when staff expect it to be fixed.",
      "Anyone can tap Me too on an open issue so the affected count goes up. Still no name.",
    ],
    reportWhen: "If you never got a ticket ID, file the report again from Report and save the new code.",
    department: "—",
    suggestReport: false,
  },
  {
    id: "gps",
    words: ["gps", "location", "pin", "map", "permission", "outside campus", "boundary"],
    title: "Map and GPS",
    steps: [
      "Allow location when the browser asks, or tap the map to drop the pin yourself.",
      "If an admin saved a campus area, the pin must stay inside that fence. If it snaps outside, drag it back in.",
      "Use the locate button on the map to recalibrate. If GPS is denied, tapping the map still works.",
    ],
    reportWhen: "Campus area is optional. If none is set, drop the pin anywhere and submit.",
    department: "—",
    suggestReport: false,
  },
];

function topicHint(guide: Guide | null): string {
  if (!guide) {
    return "Answer only the problem they named. Write your own short numbered steps. Do not mix Wi-Fi, taps, washroom stalls, lights, and dark paths in one answer.";
  }
  return `They asked about ${guide.title}${guide.department !== "—" ? ` (usually ${guide.department})` : ""}. Write your own short numbered steps for that problem only. Do not copy a canned script, and do not add unrelated topics (for Wi-Fi do not mention taps, stalls, or lighting).`;
}

function assistantSystem(
  ticket: IssueWithCluster | null | undefined,
  page: string | undefined,
  lang: string | undefined,
  guide: Guide | null,
): string {
  const ticketBlock = ticket
    ? `The student is on ticket ${ticket.ticket_code}. Title: ${ticket.title}. Category: ${ticket.category}. Status: ${ticket.status}. Department: ${ticket.department}. Building: ${ticket.building}. Description: ${ticket.description}.${ticketEtaNote(ticket.eta_at)} If they ask when it will be fixed, use that expected time.`
    : "No ticket is open in the current page.";
  return [
    "You are CampusPulse Fix Assistant for students on an Indian campus.",
    "Answer ONLY what they asked. Never dump a generic mix of Wi-Fi + tap + stall + lighting steps.",
    topicHint(guide),
    "Safe DIY only for that topic. Never touch live wires, open fittings, climb, unclog drains, use chemicals, or reset corridor routers.",
    "Call a report critical only for spark, smoke, exposed wire, gas, flood near sockets, or injury. Ordinary Wi-Fi down is a normal IT report, not critical.",
    "If safe steps will not fix it, tell them to file an anonymous report on CampusPulse. Do not ask for name, email, phone, student ID, or room number.",
    "Stay on campus issues and this app. For homework, coding, medical, or off-topic questions, say you only help with campus problems and reporting here.",
    lang === "hi"
      ? "The UI language is Hindi. Reply in Hindi (Devanagari) unless the student writes in English."
      : "Reply in the student's language (English or Hindi). 80–160 words unless they ask for less.",
    `Page: ${page || "student"}. ${ticketBlock}`,
  ].join(" ");
}

function dangerReply(): ChatAnswer {
  return {
    reply:
      "Stop and do not try to fix this yourself. Leave the area if there is spark, smoke, a bare wire, gas, or anyone hurt. Tell people nearby to keep clear, then file a critical report on CampusPulse (or go to security if it is an emergency). I will not walk you through touching wiring, chemicals, or climbing.",
    suggestReport: true,
    source: "fallback",
  };
}

function scoreGuide(text: string, guide: Guide): number {
  const t = text.toLowerCase();
  return guide.words.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);
}

function pickGuide(text: string): Guide | null {
  let best: Guide | null = null;
  let hits = 0;
  for (const guide of GUIDES) {
    const n = scoreGuide(text, guide);
    if (n > hits) {
      hits = n;
      best = guide;
    }
  }
  return hits > 0 ? best : null;
}

function formatGuide(guide: Guide, ticket?: IssueWithCluster | null): string {
  const ticketLine = ticket
    ? `You are looking at ticket ${ticket.ticket_code}: ${ticket.title} (${ticket.category}, ${ticket.status}, ${ticket.department}).${ticketEtaNote(ticket.eta_at)}\n\n`
    : "";
  const steps = guide.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return `${ticketLine}${guide.title} — try this first:\n${steps}\n\nWhen to report: ${guide.reportWhen}${
    guide.department !== "—" ? ` It usually goes to ${guide.department}.` : ""
  }`;
}

function stillBroken(text: string): boolean {
  return /\b(still (broken|dead|down|not)|didn'?t work|no luck|tried that|same problem|phir bhi|abhi bhi)\b/i.test(text);
}

function appHowTo(text: string): Guide | null {
  if (/\b(how (do i|to) (use|report|file|track|submit)|kya karun|kaise)\b/i.test(text) && /\b(report|ticket|app|campuspulse|issue|complaint)\b/i.test(text)) {
    return GUIDES.find((g) => g.id === "how-report") || null;
  }
  return null;
}

export function fallbackTroubleshoot(userText: string, ticket?: IssueWithCluster | null, followUp = false): ChatAnswer {
  const text = userText.trim();
  if (DANGER_WORDS.test(text)) return dangerReply();

  if (followUp && stillBroken(text) && ticket) {
    return {
      reply: `If you already tried the safe steps for ${ticket.category.toLowerCase()}, file or bump the report. Ticket ${ticket.ticket_code} is ${ticket.status} with ${ticket.department}.${ticketEtaNote(ticket.eta_at)} Tap Me too on that ticket if it is already open so staff see more people are affected.`,
      suggestReport: ticket.status !== "resolved",
      source: "fallback",
    };
  }

  if (followUp && stillBroken(text)) {
    return {
      reply:
        "If the safe steps did not help, it needs staff. File a report from Report: drop a pin, write one sentence, submit. You get a ticket ID to track. Do not open fittings, unplug corridor equipment, or climb.",
      suggestReport: true,
      source: "fallback",
    };
  }

  const how = appHowTo(text);
  const guide = how || pickGuide(text) || (ticket ? pickGuide(`${ticket.category} ${ticket.title} ${ticket.description}`) : null);

  if (guide) {
    return {
      reply: formatGuide(guide, ticket),
      suggestReport: guide.suggestReport,
      source: "fallback",
    };
  }

  const classified = classifyWithKeywords(text);
  if (classified.category !== "Other") {
    const fromCat = pickGuide(classified.category);
    if (fromCat) {
      return { reply: formatGuide(fromCat, ticket), suggestReport: fromCat.suggestReport, source: "fallback" };
    }
  }

  return {
    reply:
      "I can walk you through safe things to try for campus Wi-Fi, lights, water leaks, washrooms, furniture, mess, hostel rooms, and dark paths — and how to report or track a ticket here. What is broken, or what are you stuck on?",
    suggestReport: false,
    source: "fallback",
  };
}

function guideForQuestion(text: string, ticket?: IssueWithCluster | null): Guide | null {
  return appHowTo(text) || pickGuide(text) || (ticket ? pickGuide(`${ticket.category} ${ticket.title} ${ticket.description}`) : null);
}

async function troubleshootWithGemini(
  messages: ChatTurn[],
  ticket: IssueWithCluster | null | undefined,
  page: string | undefined,
  lang: string | undefined,
  guide: Guide | null,
): Promise<ChatAnswer | null> {
  const reply = await geminiGenerate({
    system: assistantSystem(ticket, page, lang, guide),
    messages,
    temperature: 0.2,
    maxOutputTokens: 400,
    timeoutMs: 12000,
  });
  if (!reply?.trim()) return null;
  const last = messages.filter((m) => m.role === "user").at(-1)?.content || "";
  const suggestReport =
    DANGER_WORDS.test(last) || /file a report|report it|\/report/i.test(reply) || Boolean(guide?.suggestReport);
  return { reply, suggestReport, source: "gemini" };
}

async function troubleshootWithGroq(
  messages: ChatTurn[],
  ticket: IssueWithCluster | null | undefined,
  page: string | undefined,
  lang: string | undefined,
  guide: Guide | null,
): Promise<ChatAnswer | null> {
  const reply = await groqChat({
    system: assistantSystem(ticket, page, lang, guide),
    messages,
    temperature: 0.2,
    timeoutMs: 12000,
  });
  if (!reply?.trim()) return null;
  const last = messages.filter((m) => m.role === "user").at(-1)?.content || "";
  const suggestReport =
    DANGER_WORDS.test(last) || /file a report|report it|\/report/i.test(reply) || Boolean(guide?.suggestReport);
  return { reply, suggestReport, source: "groq" };
}

export async function answerTroubleshoot(messages: ChatTurn[], context: ChatContext = {}): Promise<ChatAnswer> {
  const cleaned = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && String(m.content || "").trim())
    .slice(-8)
    .map((m) => ({ role: m.role, content: String(m.content).trim().slice(0, 600) }));
  const lastUser = [...cleaned].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    return {
      reply: "Tell me what is broken — Wi-Fi, a tap, a light, a washroom, or how to report it here.",
      suggestReport: false,
      source: "fallback",
    };
  }
  const ticket = context.ticketCode ? await getIssueByCode(context.ticketCode) : null;
  if (DANGER_WORDS.test(lastUser.content)) return dangerReply();
  const guide = guideForQuestion(lastUser.content, ticket);
  const gemini = await troubleshootWithGemini(cleaned, ticket, context.page, context.lang, guide);
  if (gemini) return gemini;
  const groq = await troubleshootWithGroq(cleaned, ticket, context.page, context.lang, guide);
  if (groq) return groq;
  const followUp = cleaned.some((m) => m.role === "assistant");
  return fallbackTroubleshoot(lastUser.content, ticket, followUp);
}
