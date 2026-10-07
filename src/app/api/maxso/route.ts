import { NextResponse } from "next/server";
import { readAll, appendRow, updateRow, deleteRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import type { RoomTypeMaxSO } from "@/lib/types";

function parse(r: Record<string, string>): RoomTypeMaxSO {
  return {
    id: r.id,
    room_type_id: r.room_type_id,
    item_id: r.item_id,
    max_so: Number(r.max_so) || 0,
    min_so: Number(r.min_so) || 0,
    updated_at: r.updated_at,
  };
}

export async function GET() {
  try {
    await requireRole(["admin", "supervisor"]);
    const rows = await readAll<Record<string, string>>(SHEETS.ROOM_TYPE_MAXSO);
    return NextResponse.json({ ok: true, maxso: rows.map(parse) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// POST: set nilai MaxSO/MinSO untuk satu pasangan jenis bilik + item.
// Kalau sudah wujud, ia dikemas kini.
export async function POST(req: Request) {
  try {
    const session = await requireRole(["admin"]);
    const body = await req.json();
    const roomTypeId = String(body.room_type_id ?? "");
    const itemId = String(body.item_id ?? "");
    const maxSo = Number(body.max_so);
    const minSo = Number(body.min_so ?? 0);
    if (!roomTypeId || !itemId || !Number.isFinite(maxSo)) {
      return NextResponse.json({ ok: false, error: "Jenis bilik, item dan MaxSO diperlukan." }, { status: 400 });
    }

    const rows = await readAll<Record<string, string>>(SHEETS.ROOM_TYPE_MAXSO);
    const existing = rows.find((r) => r.room_type_id === roomTypeId && r.item_id === itemId);
    if (existing) {
      await updateRow(SHEETS.ROOM_TYPE_MAXSO, existing.id, {
        max_so: String(maxSo),
        min_so: String(minSo),
        updated_at: nowISO(),
      });
      await logAudit(session.id, "update", "maxso", existing.id, `${roomTypeId}/${itemId} max=${maxSo} min=${minSo}`);
      return NextResponse.json({ ok: true, id: existing.id });
    }

    const id = genId("maxso");
    await appendRow(SHEETS.ROOM_TYPE_MAXSO, {
      id,
      room_type_id: roomTypeId,
      item_id: itemId,
      max_so: String(maxSo),
      min_so: String(minSo),
      updated_at: nowISO(),
    });
    await logAudit(session.id, "create", "maxso", id, `${roomTypeId}/${itemId} max=${maxSo} min=${minSo}`);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireRole(["admin"]);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return NextResponse.json({ ok: false, error: "ID diperlukan." }, { status: 400 });
    const ok = await deleteRow(SHEETS.ROOM_TYPE_MAXSO, id);
    if (!ok) return NextResponse.json({ ok: false, error: "Rekod tidak dijumpai." }, { status: 404 });
    await logAudit(session.id, "delete", "maxso", id, "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
