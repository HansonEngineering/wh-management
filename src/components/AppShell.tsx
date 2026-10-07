"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { SessionUser } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/constants";

interface NavItem {
  href: string;
  label: string;
  roles: string[];
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "supervisor", "housekeeping", "maintenance", "receptionist"] },
  { href: "/dashboard/bilik", label: "Bilik", roles: ["admin", "supervisor", "housekeeping", "receptionist"] },
  { href: "/dashboard/stor", label: "Stor", roles: ["admin", "supervisor", "housekeeping", "maintenance", "receptionist"] },
  { href: "/dashboard/stok", label: "Stok", roles: ["admin", "supervisor", "housekeeping"] },
  { href: "/dashboard/report", label: "Report", roles: ["admin", "supervisor", "housekeeping", "maintenance", "receptionist"] },
  { href: "/dashboard/jadual", label: "Jadual Syif", roles: ["admin", "supervisor", "housekeeping", "maintenance", "receptionist"] },
  { href: "/dashboard/cuti", label: "Cuti", roles: ["admin", "supervisor", "housekeeping", "maintenance", "receptionist"] },
  { href: "/dashboard/kehadiran", label: "Kehadiran", roles: ["admin", "supervisor", "housekeeping", "maintenance", "receptionist"] },
  { href: "/dashboard/gaji", label: "Gaji", roles: ["admin"] },
  { href: "/dashboard/settings", label: "Settings", roles: ["admin"] },
];

export default function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const items = NAV.filter((n) => n.roles.includes(user.role));

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="sticky top-0 z-20 bg-neutral-900 text-white">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-lg p-2 hover:bg-neutral-800"
              aria-label="Menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <span className="font-semibold">WH Management</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline text-neutral-300">
              {user.name} · {ROLE_LABELS[user.role]}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800"
            >
              Log Keluar
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <nav
            className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl p-4 space-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 pb-3 border-b border-neutral-200">
              <p className="font-semibold">{user.name}</p>
              <p className="text-sm text-neutral-500">{ROLE_LABELS[user.role]}</p>
            </div>
            {items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`block rounded-lg px-3 py-2 text-sm ${
                    active ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6">{children}</main>

      <nav className="sticky bottom-0 z-20 border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-5xl flex justify-around">
          {items.slice(0, 5).map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 py-2.5 text-center text-xs ${
                  active ? "font-semibold text-neutral-900" : "text-neutral-500"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
