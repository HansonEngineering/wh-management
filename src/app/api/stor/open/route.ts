import { NextResponse } from "next/server";
import { readAll, appendRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { genId, nowISO, toBool } from "@/lib/utils";
import { getSetting } from "@/lib/sheets";

// POST /api/stor/open
// Dipanggil oleh ESP32 selepas kad RFID diimbas.
// Badan: { "rfid_uid": "...", "device_key": "..." }
export async function POST(req: Request) {
  try {
    const deviceKey = req.headers.get("x-device-key") ?? "";
    const expected = process.env.DEVICE_API_KEY ?? "";
    if (!expected || deviceKey !== expected) {
      return NextResponse.json({ ok: false, error: "Device tidak sah." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const rfid = String(body.rfid_uid ?? "").trim();
    if (!rfid) return NextResponse.json({ ok: false, error: "rfid_uid diperlukan." }, { status: 400 });

    const staff = await readAll<Record<string, string>>(SHEETS.STAFF);
    const user = staff.find((s) => s.rfid_uid === rfid && toBool(s.is_active));
    if (!user) {
      return NextResponse.json({ ok: false, error: "Kad tidak berdaftar." }, { status: 403 });
    }

    // Halang kalau ada sesi lain yang masih terbuka
    const sessions = await readAll<Record<string, string>>(SHEETS.STOR_SESSIONS);
    const openSession = sessions.find((s) => s.status === "open");
    if (openSession) {
      const owner = staff.find((s) => s.id === openSession.staff_id);
      return NextResponse.json(
        { ok: false, error: `Stor sedang digunakan oleh ${owner?.name ?? "staff lain"}.`, blocked_by: owner?.name ?? "" },
        { status: 409 }
      );
    }

    const timerMin = Number(await getSetting("stor_timer_minutes")) || 5;
    const now = new Date();
    const deadline = new Date(now.getTime() + timerMin * 60 * 1000);
    const id = genId("stor");

    await appendRow(SHEETS.STOR_SESSIONS, {
      id,
      staff_id: user.id,
      opened_at: now.toISOString(),
      submit_deadline: deadline.toISOString(),
      door_deadline: deadline.toISOString(),
      purpose: "",
      purpose_notes: "",
      status: "open",
      submitted_at: "",
      door_closed_at: "",
      overridden_by: "",
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    return NextResponse.json({
      ok: true,
      session_id: id,
      staff_name: user.name,
      staff_id: user.id,
      timer_minutes: timerMin,
      submit_deadline: deadline.toISOString(),
    });
  } catch (e) {
    console.error("Stor open gagal:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Ralat" },
      { status: 500 }
    );
  }
}
