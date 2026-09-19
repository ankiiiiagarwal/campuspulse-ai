"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Queue" },
  { href: "/admin/incidents", label: "Incident Detective" },
  { href: "/admin/locations", label: "QR locations" },
  { href: "/admin/campus", label: "Campus area" },
  { href: "/admin/departments", label: "Departments" },
  { href: "/admin/logs", label: "Activity log" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2 print:hidden">
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              active ? "bg-navy text-paper" : "border border-rule text-ink/80 hover:bg-white/70"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
