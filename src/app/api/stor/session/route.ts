import { NextResponse } from "next/server";
import { readAll } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import type { StorSession } from "@/lib/types";

// GET /api/stor/session — sesi stor yang sedang terbuka
// - App staff: guna cookie login (pulang maklumat penuh)
// - ESP32: guna header x-device-key (pulang status ringkas untuk buzzer/timer)
export async function GET(req: Request) {
  try {
    // Laluan peranti (ESP32)
    const deviceKey = req.headers.get("x-device-key") ?? "";
    const expected = process.env.DEVICE_API_KEY ?? "";
    if (expected && deviceKey === expected) {
      const sessions = await readAll<Record<string, string>>(SHEETS.STOR_SESSIONS);
      const open = sessions.find((s) => s.status === "open");
      if (!open) return NextResponse.json({ ok: true, session: null });
      return NextResponse.json({
        ok: true,
        session: { id: open.id, status: open.status, submit_deadline: open.submit_deadline },
      });
    }

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
