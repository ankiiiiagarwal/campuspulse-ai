export function groqApiKey(): string {
  return (process.env.GROQ_API_KEY || "").trim();
}

export function groqModel(): string {
  return process.env.GROQ_MODEL || "openai/gpt-oss-20b";
}

function extractText(data: unknown): string {
  const choices = (data as { choices?: Array<{ message?: { content?: string } }> })?.choices;
  return String(choices?.[0]?.message?.content || "").trim();
}

export async function groqChat(opts: {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  temperature?: number;
  json?: boolean;
  timeoutMs?: number;
}): Promise<string | null> {
  const key = groqApiKey();
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12000);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: groqModel(),
        temperature: opts.temperature ?? 0.3,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        messages: [{ role: "system", content: opts.system }, ...opts.messages],
      }),
    });
    if (!res.ok) return null;
    return extractText(await res.json()) || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
