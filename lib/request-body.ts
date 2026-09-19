import { HttpError } from "./geo";

/** Bound bytes while reading, including requests without Content-Length. */
export async function readJson(req: Request, maxBytes = 16_384): Promise<Record<string, unknown>> {
  if (Number(req.headers.get("content-length")) > maxBytes) throw new HttpError("Request is too large", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError("JSON body required", 400);
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HttpError("Request is too large", 413);
      }
      parts.push(value);
    }
    const value: unknown = JSON.parse(Buffer.concat(parts).toString("utf8"));
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error();
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError("Invalid JSON body", 400);
  } finally { reader.releaseLock(); }
}

export function textField(value: unknown, name: string, max: number, min = 0): string {
  if (typeof value !== "string" || value.trim().length < min || value.length > max) {
    throw new HttpError(`${name} must be ${min}–${max} characters`, 400);
  }
  return value.trim();
}
