import { geminiDescribeImage } from "./gemini";
import { readPhoto } from "./upload";

/** Vision outages do not block filing, but arbitrary network URLs are never fetched. */
export async function describeReportPhoto(photoUrl?: string | null): Promise<string | null> {
  if (!photoUrl) return null;
  const image = await readPhoto(photoUrl, "report");
  try {
    const text = await geminiDescribeImage(image);
    return (text || "").replace(/\s+/g, " ").trim().slice(0, 280) || null;
  } catch { return null; }
}
