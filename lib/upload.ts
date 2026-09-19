import { mkdir, readFile, writeFile, lstat } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { HttpError } from "./geo";
import { hasSupabase, supabaseAdmin } from "./supabase";

export const MAX_PHOTO_BYTES = 4_500_000;
const NAME = /^(report|resolve)-[0-9]+-[0-9a-f-]{8,36}\.(jpg|png|webp)$/;

async function normalizeImage(bytes: Buffer): Promise<Buffer> {
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) throw new HttpError("Photo is too large or empty", 400);
  try {
    const image = sharp(bytes, { limitInputPixels: 25_000_000, failOn: "warning" });
    const meta = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format || "") || (meta.pages || 1) !== 1) throw new Error();
    // Decode and re-encode on the server: strips metadata and rejects malformed images.
    return await image.rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  } catch { throw new HttpError("Use a valid JPEG, PNG, or WebP photo", 400); }
}

export async function savePhoto(base64: string, kind: "report" | "resolve"): Promise<string> {
  if (typeof base64 !== "string" || base64.length > 6_000_100) throw new HttpError("Photo is too large", 400);
  const match = base64.match(/^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw new HttpError("Use a JPEG, PNG, or WebP photo", 400);
  const bytes = await normalizeImage(Buffer.from(match[1], "base64"));
  const name = `${kind}-${Date.now()}-${crypto.randomUUID()}.jpg`;
  const bucket = `${kind}-photos`;
  if (hasSupabase()) {
    const sb = supabaseAdmin();
    const { error } = await sb.storage.from(bucket).upload(name, bytes, { contentType: "image/jpeg", upsert: false });
    if (error) throw error;
    return sb.storage.from(bucket).getPublicUrl(name).data.publicUrl;
  }
  if (process.env.VERCEL) throw new HttpError("Photo storage is not configured", 503);
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes, { flag: "wx" });
  return `/uploads/${name}`;
}

/** Read only our existing storage objects. Never fetch a caller-supplied URL. */
export async function readPhoto(url: string, kind?: "report" | "resolve"): Promise<{ mime: string; data: string }> {
  let bytes: Buffer;
  let name: string;
  if (hasSupabase()) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
    const prefix = `${base}/storage/v1/object/public/`;
    if (!url.startsWith(prefix)) throw new HttpError("Use a photo uploaded through this app", 400);
    const parts = url.slice(prefix.length).split("/");
    if (parts.length !== 2 || !["report-photos", "resolve-photos"].includes(parts[0])) throw new HttpError("Invalid photo", 400);
    name = parts[1];
    if (!NAME.test(name) || parts[0] !== `${name.split("-")[0]}-photos` || (kind && !name.startsWith(`${kind}-`))) throw new HttpError("Invalid photo", 400);
    const { data, error } = await supabaseAdmin().storage.from(parts[0]).download(name);
    if (error || !data || data.size > MAX_PHOTO_BYTES) throw new HttpError("Uploaded photo was not found or is too large", 400);
    bytes = Buffer.from(await data.arrayBuffer());
  } else {
    name = url.startsWith("/uploads/") ? url.slice(9) : "";
    if (!NAME.test(name) || (kind && !name.startsWith(`${kind}-`))) throw new HttpError("Use a photo uploaded through this app", 400);
    const file = path.join(process.cwd(), "public", "uploads", name);
    try {
      const stat = await lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_PHOTO_BYTES) throw new Error();
      bytes = await readFile(file);
    } catch { throw new HttpError("Uploaded photo was not found", 400); }
  }
  const normalized = await normalizeImage(bytes);
  return { mime: "image/jpeg", data: normalized.toString("base64") };
}

export async function validatePhoto(value: unknown, kind?: "report" | "resolve"): Promise<string | null> {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) throw new HttpError("Invalid photo", 400);
  await readPhoto(value, kind);
  return value;
}
