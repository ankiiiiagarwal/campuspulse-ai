import { AdminNav } from "@/components/AdminNav";
import { LocationManager } from "@/components/LocationManager";
import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function LocationsPage() {
  if (!await requireAdmin()) redirect("/admin");
  return <div className="space-y-6"><AdminNav /><LocationManager editable /></div>;
}
