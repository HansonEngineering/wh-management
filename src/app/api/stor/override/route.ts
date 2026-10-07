import { NextResponse } from "next/server";
import { readAll, updateRow, appendRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO, todayMY } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

// POST /api/stor/override
// Supervisor atau admin tutup sesi yang tersangkut. Staff asal dapat demerit.
// Badan: { "session_id": "...", "reason": "..." }
export async function POST(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor"]);
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.session_id ?? "");
    const reason = String(body.reason ?? "Override oleh supervisor/admin");

    const sessions = await readAll<Record<string, string>>(SHEETS.STOR_SESSIONS);
    const stor = sessions.find((s) => s.id === sessionId);
    if (!stor) return NextResponse.json({ ok: false, error: "Sesi tidak dijumpai." }, { status: 404 });
    if (stor.status !== "open") {
      return NextResponse.json({ ok: false, error: "Sesi tidak dalam keadaan terbuka." }, { status: 409 });
    }

    const now = nowISO();
    await updateRow(SHEETS.STOR_SESSIONS, sessionId, {
      status: "overridden",
      overridden_by: session.id,
      updated_at: now,
    });

    // Demerit untuk staff yang tidak update
    await appendRow(SHEETS.MERIT_DEMERIT, {
      id: genId("md"),
      staff_id: stor.staff_id,
      date: todayMY(),
      type: "demerit",
      category: "stor_no_update",
      points: "1",
      description: `Tidak update stor dalam tempoh. Di-override. ${reason}`,
      reference_id: sessionId,
      given_by: session.id,
      created_at: now,
    });

    await logAudit(session.id, "override", "stor_session", sessionId, reason);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
