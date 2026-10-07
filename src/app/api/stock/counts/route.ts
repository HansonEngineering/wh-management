import { NextResponse } from "next/server";
import { readAll, appendRow, updateRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO, todayMY } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import type { StockCount } from "@/lib/types";

function parse(r: Record<string, string>): StockCount {
  return {
    id: r.id,
    date: r.date,
    item_id: r.item_id,
    counted_by: r.counted_by,
    system_qty: Number(r.system_qty) || 0,
    physical_qty: Number(r.physical_qty) || 0,
    variance: Number(r.variance) || 0,
    status: r.status as StockCount["status"],
    decided_by: r.decided_by,
    decision_notes: r.decision_notes,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// GET — admin/supervisor nampak semua; staff nampak item jagaan dia sahaja
export async function GET() {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping"]);
    const rows = (await readAll<Record<string, string>>(SHEETS.STOCK_COUNTS)).map(parse);
    if (session.role === "admin" || session.role === "supervisor") {
      return NextResponse.json({ ok: true, counts: rows });
    }
    const items = await readAll<Record<string, string>>(SHEETS.ITEMS);
    const myItems = new Set(items.filter((i) => i.responsible_staff_id === session.id).map((i) => i.id));
    return NextResponse.json({ ok: true, counts: rows.filter((c) => myItems.has(c.item_id)) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// POST — staff hantar kiraan fizikal. Variance dikira automatik.
export async function POST(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping"]);
    const body = await req.json();
    const itemId = String(body.item_id ?? "");
    const physicalQty = Number(body.physical_qty);
    if (!itemId || !Number.isFinite(physicalQty) || physicalQty < 0) {
      return NextResponse.json({ ok: false, error: "Item dan kiraan fizikal diperlukan." }, { status: 400 });
    }

    const items = await readAll<Record<string, string>>(SHEETS.ITEMS);
    const item = items.find((i) => i.id === itemId);
    if (!item) return NextResponse.json({ ok: false, error: "Item tidak dijumpai." }, { status: 404 });

    const systemQty = Number(item.current_stock) || 0;
    const variance = physicalQty - systemQty;
    const id = genId("sc");
    const now = nowISO();

    await appendRow(SHEETS.STOCK_COUNTS, {
      id,
      date: todayMY(),
      item_id: itemId,
      counted_by: session.id,
      system_qty: String(systemQty),
      physical_qty: String(physicalQty),
      variance: String(variance),
      status: variance === 0 ? "resolved" : "pending_decision",
      decided_by: "",
      decision_notes: "",
      created_at: now,
      updated_at: now,
    });
    await logAudit(session.id, "create", "stock_count", id, `${item.name}: system=${systemQty} fizikal=${physicalQty}`);

    return NextResponse.json({ ok: true, id, variance });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// PUT — admin putuskan kiraan yang ada variance (selaraskan stok / demerit)
export async function PUT(req: Request) {
  try {
    const session = await requireRole(["admin"]);
    const body = await req.json();
    const id = String(body.id ?? "");
    const action = String(body.action ?? ""); // "adjust" | "demerit" | "excuse"
    const notes = String(body.decision_notes ?? "");

    const counts = await readAll<Record<string, string>>(SHEETS.STOCK_COUNTS);
    const count = counts.find((c) => c.id === id);
    if (!count) return NextResponse.json({ ok: false, error: "Kiraan tidak dijumpai." }, { status: 404 });

    const now = nowISO();

    if (action === "adjust") {
      // Selaraskan stok sistem kepada kiraan fizikal
      await updateRow(SHEETS.ITEMS, count.item_id, { current_stock: count.physical_qty, updated_at: now });
    }
    if (action === "demerit") {
      const items = await readAll<Record<string, string>>(SHEETS.ITEMS);
      const item = items.find((i) => i.id === count.item_id);
      if (item?.responsible_staff_id) {
        await appendRow(SHEETS.MERIT_DEMERIT, {
          id: genId("md"),
          staff_id: item.responsible_staff_id,
          date: todayMY(),
          type: "demerit",
          category: "stock_variance",
          points: "1",
          description: `Variance stok ${item.name}: ${count.variance}. ${notes}`,
          reference_id: id,
          given_by: session.id,
          created_at: now,
        });
      }
      await updateRow(SHEETS.ITEMS, count.item_id, { current_stock: count.physical_qty, updated_at: now });
    }

    await updateRow(SHEETS.STOCK_COUNTS, id, {
      status: "resolved",
      decided_by: session.id,
      decision_notes: `${action}: ${notes}`,
      updated_at: now,
    });
    await logAudit(session.id, "decide", "stock_count", id, action);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
