import { NextResponse } from "next/server";
import { deskFromRequest, getAdminStaffSession, getDeptSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const desk = deskFromRequest(req);
  const admin = await getAdminStaffSession();
  const department = admin ? null : await getDeptSession();
  const session = desk === "admin" ? admin : desk === "department" ? department : null;
  return NextResponse.json({
    session,
    admin: admin ? { email: admin.email, role: admin.role } : null,
    department: department
      ? { email: department.email, role: department.role, department: department.department, departmentLabel: department.departmentLabel }
      : null,
  });
}
