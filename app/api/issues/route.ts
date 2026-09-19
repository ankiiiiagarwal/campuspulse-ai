import { limited } from "@/lib/rate-limit";
import { readJson, textField } from "@/lib/request-body";
import { NextResponse } from "next/server";
import { deskFromRequest, getStaffSession } from "@/lib/auth";
import { scopeIssuesForSession } from "@/lib/departments";
import { HttpError } from "@/lib/geo";
import { publicIssue, publicIssues } from "@/lib/public-issue";
import { createIssue, listInventory } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getStaffSession(deskFromRequest(req));
    const { issues: allIssues, clusters: allClusters } = await listInventory();
    const { issues, clusters } = scopeIssuesForSession(session, allIssues, allClusters);
    return NextResponse.json({ issues: publicIssues(issues), clusters });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load issues";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (await limited(req, "report", { limit: 10 })) return NextResponse.json({ error: "Too many reports. Wait a few minutes." }, { status: 429 });
    const body = (await readJson(req)) as {
      description?: string;
      lat?: number;
      lng?: number;
      building?: string;
      photo_url?: string | null;
      forceNew?: boolean;
      mergeClusterId?: string;
      location_id?: string;
    };
    const description = textField(body.description, "Description", 4000, 8);
    if (description.length < 8) {
      return NextResponse.json({ error: "Describe the issue in a sentence or two." }, { status: 400 });
    }
    if (typeof body.lat !== "number" || typeof body.lng !== "number" || !Number.isFinite(body.lat) || !Number.isFinite(body.lng)) {
      return NextResponse.json({ error: "Use your GPS or tap the map to drop a pin." }, { status: 400 });
    }
    const building = textField(body.building, "Place", 160, 1);
    if (!building) {
      return NextResponse.json({ error: "Choose a named place." }, { status: 400 });
    }
    const result = await createIssue({
      location_id: body.location_id == null ? undefined : textField(body.location_id, "QR location", 36, 36),
      description,
      lat: body.lat,
      lng: body.lng,
      building,
      photo_url: body.photo_url,
      forceNew: Boolean(body.forceNew),
      mergeClusterId: body.mergeClusterId == null ? undefined : textField(body.mergeClusterId, "Cluster ID", 36, 36),
    });
    return NextResponse.json(
      { ...result, issue: result.issue ? publicIssue(result.issue) : result.issue },
      { status: 201 },
    );
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Failed to create issue";
    return NextResponse.json({ error: message, code: err instanceof HttpError ? err.code : undefined }, { status });
  }
}
