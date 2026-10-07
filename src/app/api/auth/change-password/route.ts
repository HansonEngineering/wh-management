import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { readAll, updateRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { nowISO } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

// POST /api/auth/change-password
// Staff tukar kata laluan sendiri. Perlu kata laluan lama.
export async function POST(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const body = await req.json();
    const oldPassword = String(body.old_password ?? "");
    const newPassword = String(body.new_password ?? "");

    if (newPassword.length < 6) {
      return NextResponse.json({ ok: false, error: "Kata laluan baru mesti sekurang-kurangnya 6 aksara." }, { status: 400 });
    }

    const staff = await readAll<Record<string, string>>(SHEETS.STAFF);
    const user = staff.find((s) => s.id === session.id);
    if (!user) return NextResponse.json({ ok: false, error: "Pengguna tidak dijumpai." }, { status: 404 });

    const match = await bcrypt.compare(oldPassword, user.password_hash);
    if (!match) {
      return NextResponse.json({ ok: false, error: "Kata laluan lama salah." }, { status: 401 });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await updateRow(SHEETS.STAFF, session.id, { password_hash: hash, updated_at: nowISO() });
    await logAudit(session.id, "change_password", "staff", session.id, "");

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
