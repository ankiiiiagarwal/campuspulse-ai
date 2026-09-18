import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { hasSupabase, supabaseAdmin } from "./supabase";

function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

export async function savePhoto(base64: string, kind: "report" | "resolve"): Promise<string> {
  const match = base64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  const mime = match?.[1] || "image/jpeg";
  const buf = Buffer.from(match?.[2] || base64, "base64");
  if (buf.length > 4_500_000) {
    throw new Error("Photo is too large (max ~4 MB after compress)");
  }
  const name = `${kind}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extFromMime(mime)}`;
  const bucket = kind === "resolve" ? "resolve-photos" : "report-photos";

  if (hasSupabase()) {
    const sb = supabaseAdmin();
    const { error } = await sb.storage.from(bucket).upload(name, buf, { contentType: mime, upsert: false });
    if (error) throw error;
    const { data } = sb.storage.from(bucket).getPublicUrl(name);
    return data.publicUrl;
  }

  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return `/uploads/${name}`;
}
