"use client";

import { useEffect, useState, useCallback } from "react";
import type { SessionUser, Item, StockAlert, StockCount, StockMovement, Staff } from "@/lib/types";

export default function StokClient({ user }: { user: SessionUser }) {
  const [items, setItems] = useState<Item[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [counts, setCounts] = useState<StockCount[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"baki" | "alert" | "kiraan" | "log">("baki");
  const [countForm, setCountForm] = useState<{ item_id: string; qty: string }>({ item_id: "", qty: "" });

  const isPriv = user.role === "admin" || user.role === "supervisor";

  const load = useCallback(async () => {
    const fetches: Promise<Response>[] = [
      fetch("/api/items"),
      fetch("/api/stock/alerts"),
      fetch("/api/stock/counts"),
      fetch("/api/stock/movements"),
    ];
    if (isPriv) fetches.push(fetch("/api/staff"));
    const [iRes, aRes, cRes, mRes, sRes] = await Promise.all(fetches);
    const i = await iRes.json();
    const a = await aRes.json();
    const c = await cRes.json();
    const m = await mRes.json();
    if (i.ok) setItems(i.items);
    if (a.ok) setAlerts(a.alerts);
    if (c.ok) setCounts(c.counts);
    if (m.ok) setMovements(m.movements);
    if (sRes) {
      const s = await sRes.json();
      if (s.ok) setStaff(s.staff);
    }
    setLoading(false);
  }, [isPriv]);

  useEffect(() => {
    load();
  }, [load]);

  function itemName(id: string) {
    return items.find((i) => i.id === id)?.name ?? id;
  }
  function staffName(id: string) {
    return staff.find((s) => s.id === id)?.name ?? id;
  }

  async function submitCount(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/stock/counts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: countForm.item_id, physical_qty: Number(countForm.qty) }),
    });
    const data = await res.json();
    if (!data.ok) {
      alert(data.error ?? "Gagal menghantar kiraan");
      return;
    }
    alert(data.variance === 0 ? "Kiraan sepadan dengan sistem." : `Variance: ${data.variance}. Admin akan semak.`);
    setCountForm({ item_id: "", qty: "" });
    load();
  }

  async function decideAlert(id: string, action: "demerit" | "excuse") {
    const res = await fetch("/api/stock/alerts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const data = await res.json();
    if (!data.ok) alert(data.error ?? "Gagal");
    load();
  }

  async function decideCount(id: string, action: "adjust" | "demerit" | "excuse") {
    const res = await fetch("/api/stock/counts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const data = await res.json();
    if (!data.ok) alert(data.error ?? "Gagal");
    load();
  }

  const myItems = items.filter((i) => i.responsible_staff_id === user.id);
  const pendingAlerts = alerts.filter((a) => a.status === "pending_decision");
  const pendingCounts = counts.filter((c) => c.status === "pending_decision");

  const tabs = [
    { key: "baki" as const, label: "Baki Stok" },
    { key: "alert" as const, label: `Alert${pendingAlerts.length ? ` (${pendingAlerts.length})` : ""}` },
    { key: "kiraan" as const, label: `Kiraan${pendingCounts.length ? ` (${pendingCounts.length})` : ""}` },
    { key: "log" as const, label: "Log" },
  ];

  if (loading) return <p className="text-sm text-neutral-500">Memuatkan...</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Stok</h1>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm whitespace-nowrap ${tab === t.key ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "baki" && (
        <div className="mt-4 space-y-4">
          {myItems.length > 0 && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <h2 className="font-medium text-blue-900">Item jagaan anda</h2>
              <ul className="mt-2 space-y-1 text-sm text-blue-800">
                {myItems.map((i) => (
                  <li key={i.id} className="flex justify-between">
                    <span>{i.name}</span>
                    <span className="font-mono">{i.current_stock}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="font-medium">Semua item</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-500 border-b border-neutral-200">
                    <th className="py-2 pr-4">Item</th>
                    <th className="py-2 pr-4">Kategori</th>
                    <th className="py-2 pr-4">Stok</th>
                    {isPriv && <th className="py-2 pr-4">Penjaga</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="border-b border-neutral-100">
                      <td className="py-2 pr-4 font-medium">{i.name}</td>
                      <td className="py-2 pr-4">{i.category}</td>
                      <td className={`py-2 pr-4 font-mono ${i.current_stock < 0 ? "text-red-600" : ""}`}>{i.current_stock}</td>
                      {isPriv && <td className="py-2 pr-4">{staffName(i.responsible_staff_id)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "alert" && (
        <div className="mt-4 space-y-3">
          {alerts.length === 0 && <p className="text-sm text-neutral-500">Tiada alert.</p>}
          {alerts.map((a) => (
            <div key={a.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {itemName(a.item_id)} terlebih guna {Math.abs(a.variance)}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {a.date} · Penjaga: {staffName(a.responsible_staff_id) || a.responsible_staff_id}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    Had: {a.expected_max} · SO: {a.total_so}
                  </p>
                  {a.guest_requests_note && (
                    <p className="mt-2 text-xs rounded-lg bg-neutral-100 p-2 text-neutral-600">{a.guest_requests_note}</p>
                  )}
                </div>
                <span className={`shrink-0 rounded-lg px-2 py-1 text-xs ${
                  a.status === "pending_decision" ? "bg-amber-100 text-amber-700"
                  : a.status === "demerit_given" ? "bg-red-100 text-red-700"
                  : "bg-neutral-100 text-neutral-600"
                }`}>
                  {a.status === "pending_decision" ? "Menunggu" : a.status === "demerit_given" ? "Demerit" : "Dimaafkan"}
                </span>
              </div>
              {user.role === "admin" && a.status === "pending_decision" && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => decideAlert(a.id, "demerit")} className="flex-1 rounded-lg bg-red-600 py-2 text-sm text-white">
                    Bagi Demerit
                  </button>
                  <button onClick={() => decideAlert(a.id, "excuse")} className="flex-1 rounded-lg border border-neutral-300 py-2 text-sm">
                    Maafkan
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "kiraan" && (
        <div className="mt-4 space-y-4">
          <form onSubmit={submitCount} className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="font-medium">Hantar kiraan stok fizikal</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              <select
                value={countForm.item_id}
                onChange={(e) => setCountForm({ ...countForm, item_id: e.target.value })}
                className="flex-1 min-w-40 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                required
              >
                <option value="">Pilih item</option>
                {(isPriv ? items : myItems).filter((i) => i.is_tracked).map((i) => (
                  <option key={i.id} value={i.id}>{i.name} (sistem: {i.current_stock})</option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                placeholder="Kiraan sebenar"
                value={countForm.qty}
                onChange={(e) => setCountForm({ ...countForm, qty: e.target.value })}
                className="w-36 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                required
              />
              <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white">Hantar</button>
            </div>
          </form>

          {counts.slice(0, 20).map((c) => (
            <div key={c.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{itemName(c.item_id)}</p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {c.date} · Sistem: {c.system_qty} · Fizikal: {c.physical_qty} ·{" "}
                    <span className={c.variance < 0 ? "text-red-600 font-medium" : ""}>
                      Variance: {c.variance > 0 ? `+${c.variance}` : c.variance}
                    </span>
                  </p>
                </div>
                <span className={`shrink-0 rounded-lg px-2 py-1 text-xs ${c.status === "pending_decision" ? "bg-amber-100 text-amber-700" : "bg-neutral-100 text-neutral-600"}`}>
                  {c.status === "pending_decision" ? "Menunggu" : "Selesai"}
                </span>
              </div>
              {user.role === "admin" && c.status === "pending_decision" && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => decideCount(c.id, "adjust")} className="flex-1 rounded-lg bg-neutral-900 py-2 text-sm text-white">
                    Selaraskan Stok
                  </button>
                  <button onClick={() => decideCount(c.id, "demerit")} className="flex-1 rounded-lg bg-red-600 py-2 text-sm text-white">
                    Demerit + Selaras
                  </button>
                  <button onClick={() => decideCount(c.id, "excuse")} className="flex-1 rounded-lg border border-neutral-300 py-2 text-sm">
                    Abaikan
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "log" && (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="font-medium">Log pergerakan stok</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500 border-b border-neutral-200">
                  <th className="py-2 pr-4">Tarikh</th>
                  <th className="py-2 pr-4">Masa</th>
                  {isPriv && <th className="py-2 pr-4">Staff</th>}
                  <th className="py-2 pr-4">Item</th>
                  <th className="py-2 pr-4">Jenis</th>
                  <th className="py-2 pr-4">Kuantiti</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-neutral-100">
                    <td className="py-2 pr-4">{m.date}</td>
                    <td className="py-2 pr-4">{m.time}</td>
                    {isPriv && <td className="py-2 pr-4">{staffName(m.staff_id)}</td>}
                    <td className="py-2 pr-4">{itemName(m.item_id)}</td>
                    <td className="py-2 pr-4">{m.movement_type}</td>
                    <td className={`py-2 pr-4 font-mono ${m.movement_type === "OUT" ? "text-red-600" : "text-green-700"}`}>
                      {m.movement_type === "OUT" ? `-${m.qty}` : `+${m.qty}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {movements.length === 0 && <p className="py-4 text-sm text-neutral-500">Tiada rekod.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
