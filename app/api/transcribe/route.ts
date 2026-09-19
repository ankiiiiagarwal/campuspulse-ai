import { NextResponse } from "next/server";
import { limited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 4_000_000;

export async function GET() {
  return NextResponse.json({ available: Boolean(process.env.GROQ_API_KEY) });
}

export async function POST(req: Request) {
  if (await limited(req, "transcribe", { limit: 15 })) {
    return NextResponse.json({ error: "Too many transcriptions. Wait a few minutes." }, { status: 429 });
  }

  const key = process.env.GROQ_API_KEY;
  if (!key) return NextResponse.json({ error: "Cloud voice typing is not configured. Use Chrome or Edge for browser dictation, or type your report." }, { status: 503 });

  const incoming = await req.formData().catch(() => null);
  const file = incoming?.get("file");
  if (!(file instanceof File) || file.size < 200) {
    return NextResponse.json({ error: "No audio captured. Hold the mic and speak." }, { status: 400 });
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Audio is too large (max 4 MB)." }, { status: 400 });
  }

  const fd = new FormData();
  fd.append("file", file, file.name || "speech.webm");
  fd.append("model", process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo");
  fd.append("language", incoming?.get("language") === "hi" ? "hi" : "en");

  let res: Response;
  try { res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    signal: AbortSignal.timeout(25000),
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: fd,
  }); } catch { return NextResponse.json({error:"Transcription is unavailable. Please type your report or try again."},{status:503}); }
  const data = (await res.json().catch(() => ({}))) as { text?: string; error?: { message?: string } };
  if (!res.ok) {
    return NextResponse.json({ error: data.error?.message || "Could not transcribe that." }, { status: 502 });
  }
  const text = String(data.text || "").trim();
  if (!text) return NextResponse.json({ error: "Did not hear words. Try again." }, { status: 400 });
  return NextResponse.json({ text });
}
