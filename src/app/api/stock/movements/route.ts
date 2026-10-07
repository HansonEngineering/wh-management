import { NextResponse } from "next/server";
import { readAll, appendRow, updateRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO, todayMY, timeMY } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import type { StockMovement } from "@/lib/types";

function parse(r: Record<string, string>): StockMovement {
  return {
    id: r.id,
    date: r.date,
    time: r.time,
    staff_id: r.staff_id,
    item_id: r.item_id,
    qty: Number(r.qty) || 0,
    movement_type: r.movement_type as StockMovement["movement_type"],
    reference_id: r.reference_id,
    notes: r.notes,
    created_at: r.created_at,
  };
}

// GET /api/stock/movements?date=YYYY-MM-DD&item_id=...
// Admin dan supervisor nampak semua. Staff lain nampak milik sendiri sahaja.
export async function GET(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const itemId = searchParams.get("item_id");

    let rows = (await readAll<Record<string, string>>(SHEETS.STOCK_MOVEMENTS)).map(parse);
    if (session.role !== "admin" && session.role !== "supervisor") {
      rows = rows.filter((r) => r.staff_id === session.id);
    }
    if (date) rows = rows.filter((r) => r.date === date);
    if (itemId) rows = rows.filter((r) => r.item_id === itemId);

    rows.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    return NextResponse.json({ ok: true, movements: rows.slice(0, 200) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// POST /api/stock/movements
// Admin/supervisor tambah stock masuk (IN) atau pelarasan (ADJUST).
// Staff biasa boleh pulangkan stock (RETURN).
export async function POST(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const body = await req.json();
    const itemId = String(body.item_id ?? "");
    const qty = Number(body.qty);
    const type = String(body.movement_type ?? "");
    const notes = String(body.notes ?? "");

    if (!itemId || !Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ ok: false, error: "Item dan kuantiti diperlukan." }, { status: 400 });
    }
    const isPriv = session.role === "admin" || session.role === "supervisor";
    if (type === "RETURN" && !isPriv) {
      // dibenarkan untuk semua staff
    } else if ((type === "IN" || type === "ADJUST") && !isPriv) {
      return NextResponse.json({ ok: false, error: "Hanya admin/supervisor boleh tambah stock masuk." }, { status: 403 });
    } else if (!["IN", "RETURN", "ADJUST"].includes(type)) {
      return NextResponse.json({ ok: false, error: "Jenis pergerakan tidak sah." }, { status: 400 });
    }

    const items = await readAll<Record<string, string>>(SHEETS.ITEMS);
    const item = items.find((i) => i.id === itemId);
    if (!item) return NextResponse.json({ ok: false, error: "Item tidak dijumpai." }, { status: 404 });

    await appendRow(SHEETS.STOCK_MOVEMENTS, {
      id: genId("mv"),
      date: todayMY(),
      time: timeMY(),
      staff_id: session.id,
      item_id: itemId,
      qty: String(qty),
      movement_type: type,
      reference_id: "",
      notes,
      created_at: nowISO(),
    });

    const delta = type === "ADJUST" ? qty - (Number(item.current_stock) || 0) : qty; // IN/RETURN tambah
    const newStock = type === "ADJUST" ? qty : (Number(item.current_stock) || 0) + delta;
    await updateRow(SHEETS.ITEMS, itemId, { current_stock: String(newStock), updated_at: nowISO() });
    await logAudit(session.id, "create", "stock_movement", itemId, `${type} ${qty}`);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
