import { NextResponse } from "next/server";
import { limited } from "@/lib/rate-limit";
import { stripForSpeech } from "@/lib/voice-text";

export const dynamic = "force-dynamic";

function chunks(text: string, max = 190): string[] {
  const clean = stripForSpeech(text);
  const out: string[] = [];
  let rest = clean;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(" ", max);
    if (cut < 40) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out.slice(0, 8);
}

export async function POST(req: Request) {
  if (await limited(req, "speech", { limit: 15 })) {
    return NextResponse.json({ error: "Too many speech requests. Wait a few minutes." }, { status: 429 });
  }

  const key = process.env.GROQ_API_KEY;
  if (!key) return NextResponse.json({ error: "Groq key is not set." }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const parts = chunks(String(body.text || ""));
  if (!parts.length) return NextResponse.json({ error: "Nothing to read." }, { status: 400 });

  const model = process.env.GROQ_TTS_MODEL || "canopylabs/orpheus-v1-english";
  const voice = process.env.GROQ_TTS_VOICE || "austin";
  const audio: string[] = [];

  for (const input of parts) {
    let res: Response;
    try { res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
      signal: AbortSignal.timeout(15000),
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        voice,
        input,
        response_format: "wav",
      }),
    }); } catch { return NextResponse.json({error:"Speech is unavailable. You can still read the answer."},{status:503}); }
    if (!res.ok) {
      const err = await res.text();
      const terms = /terms/i.test(err);
      return NextResponse.json(
        {
          error: terms
            ? "Groq text-to-speech needs the Orpheus terms accepted in the Groq console. Chrome or Edge can still read aloud."
            : "Could not generate speech.",
        },
        { status: 502 },
      );
    }
    const buf = Buffer.from(await res.arrayBuffer());
    audio.push(buf.toString("base64"));
  }

  return NextResponse.json({ audio, format: "wav" });
}
