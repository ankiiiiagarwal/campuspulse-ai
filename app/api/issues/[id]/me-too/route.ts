import { limited } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { getIssueById, meToo } from "@/lib/store";
import { confirmationHash } from "@/lib/visitor";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (await limited(req, "me-too", { limit: 20 })) return NextResponse.json({ error: "Too many confirmations. Wait a few minutes." }, { status: 429 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { cluster_id?: string };
  const client_hash = await confirmationHash();
  let clusterId = body.cluster_id;
  if (!clusterId) {
    const issue = await getIssueById(id);
    if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });
    clusterId = issue.cluster_id;
  }
  const result = await meToo(clusterId, client_hash);
  if (!result.ok) {
    return NextResponse.json(result, { status: result.already ? 409 : 400 });
  }
  return NextResponse.json(result);
}
