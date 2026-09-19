export type GeminiModel = "gemini-2.5-flash-lite" | "gemini-2.5-flash";

const ALLOWED: GeminiModel[] = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];

export function geminiApiKey(): string {
  return (process.env.GEMINI_API_KEY || "").trim();
}

function coerceModel(value?: string): GeminiModel | null {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "gemini-2.5-flash-lite" || raw === "flash-lite" || raw === "lite") return "gemini-2.5-flash-lite";
  if (raw === "gemini-2.5-flash" || raw === "flash") return "gemini-2.5-flash";
  return null;
}

/** Flash-Lite first (more free daily requests), then Flash. Never Pro or other models. */
export function geminiModels(): GeminiModel[] {
  const primary = coerceModel(process.env.GEMINI_MODEL) || "gemini-2.5-flash";
  const fallback = coerceModel(process.env.GEMINI_FALLBACK_MODEL) || "gemini-2.5-flash-lite";
  const list = [primary, fallback].filter((m, i, all) => ALLOWED.includes(m) && all.indexOf(m) === i);
  return list.length ? list : [...ALLOWED];
}

function extractText(data: unknown): string {
  const parts = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
    ?.candidates?.[0]?.content?.parts;
  return (parts || [])
    .map((p) => String(p.text || ""))
    .join("")
    .trim();
}

export async function geminiGenerate(opts: {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  temperature?: number;
  maxOutputTokens?: number;
  json?: boolean;
  timeoutMs?: number;
}): Promise<string | null> {
  const key = geminiApiKey();
  if (!key) return null;

  const contents = opts.messages
    .filter((m) => m.content.trim())
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
  if (!contents.length) return null;
  if (contents[0].role !== "user") {
    contents.unshift({ role: "user", parts: [{ text: "Continue." }] });
  }

  const configs = [
    {
      temperature: opts.temperature ?? 0.3,
      maxOutputTokens: opts.maxOutputTokens ?? 512,
      thinkingConfig: { thinkingBudget: 0 },
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
    {
      temperature: opts.temperature ?? 0.3,
      maxOutputTokens: opts.maxOutputTokens ?? 512,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  ];

  for (const model of geminiModels()) {
    for (const generationConfig of configs) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12000);
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
          },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: opts.system }] },
            contents,
            generationConfig,
          }),
        });
        if (!res.ok) continue;
        const text = extractText(await res.json());
        if (text) return text;
      } catch {
        // try next config / model
      } finally {
        clearTimeout(timer);
      }
    }
  }
  return null;
}

/** One-shot image caption. Returns null if Gemini is unset or the call fails. */
export async function geminiDescribeImage(inline: { mime: string; data: string }): Promise<string | null> {
  const key = geminiApiKey();
  if (!key || !inline.data) return null;

  const generationConfig = {
    temperature: 0.2,
    maxOutputTokens: 160,
    thinkingConfig: { thinkingBudget: 0 },
  };

  for (const model of geminiModels()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: "Describe a campus facility photo in one short sentence. Name the object and the problem if visible. No names of people. No speculation.",
              },
            ],
          },
          contents: [
            {
              role: "user",
              parts: [
                { text: "What is broken in this photo?" },
                { inlineData: { mimeType: inline.mime, data: inline.data } },
              ],
            },
          ],
          generationConfig,
        }),
      });
      if (!res.ok) continue;
      const text = extractText(await res.json());
      if (text) return text;
    } catch {
      // try next model
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
