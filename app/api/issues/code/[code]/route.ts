import { NextResponse } from "next/server";
import { publicIssue, publicIssues } from "@/lib/public-issue";
import { getPublicTicket } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const ticket = await getPublicTicket(String(code || "").trim());
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    issue: publicIssue(ticket.issue),
    siblings: publicIssues(ticket.siblings).map((i) => ({
      id: i.id,
      ticket_code: i.ticket_code,
      description: i.description,
      created_at: i.created_at,
      photo_url: i.photo_url,
    })),
  });
}
