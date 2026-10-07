"use client";

import { useEffect, useState, useCallback } from "react";
import type { SessionUser, Staff, Shift, Schedule, ScheduleChange } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/constants";

function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function JadualClient({ user }: { user: SessionUser }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [changes, setChanges] = useState<ScheduleChange[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const [loading, setLoading] = useState(true);
  const [editCell, setEditCell] = useState<{ staffId: string; date: string } | null>(null);
  const [showChange, setShowChange] = useState(false);
  const [changeForm, setChangeForm] = useState({ date: "", change_type: "swap", covering_staff_id: "", reason: "" });

  const isPriv = user.role === "admin" || user.role === "supervisor";

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(fmt(d));
  }

  const load = useCallback(async () => {
    const from = days[0];
    const to = days[6];
    const fetches: Promise<Response>[] = [
      fetch("/api/shifts"),
      fetch(`/api/schedules?from=${from}&to=${to}`),
      fetch("/api/schedule-changes"),
    ];
    if (isPriv) fetches.push(fetch("/api/staff"));
    const [shRes, scRes, chRes, stRes] = await Promise.all(fetches);
    const sh = await shRes.json();
    const sc = await scRes.json();
    const ch = await chRes.json();
    if (sh.ok) setShifts(sh.shifts.filter((s: Shift) => s.is_active));
    if (sc.ok) setSchedules(sc.schedules);
    if (ch.ok) setChanges(ch.changes);
    if (stRes) {
      const st = await stRes.json();
      if (st.ok) setStaff(st.staff.filter((s: Staff) => s.is_active));
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, isPriv]);

  useEffect(() => {
    load();
  }, [load]);

  function shiftFor(staffId: string, date: string): Shift | null | "OFF" | "CUTI" {
    const s = schedules.find((x) => x.staff_id === staffId && x.date === date);
    if (!s) return null;
    if (s.shift_id === "OFF") return "OFF";
    if (s.shift_id === "CUTI") return "CUTI";
    return shifts.find((sh) => sh.id === s.shift_id) ?? null;
  }

  async function setCell(staffId: string, date: string, shiftId: string) {
    await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff_id: staffId, date, shift_id: shiftId }),
    });
    setEditCell(null);
    load();
  }

  async function submitChange(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/schedule-changes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changeForm),
    });
    const data = await res.json();
    if (!data.ok) {
      alert(data.error ?? "Gagal menghantar");
      return;
    }
    setShowChange(false);
    setChangeForm({ date: "", change_type: "swap", covering_staff_id: "", reason: "" });
    load();
  }

  async function decideChange(id: string, action: "approve" | "reject") {
    await fetch("/api/schedule-changes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    load();
  }

  function prevWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  }
  function nextWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  }

  const pendingChanges = changes.filter((c) => c.status === "pending");

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Jadual Syif</h1>
        <button onClick={() => setShowChange(true)} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white">
          Mohon Tukar / Emergency
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button onClick={prevWeek} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm">← Minggu lepas</button>
        <p className="text-sm font-medium">{days[0]} — {days[6]}</p>
        <button onClick={nextWeek} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm">Minggu depan →</button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-neutral-500">Memuatkan...</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="p-2 sticky left-0 bg-white">Staff</th>
                {days.map((d) => (
                  <th key={d} className="p-2 text-center min-w-20">
                    {new Date(d + "T00:00:00").toLocaleDateString("ms-MY", { weekday: "short" })}
                    <br />
                    <span className="font-normal">{d.slice(5)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(isPriv ? staff : staff.filter((s) => s.id === user.id)).map((s) => (
                <tr key={s.id} className="border-b border-neutral-100">
                  <td className="p-2 sticky left-0 bg-white font-medium">
                    {s.name}
                    <span className="block text-neutral-400 font-normal">{ROLE_LABELS[s.role]}</span>
                  </td>
                  {days.map((d) => {
                    const sh = shiftFor(s.id, d);
                    const isMe = s.id === user.id;
                    return (
                      <td
                        key={d}
                        className={`p-1 text-center ${isPriv ? "cursor-pointer hover:bg-neutral-50" : ""} ${isMe ? "bg-blue-50/50" : ""}`}
                        onClick={() => isPriv && setEditCell({ staffId: s.id, date: d })}
                      >
                        {sh === null ? (
                          <span className="text-neutral-300">-</span>
                        ) : sh === "OFF" ? (
                          <span className="inline-block rounded-md bg-neutral-200 px-2 py-1 text-neutral-500">OFF</span>
                        ) : sh === "CUTI" ? (
                          <span className="inline-block rounded-md bg-green-100 px-2 py-1 text-green-700">CUTI</span>
                        ) : (
                          <span
                            className="inline-block rounded-md px-2 py-1 text-white"
                            style={{ backgroundColor: sh.color }}
                          >
                            {sh.name}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Permohonan tukar syif */}
      {(pendingChanges.length > 0 || isPriv) && (
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="font-medium">Permohonan tukar syif ({pendingChanges.length} menunggu)</h2>
          <div className="mt-3 space-y-2">
            {changes.slice(0, 10).map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-neutral-200 p-3 text-sm">
                <div>
                  <p className="font-medium">
                    {c.change_type} · {c.date}
                  </p>
                  <p className="text-xs text-neutral-500">{c.reason}</p>
                </div>
                {isPriv && c.status === "pending" ? (
                  <div className="flex gap-2">
                    <button onClick={() => decideChange(c.id, "approve")} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white">Approve</button>
                    <button onClick={() => decideChange(c.id, "reject")} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs">Reject</button>
                  </div>
                ) : (
                  <span className={`rounded-lg px-2 py-1 text-xs ${c.status === "approved" ? "bg-green-100 text-green-700" : c.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                    {c.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal edit sel (admin/supervisor) */}
      {editCell && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditCell(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xs rounded-2xl bg-white p-5">
            <h2 className="font-medium text-sm">Set syif untuk {editCell.date}</h2>
            <div className="mt-3 space-y-2">
              {shifts.map((sh) => (
                <button
                  key={sh.id}
                  onClick={() => setCell(editCell.staffId, editCell.date, sh.id)}
                  className="w-full rounded-lg px-3 py-2 text-sm text-white text-left"
                  style={{ backgroundColor: sh.color }}
                >
                  {sh.name} ({sh.start_time} - {sh.end_time})
                </button>
              ))}
              <button onClick={() => setCell(editCell.staffId, editCell.date, "OFF")} className="w-full rounded-lg bg-neutral-200 px-3 py-2 text-sm text-neutral-600">
                OFF (hari rehat)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal mohon tukar */}
      {showChange && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setShowChange(false)}>
          <form onSubmit={submitChange} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-5 space-y-3">
            <h2 className="font-medium">Mohon Tukar Syif / Emergency</h2>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Tarikh</label>
              <input type="date" value={changeForm.date} onChange={(e) => setChangeForm({ ...changeForm, date: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Jenis</label>
              <select value={changeForm.change_type} onChange={(e) => setChangeForm({ ...changeForm, change_type: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm">
                <option value="swap">Tukar syif (dirancang)</option>
                <option value="emergency">Emergency (last minute)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Staff pengganti (kalau ada)</label>
              <select value={changeForm.covering_staff_id} onChange={(e) => setChangeForm({ ...changeForm, covering_staff_id: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm">
                <option value="">Biar kosong untuk emergency</option>
                {staff.filter((s) => s.id !== user.id).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Sebab</label>
              <textarea value={changeForm.reason} onChange={(e) => setChangeForm({ ...changeForm, reason: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" rows={2} />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="flex-1 rounded-lg bg-neutral-900 py-2.5 text-sm text-white">Hantar</button>
              <button type="button" onClick={() => setShowChange(false)} className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm">Batal</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
