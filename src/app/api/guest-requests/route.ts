import { NextResponse } from "next/server";
import { readAll, appendRow, updateRow, getSetting } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO, todayMY, timeMY } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import type { GuestRequest } from "@/lib/types";

function parse(r: Record<string, string>): GuestRequest {
  return {
    id: r.id,
    date: r.date,
    time: r.time,
    room_id: r.room_id,
    item_id: r.item_id,
    qty: Number(r.qty) || 0,
    requested_by: r.requested_by,
    status: r.status as GuestRequest["status"],
    approved_by: r.approved_by,
    handled_by: r.handled_by,
    completed_at: r.completed_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// GET — receptionist nampak permintaan dia; housekeeping nampak yang approved; admin/supervisor semua
export async function GET() {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping", "receptionist"]);
    let rows = (await readAll<Record<string, string>>(SHEETS.GUEST_REQUESTS)).map(parse);
    if (session.role === "receptionist") rows = rows.filter((r) => r.requested_by === session.id);
    if (session.role === "housekeeping") rows = rows.filter((r) => r.status === "approved" || r.handled_by === session.id);
    rows.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    return NextResponse.json({ ok: true, requests: rows.slice(0, 100) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// POST — hanya receptionist boleh rekod permintaan
export async function POST(req: Request) {
  try {
    const session = await requireRole(["receptionist", "admin", "supervisor"]);
    const body = await req.json();
    const roomId = String(body.room_id ?? "");
    const itemId = String(body.item_id ?? "");
    const qty = Number(body.qty);
    if (!roomId || !itemId || !Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ ok: false, error: "Bilik, item dan kuantiti diperlukan." }, { status: 400 });
    }

    // Semak bilik wujud
    const rooms = await readAll<Record<string, string>>(SHEETS.ROOMS);
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return NextResponse.json({ ok: false, error: "Bilik tidak dijumpai." }, { status: 404 });

    // Semak bilik ada tetamu (melalui status hari ini)
    const statuses = await readAll<Record<string, string>>(SHEETS.ROOM_STATUSES);
    const today = todayMY();
    const st = statuses.find((s) => s.room_id === roomId && s.date === today);
    if (st && st.cleaning_status === "none" && st.is_lnb !== "true") {
      return NextResponse.json({ ok: false, error: "Bilik ini tiada tetamu hari ini." }, { status: 409 });
    }

    // Semak had harian
    const limit = Number(await getSetting("guest_request_daily_limit")) || 2;
    const all = await readAll<Record<string, string>>(SHEETS.GUEST_REQUESTS);
    const todayCount = all
      .filter((r) => r.room_id === roomId && r.item_id === itemId && r.date === today && r.status !== "rejected")
      .reduce((sum, r) => sum + (Number(r.qty) || 0), 0);

    const needsApproval = todayCount + qty > limit;
    const status = needsApproval ? "pending_approval" : "approved";

    const id = genId("gr");
    const now = nowISO();
    await appendRow(SHEETS.GUEST_REQUESTS, {
      id,
      date: today,
      time: timeMY(),
      room_id: roomId,
      item_id: itemId,
      qty: String(qty),
      requested_by: session.id,
      status,
      approved_by: needsApproval ? "" : session.id,
      handled_by: "",
      completed_at: "",
      created_at: now,
      updated_at: now,
    });
    await logAudit(session.id, "create", "guest_request", id, `room=${room.room_number} qty=${qty} ${status}`);

    return NextResponse.json({ ok: true, id, status, needsApproval });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// PUT — approve/reject (admin/supervisor) atau tanda siap (housekeeping)
export async function PUT(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping"]);
    const body = await req.json();
    const id = String(body.id ?? "");
    const action = String(body.action ?? ""); // "approve" | "reject" | "complete"

    const rows = await readAll<Record<string, string>>(SHEETS.GUEST_REQUESTS);
    const gr = rows.find((r) => r.id === id);
    if (!gr) return NextResponse.json({ ok: false, error: "Permintaan tidak dijumpai." }, { status: 404 });

    const now = nowISO();

    if (action === "approve" || action === "reject") {
      if (session.role !== "admin" && session.role !== "supervisor") {
        return NextResponse.json({ ok: false, error: "Hanya admin/supervisor boleh meluluskan." }, { status: 403 });
      }
      await updateRow(SHEETS.GUEST_REQUESTS, id, {
        status: action === "approve" ? "approved" : "rejected",
        approved_by: session.id,
        updated_at: now,
      });
    } else if (action === "complete") {
      if (gr.status !== "approved") {
        return NextResponse.json({ ok: false, error: "Permintaan belum diluluskan." }, { status: 409 });
      }
      await updateRow(SHEETS.GUEST_REQUESTS, id, {
        status: "completed",
        handled_by: session.id,
        completed_at: now,
        updated_at: now,
      });
    } else {
      return NextResponse.json({ ok: false, error: "Tindakan tidak sah." }, { status: 400 });
    }

    await logAudit(session.id, action, "guest_request", id, "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
