import { NextResponse } from "next/server";
import { limited } from "@/lib/rate-limit";
import { answerTroubleshoot, type ChatTurn } from "@/lib/troubleshoot";
import { readJson } from "@/lib/request-body";
import { HttpError } from "@/lib/geo";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
  if (await limited(req, "chat", { limit: 30 })) {
    return NextResponse.json({ error: "Too many questions. Wait a few minutes." }, { status: 429 });
  }

  const body = (await readJson(req, 48_000)) as {
    messages?: ChatTurn[];
    context?: { page?: string; ticketCode?: string; lang?: string };
  };
  if (!Array.isArray(body.messages) || body.messages.length > 16 || body.messages.some(m => !m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > (m.role === "user" ? 600 : 6000))) {
    throw new HttpError("Send up to 16 text messages, with questions under 600 characters.", 400);
  }
  const messages = body.messages;
  const last = messages.filter((m) => m?.role === "user").at(-1)?.content?.trim() || "";
  if (last.length < 2) {
    return NextResponse.json({ error: "Ask what is broken, or how to report it." }, { status: 400 });
  }
  if (last.length > 600) {
    return NextResponse.json({ error: "Keep the question under a few sentences." }, { status: 400 });
  }

  const answer = await answerTroubleshoot(messages, {
    page: String(body.context?.page || "").slice(0, 80),
    ticketCode: String(body.context?.ticketCode || "").slice(0, 32),
    lang: body.context?.lang === "hi" ? "hi" : "en",
  });
  return NextResponse.json(answer);
  } catch (e) {
    return NextResponse.json({ error: e instanceof HttpError ? e.message : "Could not answer right now. Please try again." }, { status: e instanceof HttpError ? e.status : 503 });
  }
}
