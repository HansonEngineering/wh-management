import { NextResponse } from "next/server";
import { readAll } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import type { StorSession } from "@/lib/types";

// GET /api/stor/session — sesi stor yang sedang terbuka (untuk app staff)
export async function GET() {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const sessions = await readAll<Record<string, string>>(SHEETS.STOR_SESSIONS);
    const open = sessions.find((s) => s.status === "open");
    if (!open) return NextResponse.json({ ok: true, session: null });

    const staff = await readAll<Record<string, string>>(SHEETS.STAFF);
    const owner = staff.find((s) => s.id === open.staff_id);

    const out: StorSession & { staff_name: string; is_mine: boolean } = {
      id: open.id,
      staff_id: open.staff_id,
      opened_at: open.opened_at,
      submit_deadline: open.submit_deadline,
      door_deadline: open.door_deadline,
      purpose: open.purpose,
      purpose_notes: open.purpose_notes,
      status: open.status as StorSession["status"],
      submitted_at: open.submitted_at,
      door_closed_at: open.door_closed_at,
      overridden_by: open.overridden_by,
      created_at: open.created_at,
      updated_at: open.updated_at,
      staff_name: owner?.name ?? "",
      is_mine: open.staff_id === session.id,
    };
    return NextResponse.json({ ok: true, session: out });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
