import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getIssueById, updateIssue } from "@/lib/store";
import type { Department, Status } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const issue = await getIssueById(id);
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ issue });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin login required" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    status?: Status;
    eta_at?: string | null;
    resolve_photo_url?: string | null;
    department?: Department;
  };
  const issue = await updateIssue(id, body);
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ issue });
}
