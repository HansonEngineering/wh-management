import { NextResponse } from "next/server";
import { readAll, appendRow, updateRow, getSetting } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import type { Payroll } from "@/lib/types";

function parse(r: Record<string, string>): Payroll {
  return {
    id: r.id,
    staff_id: r.staff_id,
    month: r.month,
    basic_salary: Number(r.basic_salary) || 0,
    days_present: Number(r.days_present) || 0,
    days_absent: Number(r.days_absent) || 0,
    days_leave: Number(r.days_leave) || 0,
    late_count: Number(r.late_count) || 0,
    merit_points: Number(r.merit_points) || 0,
    demerit_points: Number(r.demerit_points) || 0,
    deduction_percent: Number(r.deduction_percent) || 0,
    deduction_amount: Number(r.deduction_amount) || 0,
    ot_hours: Number(r.ot_hours) || 0,
    ot_amount: Number(r.ot_amount) || 0,
    net_salary: Number(r.net_salary) || 0,
    status: r.status as Payroll["status"],
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// GET /api/payroll?month=YYYY-MM — admin sahaja
export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
    const month = new URL(req.url).searchParams.get("month") ?? "";
    let rows = (await readAll<Record<string, string>>(SHEETS.PAYROLL)).map(parse);
    if (month) rows = rows.filter((r) => r.month === month);
    rows.sort((a, b) => b.month.localeCompare(a.month));
    return NextResponse.json({ ok: true, payroll: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// POST /api/payroll — jana gaji untuk satu bulan (admin)
// Badan: { "month": "2026-10" }
export async function POST(req: Request) {
  try {
    const session = await requireRole(["admin"]);
    const body = await req.json().catch(() => ({}));
    const month = String(body.month ?? "");
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ ok: false, error: "Format bulan mesti YYYY-MM." }, { status: 400 });
    }

    const staff = await readAll<Record<string, string>>(SHEETS.STAFF);
    const attendance = await readAll<Record<string, string>>(SHEETS.ATTENDANCE);
    const md = await readAll<Record<string, string>>(SHEETS.MERIT_DEMERIT);
    const existing = await readAll<Record<string, string>>(SHEETS.PAYROLL);

    const tiersRaw = await getSetting("deduction_tiers");
    const maxDeduction = Number(await getSetting("max_deduction_percent")) || 10;
    let tiers: { min: number; max: number; percent: number }[] = [];
    try {
      tiers = JSON.parse(tiersRaw);
    } catch {
      tiers = [];
    }

    const results: { staff: string; net: number }[] = [];
    const now = nowISO();

    for (const s of staff) {
      if (s.is_active !== "true" || s.role === "admin") continue;

      const att = attendance.filter((a) => a.staff_id === s.id && a.date.startsWith(month));
      const present = att.filter((a) => ["on_time", "late", "unscheduled"].includes(a.status)).length;
      const absent = att.filter((a) => a.status === "absent" || a.status === "absent_no_notice").length;
      const leave = att.filter((a) => a.status === "leave").length;
      const lateCount = att.filter((a) => a.status === "late").length;
      const otHours = att.reduce((sum, a) => sum + (Number(a.ot_hours) || 0), 0);

      const points = md.filter((m) => m.staff_id === s.id && m.date.startsWith(month));
      const merit = points.filter((m) => m.type === "merit").reduce((sum, m) => sum + (Number(m.points) || 0), 0);
      const demerit = points.filter((m) => m.type === "demerit").reduce((sum, m) => sum + (Number(m.points) || 0), 0);

      // Kira peratus potongan ikut demerit
      let deductionPercent = 0;
      for (const t of tiers) {
        if (demerit >= t.min && demerit <= t.max) {
          deductionPercent = t.percent;
          break;
        }
      }
      deductionPercent = Math.min(deductionPercent, maxDeduction);

      const basic = Number(s.basic_salary) || 0;
      const otRate = Number(s.ot_rate_per_hour) || 0;
      const otAmount = otHours * otRate;
      const deductionAmount = (basic * deductionPercent) / 100;
      const net = basic + otAmount - deductionAmount;

      const existingRow = existing.find((p) => p.staff_id === s.id && p.month === month);
      const fields = {
        staff_id: s.id,
        month,
        basic_salary: String(basic),
        days_present: String(present),
        days_absent: String(absent),
        days_leave: String(leave),
        late_count: String(lateCount),
        merit_points: String(merit),
        demerit_points: String(demerit),
        deduction_percent: String(deductionPercent),
        deduction_amount: deductionAmount.toFixed(2),
        ot_hours: String(otHours),
        ot_amount: otAmount.toFixed(2),
        net_salary: net.toFixed(2),
        status: "draft",
        updated_at: now,
      };

      if (existingRow) {
        await updateRow(SHEETS.PAYROLL, existingRow.id, fields);
      } else {
        await appendRow(SHEETS.PAYROLL, { id: genId("pay"), ...fields, created_at: now });
      }
      results.push({ staff: s.name, net });
    }

    await logAudit(session.id, "generate", "payroll", month, `${results.length} staff`);
    return NextResponse.json({ ok: true, generated: results.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// PUT — finalize payroll (admin)
export async function PUT(req: Request) {
  try {
    const session = await requireRole(["admin"]);
    const body = await req.json();
    const id = String(body.id ?? "");
    const ok = await updateRow(SHEETS.PAYROLL, id, { status: "finalized", updated_at: nowISO() });
    if (!ok) return NextResponse.json({ ok: false, error: "Tidak dijumpai." }, { status: 404 });
    await logAudit(session.id, "finalize", "payroll", id, "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
