import { NextResponse } from "next/server";
import { readAll, appendRow, updateRow, getSetting } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO, todayMY, timeMY } from "@/lib/utils";
import type { Attendance } from "@/lib/types";

function parse(r: Record<string, string>): Attendance {
  return {
    id: r.id,
    staff_id: r.staff_id,
    date: r.date,
    clock_in: r.clock_in,
    clock_out: r.clock_out,
    shift_id: r.shift_id,
    status: r.status as Attendance["status"],
    late_minutes: Number(r.late_minutes) || 0,
    ot_hours: Number(r.ot_hours) || 0,
    notes: r.notes,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// GET /api/attendance?date=...&staff_id=...
export async function GET(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const staffId = searchParams.get("staff_id");
    let rows = (await readAll<Record<string, string>>(SHEETS.ATTENDANCE)).map(parse);
    if (session.role !== "admin" && session.role !== "supervisor") {
      rows = rows.filter((r) => r.staff_id === session.id);
    }
    if (date) rows = rows.filter((r) => r.date === date);
    if (staffId) rows = rows.filter((r) => r.staff_id === staffId);
    rows.sort((a, b) => b.date.localeCompare(a.date));
    return NextResponse.json({ ok: true, attendance: rows.slice(0, 200) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// POST /api/attendance — dipanggil oleh ESP32 thumbprint
// Badan: { "fingerprint_id": "..." } dengan header x-device-key
export async function POST(req: Request) {
  try {
    const deviceKey = req.headers.get("x-device-key") ?? "";
    const expected = process.env.DEVICE_API_KEY ?? "";
    if (!expected || deviceKey !== expected) {
      return NextResponse.json({ ok: false, error: "Device tidak sah." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const fpId = String(body.fingerprint_id ?? "").trim();
    if (!fpId) return NextResponse.json({ ok: false, error: "fingerprint_id diperlukan." }, { status: 400 });

    const staff = await readAll<Record<string, string>>(SHEETS.STAFF);
    const user = staff.find((s) => s.fingerprint_id === fpId && s.is_active === "true");
    if (!user) return NextResponse.json({ ok: false, error: "Cap jari tidak berdaftar." }, { status: 403 });

    const date = todayMY();
    const time = timeMY();
    const now = nowISO();

    const rows = await readAll<Record<string, string>>(SHEETS.ATTENDANCE);
    const existing = rows.find((r) => r.staff_id === user.id && r.date === date);

    // Kalau sudah ada rekod masuk, ini clock out
    if (existing && existing.clock_in) {
      await updateRow(SHEETS.ATTENDANCE, existing.id, { clock_out: time, updated_at: now });
      return NextResponse.json({ ok: true, action: "clock_out", name: user.name, time });
    }

    // Tentukan syif hari ini
    const schedules = await readAll<Record<string, string>>(SHEETS.SCHEDULES);
    const sched = schedules.find((s) => s.staff_id === user.id && s.date === date);
    const shiftId = sched?.shift_id ?? "";

    let status: Attendance["status"] = "unscheduled";
    let lateMinutes = 0;

    if (shiftId && shiftId !== "OFF" && shiftId !== "CUTI") {
      const shifts = await readAll<Record<string, string>>(SHEETS.SHIFTS);
      const shift = shifts.find((s) => s.id === shiftId);
      if (shift) {
        const grace = Number(await getSetting("late_grace_minutes")) || 10;
        const [sh, sm] = shift.start_time.split(":").map(Number);
        const [ch, cm] = time.split(":").map(Number);
        const startMin = sh * 60 + sm;
        const clockMin = ch * 60 + cm;
        lateMinutes = Math.max(0, clockMin - startMin);
        status = lateMinutes > grace ? "late" : "on_time";
      } else {
        status = "on_time";
      }
    } else if (shiftId === "CUTI") {
      status = "leave";
    }

    const id = genId("att");
    await appendRow(SHEETS.ATTENDANCE, {
      id,
      staff_id: user.id,
      date,
      clock_in: time,
      clock_out: "",
      shift_id: shiftId,
      status,
      late_minutes: String(lateMinutes),
      ot_hours: "0",
      notes: "",
      created_at: now,
      updated_at: now,
    });

    return NextResponse.json({ ok: true, action: "clock_in", name: user.name, time, status, late_minutes: lateMinutes });
  } catch (e) {
    console.error("Attendance gagal:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Ralat" },
      { status: 500 }
    );
  }
}
