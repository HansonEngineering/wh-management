"use client";

import { useEffect, useState, useCallback } from "react";
import type { SessionUser, Item, StorSession, StorPurpose } from "@/lib/types";

type OpenSession = (StorSession & { staff_name: string; is_mine: boolean }) | null;

export default function StorClient({ user }: { user: SessionUser }) {
  const [session, setSession] = useState<OpenSession>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [purposes, setPurposes] = useState<StorPurpose[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"take_stock" | "other">("take_stock");
  const [purposeId, setPurposeId] = useState("");
  const [purposeNotes, setPurposeNotes] = useState("");
  const [lines, setLines] = useState<{ item_id: string; qty: number }[]>([{ item_id: "", qty: 1 }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);

  const load = useCallback(async () => {
    const [sRes, iRes, pRes] = await Promise.all([
      fetch("/api/stor/session"),
      fetch("/api/items"),
      fetch("/api/stor/purposes"),
    ]);
    const s = await sRes.json();
    const i = await iRes.json();
    const p = await pRes.json();
    if (s.ok) setSession(s.session);
    if (i.ok) setItems(i.items.filter((x: Item) => x.is_active && x.is_tracked));
    if (p.ok) setPurposes(p.purposes.filter((x: StorPurpose) => x.is_active));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const ms = new Date(session.submit_deadline).getTime() - Date.now();
      setSecondsLeft(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [session]);

  function setLine(idx: number, field: "item_id" | "qty", value: string) {
    const next = [...lines];
    if (field === "item_id") next[idx].item_id = value;
    else next[idx].qty = Number(value) || 0;
    setLines(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setSaving(true);
    setError("");
    const purposeName = mode === "take_stock" ? "take_stock" : purposes.find((p) => p.id === purposeId)?.name ?? "lain-lain";
    const res = await fetch("/api/stor/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: session.id,
        purpose: purposeName,
        purpose_notes: purposeNotes,
        items: mode === "take_stock" ? lines.filter((l) => l.item_id && l.qty > 0) : [],
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.ok) {
      setError(data.error ?? "Gagal menghantar");
      return;
    }
    setLines([{ item_id: "", qty: 1 }]);
    setPurposeNotes("");
    load();
  }

  async function handleOverride() {
    if (!session) return;
    if (!confirm(`Override sesi ${session.staff_name}? Staff akan dapat demerit.`)) return;
    const res = await fetch("/api/stor/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: session.id }),
    });
    const data = await res.json();
    if (!data.ok) alert(data.error ?? "Gagal override");
    load();
  }

  if (loading) return <p className="text-sm text-neutral-500">Memuatkan...</p>;

  const mm = String(Math.floor(secondsLeft / 60)).padStart(1, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div>
      <h1 className="text-2xl font-semibold">Stor</h1>

      {!session && (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="text-neutral-600">Tiada sesi stor yang aktif sekarang.</p>
          <p className="mt-1 text-sm text-neutral-400">
            Imbas kad anda di scanner stor untuk membuka pintu dan memulakan sesi.
          </p>
        </div>
      )}

      {session && !session.is_mine && (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <p className="font-medium text-amber-800">Stor sedang digunakan oleh {session.staff_name}</p>
          <p className="mt-1 text-sm text-amber-700">
            Sila tunggu sehingga {session.staff_name} selesai mengemas kini.
          </p>
          {(user.role === "admin" || user.role === "supervisor") && (
            <button
              onClick={handleOverride}
              className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm text-white"
            >
              Override (tutup sesi)
            </button>
          )}
        </div>
      )}

      {session && session.is_mine && (
        <form onSubmit={handleSubmit} className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Sesi anda sedang aktif</h2>
            <span className={`rounded-lg px-3 py-1 text-sm font-mono ${secondsLeft < 60 ? "bg-red-100 text-red-700" : "bg-neutral-100"}`}>
              {mm}:{ss}
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Sila kemas kini sebelum tamat masa, kemudian tutup pintu stor.
          </p>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setMode("take_stock")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm ${mode === "take_stock" ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}
            >
              Ambil Stock
            </button>
            <button
              type="button"
              onClick={() => setMode("other")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm ${mode === "other" ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}
            >
              Tiada Barang Diambil
            </button>
          </div>

          {mode === "take_stock" ? (
            <div className="mt-4 space-y-3">
              {lines.map((line, idx) => (
                <div key={idx} className="flex gap-2">
                  <select
                    value={line.item_id}
                    onChange={(e) => setLine(idx, "item_id", e.target.value)}
                    className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  >
                    <option value="">Pilih item</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>{i.name} (stok: {i.current_stock})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={line.qty}
                    onChange={(e) => setLine(idx, "qty", e.target.value)}
                    className="w-20 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  />
                  {lines.length > 1 && (
                    <button type="button" onClick={() => setLines(lines.filter((_, i) => i !== idx))} className="rounded-lg border border-neutral-300 px-3 text-sm">
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setLines([...lines, { item_id: "", qty: 1 }])}
                className="text-sm text-neutral-600 underline"
              >
                + Tambah item lain
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <select
                value={purposeId}
                onChange={(e) => setPurposeId(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="">Pilih tujuan</option>
                {purposes.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input
                placeholder="Catatan (pilihan)"
                value={purposeNotes}
                onChange={(e) => setPurposeNotes(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="mt-5 w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Menghantar..." : "Hantar"}
          </button>
        </form>
      )}
    </div>
  );
}
