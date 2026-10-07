import { NextResponse } from "next/server";
import { readAll, appendRow, deleteRow } from "@/lib/sheets";
import { SHEETS } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import { genId, nowISO } from "@/lib/utils";

// POST /api/push/subscribe — simpan langganan push untuk staff yang log masuk
export async function POST(req: Request) {
  try {
    const session = await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const body = await req.json();
    const endpoint = String(body.endpoint ?? "");
    const keys = body.keys ?? {};
    if (!endpoint || !keys.p256dh || !keys.auth) {
      return NextResponse.json({ ok: false, error: "Langganan tidak sah." }, { status: 400 });
    }

    const rows = await readAll<Record<string, string>>(SHEETS.PUSH_SUBSCRIPTIONS);
    const existing = rows.find((r) => r.endpoint === endpoint);
    if (existing) {
      return NextResponse.json({ ok: true, id: existing.id });
    }

    const id = genId("push");
    await appendRow(SHEETS.PUSH_SUBSCRIPTIONS, {
      id,
      staff_id: session.id,
      endpoint,
      keys_json: JSON.stringify(keys),
      created_at: nowISO(),
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// DELETE /api/push/subscribe?endpoint=...
export async function DELETE(req: Request) {
  try {
    await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);
    const endpoint = new URL(req.url).searchParams.get("endpoint") ?? "";
    const rows = await readAll<Record<string, string>>(SHEETS.PUSH_SUBSCRIPTIONS);
    const existing = rows.find((r) => r.endpoint === endpoint);
    if (existing) await deleteRow(SHEETS.PUSH_SUBSCRIPTIONS, existing.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
