import { NextResponse } from "next/server";
import { readAll, updateRow, appendRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO, todayMY } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import type { StockAlert } from "@/lib/types";

function parse(r: Record<string, string>): StockAlert {
  return {
    id: r.id,
    date: r.date,
    item_id: r.item_id,
    responsible_staff_id: r.responsible_staff_id,
    expected_max: Number(r.expected_max) || 0,
    total_so: Number(r.total_so) || 0,
    variance: Number(r.variance) || 0,
    guest_requests_note: r.guest_requests_note,
    status: r.status as StockAlert["status"],
    decided_by: r.decided_by,
    decision_notes: r.decision_notes,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// GET — admin/supervisor nampak semua; staff nampak alert item jagaan dia
export async function GET() {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping"]);
    let rows = (await readAll<Record<string, string>>(SHEETS.STOCK_ALERTS)).map(parse);
    if (session.role !== "admin" && session.role !== "supervisor") {
      rows = rows.filter((a) => a.responsible_staff_id === session.id);
    }
    rows.sort((a, b) => b.date.localeCompare(a.date));
    return NextResponse.json({ ok: true, alerts: rows.slice(0, 100) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// PUT — admin putuskan alert: demerit atau excuse
export async function PUT(req: Request) {
  try {
    const session = await requireRole(["admin"]);
    const body = await req.json();
    const id = String(body.id ?? "");
    const action = String(body.action ?? ""); // "demerit" | "excuse"
    const notes = String(body.decision_notes ?? "");

    const alerts = await readAll<Record<string, string>>(SHEETS.STOCK_ALERTS);
    const alert = alerts.find((a) => a.id === id);
    if (!alert) return NextResponse.json({ ok: false, error: "Alert tidak dijumpai." }, { status: 404 });

    const now = nowISO();
    const status = action === "demerit" ? "demerit_given" : "excused";

    if (action === "demerit" && alert.responsible_staff_id) {
      const items = await readAll<Record<string, string>>(SHEETS.ITEMS);
      const item = items.find((i) => i.id === alert.item_id);
      await appendRow(SHEETS.MERIT_DEMERIT, {
        id: genId("md"),
        staff_id: alert.responsible_staff_id,
        date: todayMY(),
        type: "demerit",
        category: "stock_overuse",
        points: "1",
        description: `Terlebih guna ${item?.name ?? "item"}: ${alert.variance}. ${notes}`,
        reference_id: id,
        given_by: session.id,
        created_at: now,
      });
    }

    await updateRow(SHEETS.STOCK_ALERTS, id, {
      status,
      decided_by: session.id,
      decision_notes: notes,
      updated_at: now,
    });
    await logAudit(session.id, "decide", "stock_alert", id, action);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
