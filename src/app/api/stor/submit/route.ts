import { NextResponse } from "next/server";
import { readAll, appendRow, updateRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO, todayMY, timeMY } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

// POST /api/stor/submit
// Staff hantar item yang diambil (atau tujuan tanpa barang) untuk sesi stor yang terbuka.
// Badan: { "session_id": "...", "purpose": "take_stock" | "<nama tujuan>",
//          "purpose_notes": "...", "items": [{ "item_id": "...", "qty": 2 }] }
export async function POST(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const body = await req.json();
    const sessionId = String(body.session_id ?? "");
    const purpose = String(body.purpose ?? "take_stock");
    const purposeNotes = String(body.purpose_notes ?? "");
    const items: { item_id: string; qty: number }[] = Array.isArray(body.items) ? body.items : [];

    if (!sessionId) return NextResponse.json({ ok: false, error: "session_id diperlukan." }, { status: 400 });

    const sessions = await readAll<Record<string, string>>(SHEETS.STOR_SESSIONS);
    const stor = sessions.find((s) => s.id === sessionId);
    if (!stor) return NextResponse.json({ ok: false, error: "Sesi tidak dijumpai." }, { status: 404 });
    if (stor.staff_id !== session.id) {
      return NextResponse.json({ ok: false, error: "Sesi ini bukan milik anda." }, { status: 403 });
    }
    if (stor.status !== "open") {
      return NextResponse.json({ ok: false, error: "Sesi sudah ditutup." }, { status: 409 });
    }

    if (purpose === "take_stock") {
      const valid = items.filter((i) => i.item_id && Number(i.qty) > 0);
      if (valid.length === 0) {
        return NextResponse.json({ ok: false, error: "Sila pilih sekurang-kurangnya satu item dan jumlah." }, { status: 400 });
      }

      const itemsMaster = await readAll<Record<string, string>>(SHEETS.ITEMS);
      const date = todayMY();
      const time = timeMY();

      for (const line of valid) {
        const master = itemsMaster.find((m) => m.id === line.item_id);
        if (!master) continue;
        const qty = Number(line.qty);

        await appendRow(SHEETS.STOCK_MOVEMENTS, {
          id: genId("mv"),
          date,
          time,
          staff_id: session.id,
          item_id: line.item_id,
          qty: String(qty),
          movement_type: "OUT",
          reference_id: sessionId,
          notes: "",
          created_at: nowISO(),
        });

        const newStock = (Number(master.current_stock) || 0) - qty;
        await updateRow(SHEETS.ITEMS, line.item_id, {
          current_stock: String(newStock),
          updated_at: nowISO(),
        });
      }
    }

    const now = nowISO();
    await updateRow(SHEETS.STOR_SESSIONS, sessionId, {
      purpose,
      purpose_notes: purposeNotes,
      status: "submitted",
      submitted_at: now,
      updated_at: now,
    });
    await logAudit(session.id, "submit", "stor_session", sessionId, `purpose=${purpose} items=${items.length}`);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
