import { AdminNav } from "@/components/AdminNav";
import { IncidentBoard } from "@/components/IncidentBoard";
import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function IncidentReviewPage() {
  if (!await requireAdmin()) redirect("/admin");
  return <div className="space-y-6"><AdminNav /><IncidentBoard review /></div>;
}
