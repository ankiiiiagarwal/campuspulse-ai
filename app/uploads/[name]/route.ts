import { readPhoto } from "@/lib/upload";

export const dynamic = "force-dynamic";
// Next's production public-file inventory is collected at startup. Serve newly
// uploaded local photos through a route as well, using the same bounded validator.
export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  try {
    const photo = await readPhoto(`/uploads/${name}`);
    return new Response(Buffer.from(photo.data, "base64"), {
      headers: { "Content-Type": photo.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch { return new Response("Photo not found", { status: 404 }); }
}
