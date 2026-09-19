import { StaffDesk } from "@/components/StaffDesk";
import { isDemoMode } from "@/lib/local-mode";

export default function AdminPage() {
  return <StaffDesk desk="admin" demo={isDemoMode()} />;
}
