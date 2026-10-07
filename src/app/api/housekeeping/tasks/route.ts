import { NextResponse } from "next/server";
import { readAll, appendRow, updateRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO, todayMY } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import type { HousekeepingTask } from "@/lib/types";

function parse(r: Record<string, string>): HousekeepingTask {
  return {
    id: r.id,
    date: r.date,
    room_id: r.room_id,
    assigned_to: r.assigned_to,
    checklist_json: r.checklist_json,
    status: r.status as HousekeepingTask["status"],
    started_at: r.started_at,
    submitted_by: r.submitted_by,
    submitted_at: r.submitted_at,
    created_at: r.created_at,
  };
}

// GET — housekeeping nampak tugas hari ini; admin/supervisor nampak semua
export async function GET(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping"]);
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") ?? todayMY();
    let rows = (await readAll<Record<string, string>>(SHEETS.HOUSEKEEPING_TASKS)).map(parse);
    rows = rows.filter((t) => t.date === date);
    if (session.role === "housekeeping") {
      rows = rows.filter((t) => t.status === "pending" || t.assigned_to === session.id || t.submitted_by === session.id);
    }
    return NextResponse.json({ ok: true, tasks: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// POST — cipta tugas (dipanggil oleh system Exely atau admin manual)
export async function POST(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor"]);
    const body = await req.json();
    const roomId = String(body.room_id ?? "");
    const date = String(body.date ?? todayMY());
    if (!roomId) return NextResponse.json({ ok: false, error: "room_id diperlukan." }, { status: 400 });

    // Elak pendua untuk bilik + tarikh yang sama
    const existing = await readAll<Record<string, string>>(SHEETS.HOUSEKEEPING_TASKS);
    if (existing.some((t) => t.room_id === roomId && t.date === date && t.status !== "done")) {
      return NextResponse.json({ ok: false, error: "Tugas untuk bilik ini sudah wujud." }, { status: 409 });
    }

    const id = genId("hk");
    await appendRow(SHEETS.HOUSEKEEPING_TASKS, {
      id,
      date,
      room_id: roomId,
      assigned_to: "",
      checklist_json: "[]",
      status: "pending",
      started_at: "",
      submitted_by: "",
      submitted_at: "",
      created_at: nowISO(),
    });
    await logAudit(session.id, "create", "housekeeping_task", id, roomId);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// PUT — housekeeping mula / submit checklist
export async function PUT(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping"]);
    const body = await req.json();
    const id = String(body.id ?? "");
    const action = String(body.action ?? ""); // "start" | "submit"
    const checklist = Array.isArray(body.checklist) ? body.checklist : [];

    const rows = await readAll<Record<string, string>>(SHEETS.HOUSEKEEPING_TASKS);
    const task = rows.find((t) => t.id === id);
    if (!task) return NextResponse.json({ ok: false, error: "Tugas tidak dijumpai." }, { status: 404 });

    const now = nowISO();

    if (action === "start") {
      await updateRow(SHEETS.HOUSEKEEPING_TASKS, id, {
        status: "in_progress",
        assigned_to: session.id,
        started_at: now,
      });
    } else if (action === "submit") {
      await updateRow(SHEETS.HOUSEKEEPING_TASKS, id, {
        status: "done",
        checklist_json: JSON.stringify(checklist),
        submitted_by: session.id,
        submitted_at: now,
      });
      // Tandakan bilik sebagai bersih
      const statuses = await readAll<Record<string, string>>(SHEETS.ROOM_STATUSES);
      const st = statuses.find((s) => s.room_id === task.room_id && s.date === task.date);
      if (st) {
        await updateRow(SHEETS.ROOM_STATUSES, st.id, { cleaning_status: "clean", updated_at: now });
      }
    } else {
      return NextResponse.json({ ok: false, error: "Tindakan tidak sah." }, { status: 400 });
    }

    await logAudit(session.id, action, "housekeeping_task", id, "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
