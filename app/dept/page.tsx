import { StaffDesk } from "@/components/StaffDesk";
import { isDemoMode } from "@/lib/local-mode";

export default function DeptPage() {
  return <StaffDesk desk="department" demo={isDemoMode()} />;
}
