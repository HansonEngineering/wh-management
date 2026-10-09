import { NextResponse } from "next/server";
import { readAll, updateRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { nowISO } from "@/lib/utils";

// POST /api/stor/door
// Dipanggil oleh ESP32 apabila sensor pintu berubah.
// Badan: { "closed": true | false }
export async function POST(req: Request) {
  try {
    const deviceKey = req.headers.get("x-device-key") ?? "";
    const expected = process.env.DEVICE_API_KEY ?? "";
    if (!expected || deviceKey !== expected) {
      return NextResponse.json({ ok: false, error: "Device tidak sah." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const closed = body.closed === true;

    const sessions = await readAll<Record<string, string>>(SHEETS.STOR_SESSIONS);
    const open = sessions.find((s) => s.status === "open" || s.status === "submitted");
    if (!open) return NextResponse.json({ ok: true, message: "Tiada sesi aktif." });

    // Pintu tutup HANYA direkod. Sesi kekal "open" sehingga staff SUBMIT dalam app.
    // (Anchor error = submit dalam 5 minit, bukan status pintu.)
    if (closed) {
      const patch: Record<string, string> = {
        door_closed_at: nowISO(),
        updated_at: nowISO(),
      };
      if (open.status === "submitted") patch.status = "closed";
      await updateRow(SHEETS.STOR_SESSIONS, open.id, patch);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Door update gagal:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Ralat" },
      { status: 500 }
    );
  }
}
