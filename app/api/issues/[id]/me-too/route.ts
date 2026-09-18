import { NextResponse } from "next/server";
import { getIssueById, meToo } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { client_hash?: string; cluster_id?: string };
  const client_hash = (body.client_hash || "").trim();
  if (!client_hash) {
    return NextResponse.json({ error: "Missing client_hash" }, { status: 400 });
  }
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
