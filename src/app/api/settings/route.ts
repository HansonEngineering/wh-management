import { NextResponse } from "next/server";
import { getAllSettings, setSetting } from "@/lib/sheets";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    await requireRole(["admin", "supervisor"]);
    const settings = await getAllSettings();
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireRole(["admin"]);
    const body = await req.json();
    const entries = Object.entries(body.settings ?? {}) as [string, string][];
    if (entries.length === 0) {
      return NextResponse.json({ ok: false, error: "Tiada setting dihantar." }, { status: 400 });
    }
    for (const [key, value] of entries) {
      await setSetting(key, String(value));
    }
    await logAudit(session.id, "update", "settings", "", entries.map(([k]) => k).join(", "));
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
