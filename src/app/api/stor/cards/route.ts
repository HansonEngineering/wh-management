import { NextResponse } from "next/server";
import { readAll } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { toBool } from "@/lib/utils";

// GET /api/stor/cards — senarai kad RFID aktif untuk cache ESP32
export async function GET(req: Request) {
  try {
    const deviceKey = req.headers.get("x-device-key") ?? "";
    const expected = process.env.DEVICE_API_KEY ?? "";
    if (!expected || deviceKey !== expected) {
      return NextResponse.json({ ok: false, error: "Device tidak sah." }, { status: 401 });
    }

    const staff = await readAll<Record<string, string>>(SHEETS.STAFF);
    const cards = staff
      .filter((s) => toBool(s.is_active) && String(s.rfid_uid ?? "").trim())
      .map((s) => ({ rfid_uid: String(s.rfid_uid).trim(), name: s.name }));

    return NextResponse.json({ ok: true, cards });
  } catch (e) {
    console.error("Stor cards gagal:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Ralat" },
      { status: 500 }
    );
  }
}
