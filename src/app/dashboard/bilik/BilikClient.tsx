"use client";

import { useEffect, useState, useCallback } from "react";
import type { SessionUser, HousekeepingTask, Room, RoomStatus, Item } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  occupied: "Ada tetamu",
  pending_clean: "Pending bersih",
  cleaning: "Sedang dibersihkan",
  clean: "Siap",
  none: "Kosong",
};

const STATUS_COLOR: Record<string, string> = {
  occupied: "bg-blue-100 text-blue-700",
  pending_clean: "bg-amber-100 text-amber-700",
  cleaning: "bg-purple-100 text-purple-700",
  clean: "bg-green-100 text-green-700",
  none: "bg-neutral-100 text-neutral-500",
};

export default function BilikClient({ user }: { user: SessionUser }) {
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [statuses, setStatuses] = useState<RoomStatus[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<HousekeepingTask | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  const isHK = user.role === "housekeeping";
  const isPriv = user.role === "admin" || user.role === "supervisor";

  const load = useCallback(async () => {
    const [tRes, rRes, sRes, iRes] = await Promise.all([
      fetch("/api/housekeeping/tasks"),
      fetch("/api/rooms"),
      fetch("/api/room-statuses"),
      fetch("/api/items"),
    ]);
    const t = await tRes.json();
    const r = await rRes.json();
    const s = await sRes.json();
    const i = await iRes.json();
    if (t.ok) setTasks(t.tasks);
    if (r.ok) setRooms(r.rooms.filter((x: Room) => x.is_active));
    if (s.ok) setStatuses(s.statuses);
    if (i.ok) setItems(i.items.filter((x: Item) => x.is_active));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  function roomNumber(id: string) {
    return rooms.find((r) => r.id === id)?.room_number ?? id;
  }
  function statusFor(roomId: string) {
    return statuses.find((s) => s.room_id === roomId);
  }

  async function startTask(id: string) {
    await fetch("/api/housekeeping/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "start" }),
    });
    load();
  }

  function openChecklist(task: HousekeepingTask) {
    setActiveTask(task);
    const initial: Record<string, boolean> = {};
    items.forEach((i) => {
      initial[i.id] = false;
    });
    try {
      const saved = JSON.parse(task.checklist_json || "[]") as string[];
      saved.forEach((id) => {
        initial[id] = true;
      });
    } catch {
      // abaikan
    }
    setChecklist(initial);
  }

  async function submitChecklist() {
    if (!activeTask) return;
    const done = Object.entries(checklist).filter(([, v]) => v).map(([k]) => k);
    const res = await fetch("/api/housekeeping/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: activeTask.id, action: "submit", checklist: done }),
    });
    const data = await res.json();
    if (!data.ok) {
      alert(data.error ?? "Gagal menghantar");
      return;
    }
    setActiveTask(null);
    load();
  }

  if (loading) return <p className="text-sm text-neutral-500">Memuatkan...</p>;

  const pendingTasks = tasks.filter((t) => t.status !== "done");

  return (
    <div>
      <h1 className="text-2xl font-semibold">Bilik</h1>

      {/* Status semua bilik — semua role nampak */}
      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-medium">Status bilik hari ini</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {rooms.map((r) => {
            const st = statusFor(r.id);
            const cs = st?.cleaning_status ?? "none";
            const sellable = st?.sellable !== false;
            return (
              <div key={r.id} className={`rounded-xl p-3 text-center ${STATUS_COLOR[cs]} ${!sellable ? "ring-2 ring-red-400" : ""}`}>
                <p className="font-semibold">{r.room_number}</p>
                <p className="text-xs mt-0.5">{STATUS_LABEL[cs]}</p>
                {!sellable && <p className="text-xs text-red-600 font-medium">Tidak dijual</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending list housekeeping */}
      {(isHK || isPriv) && (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="font-medium">Pending list ({pendingTasks.length})</h2>
          {pendingTasks.length === 0 && <p className="mt-2 text-sm text-neutral-500">Tiada bilik pending.</p>}
          <div className="mt-3 space-y-2">
            {pendingTasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border border-neutral-200 p-3">
                <div>
                  <p className="font-medium">Bilik {roomNumber(t.room_id)}</p>
                  <p className="text-xs text-neutral-500">
                    {t.status === "pending" ? "Belum diambil" : `Sedang dibuat`}
                  </p>
                </div>
                {isHK && (
                  <div className="flex gap-2">
                    {t.status === "pending" && (
                      <button onClick={() => startTask(t.id)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs">
                        Mula
                      </button>
                    )}
                    <button onClick={() => openChecklist(t)} className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs text-white">
                      Checklist
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal checklist */}
      {activeTask && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setActiveTask(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-5 max-h-[85vh] overflow-y-auto">
            <h2 className="font-medium">Checklist Bilik {roomNumber(activeTask.room_id)}</h2>
            <p className="mt-1 text-sm text-neutral-500">Tandakan item yang telah diisi/diganti.</p>
            <div className="mt-4 space-y-2">
              {items.map((i) => (
                <label key={i.id} className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3">
                  <input
                    type="checkbox"
                    checked={!!checklist[i.id]}
                    onChange={(e) => setChecklist({ ...checklist, [i.id]: e.target.checked })}
                    className="h-5 w-5"
                  />
                  <span className="text-sm">{i.name}</span>
                  <span className="ml-auto text-xs text-neutral-400">{i.category}</span>
                </label>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={submitChecklist} className="flex-1 rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white">
                Hantar & Tanda Siap
              </button>
              <button onClick={() => setActiveTask(null)} className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
