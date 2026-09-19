"use client";

import { AdminNav } from "@/components/AdminNav";
import { staffDeskHeaders } from "@/lib/client";
import { useRouter } from "next/navigation";

export function AdminHeader({ title }: { title: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", {
      method: "POST",
      headers: staffDeskHeaders("admin", { "Content-Type": "application/json" }),
      body: JSON.stringify({ desk: "admin" }),
    });
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">Admin</p>
        <h1 className="font-serif text-4xl text-navy">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <AdminNav />
        <button type="button" onClick={() => void logout()} className="rounded-full border border-rule px-4 py-2 text-sm font-semibold">
          Sign out
        </button>
      </div>
    </div>
  );
}
