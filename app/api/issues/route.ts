import { NextResponse } from "next/server";
import { createIssue, listClusters, listIssues } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [issues, clusters] = await Promise.all([listIssues(), listClusters()]);
    return NextResponse.json({ issues, clusters });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load issues";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      description?: string;
      lat?: number;
      lng?: number;
      building?: string;
      photo_url?: string | null;
      forceNew?: boolean;
    };
    const description = (body.description || "").trim();
    if (description.length < 8) {
      return NextResponse.json({ error: "Describe the issue in a sentence or two." }, { status: 400 });
    }
    if (typeof body.lat !== "number" || typeof body.lng !== "number") {
      return NextResponse.json({ error: "Drop a pin on the campus map." }, { status: 400 });
    }
    const result = await createIssue({
      description,
      lat: body.lat,
      lng: body.lng,
      building: body.building,
      photo_url: body.photo_url,
      forceNew: Boolean(body.forceNew),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create issue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
