"use client";

import { useEffect, useState } from "react";
import type { Staff, RoomType, Room, Item, RoomTypeMaxSO } from "@/lib/types";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/constants";

type Tab = "staff" | "bilik" | "item" | "maxso" | "system";

export default function SettingsClient() {
  const [tab, setTab] = useState<Tab>("staff");

  const tabs: { key: Tab; label: string }[] = [
    { key: "staff", label: "Staff" },
    { key: "bilik", label: "Bilik" },
    { key: "item", label: "Item" },
    { key: "maxso", label: "MaxSO" },
    { key: "system", label: "System" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm whitespace-nowrap ${
              tab === t.key ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tab === "staff" && <StaffTab />}
        {tab === "bilik" && <BilikTab />}
        {tab === "item" && <ItemTab />}
        {tab === "maxso" && <MaxSOTab />}
        {tab === "system" && <SystemTab />}
      </div>
    </div>
  );
}

/* ------------------------------ STAFF ------------------------------ */

function StaffTab() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", role: "housekeeping" as Role, password: "", phone: "", basic_salary: "", rfid_uid: "" });
  const [editing, setEditing] = useState<Staff | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/staff");
    const data = await res.json();
    if (data.ok) setStaff(data.staff);
    else setError(data.error ?? "Gagal memuatkan staff");
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.ok) {
      setError(data.error ?? "Gagal menambah staff");
      return;
    }
    setForm({ name: "", role: "housekeeping", password: "", phone: "", basic_salary: "", rfid_uid: "" });
    load();
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError("");
    const payload: Record<string, unknown> = {
      id: editing.id,
      name: editing.name,
      role: editing.role,
      phone: editing.phone,
      basic_salary: editing.basic_salary,
      rfid_uid: editing.rfid_uid,
      is_active: editing.is_active,
    };
    const res = await fetch("/api/staff", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.ok) {
      setError(data.error ?? "Gagal mengemas kini");
      return;
    }
    setEditing(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Padam staff ini?")) return;
    const res = await fetch(`/api/staff?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.ok) alert(data.error ?? "Gagal memadam");
    load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-medium">Tambah Staff</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" required />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <input placeholder="Kata laluan (min 6)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" required minLength={6} />
          <input placeholder="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          <input placeholder="Gaji pokok (RM)" type="number" value={form.basic_salary} onChange={(e) => setForm({ ...form, basic_salary: e.target.value })} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          <input placeholder="RFID UID (kad stor)" value={form.rfid_uid} onChange={(e) => setForm({ ...form, rfid_uid: e.target.value })} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
        </div>
        <button disabled={saving} className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50">
          {saving ? "Menyimpan..." : "Tambah"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-medium">Senarai Staff</h2>
        {loading ? (
          <p className="mt-3 text-sm text-neutral-500">Memuatkan...</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500 border-b border-neutral-200">
                  <th className="py-2 pr-4">Nama</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Telefon</th>
                  <th className="py-2 pr-4">Gaji</th>
                  <th className="py-2 pr-4">Aktif</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-b border-neutral-100">
                    <td className="py-2 pr-4">{s.name}</td>
                    <td className="py-2 pr-4">{ROLE_LABELS[s.role]}</td>
                    <td className="py-2 pr-4">{s.phone || "-"}</td>
                    <td className="py-2 pr-4">{s.basic_salary ? `RM ${s.basic_salary}` : "-"}</td>
                    <td className="py-2 pr-4">{s.is_active ? "Ya" : "Tidak"}</td>
                    <td className="py-2 text-right space-x-2">
                      <button onClick={() => setEditing(s)} className="text-xs rounded-lg border border-neutral-300 px-2 py-1">Edit</button>
                      <button onClick={() => handleDelete(s.id)} className="text-xs rounded-lg border border-red-300 text-red-600 px-2 py-1">Padam</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <form onSubmit={handleUpdate} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-5 space-y-3">
            <h2 className="font-medium">Edit Staff</h2>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            <select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value as Role })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm">
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <input placeholder="Telefon" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            <input placeholder="Gaji pokok" type="number" value={editing.basic_salary} onChange={(e) => setEditing({ ...editing, basic_salary: Number(e.target.value) })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            <input placeholder="RFID UID" value={editing.rfid_uid} onChange={(e) => setEditing({ ...editing, rfid_uid: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
              Aktif
            </label>
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-neutral-900 py-2 text-sm text-white disabled:opacity-50">Simpan</button>
              <button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-lg border border-neutral-300 py-2 text-sm">Batal</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ BILIK ------------------------------ */

function BilikTab() {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState("");
  const [rtForm, setRtForm] = useState({ name: "", beds: "2" });
  const [roomForm, setRoomForm] = useState({ room_number: "", room_type_id: "", floor: "" });
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  async function load() {
    const [rtRes, roomRes] = await Promise.all([fetch("/api/room-types"), fetch("/api/rooms")]);
    const rt = await rtRes.json();
    const rm = await roomRes.json();
    if (rt.ok) setRoomTypes(rt.roomTypes);
    if (rm.ok) setRooms(rm.rooms);
  }

  useEffect(() => {
    load();
  }, []);

  async function addRoomType(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/room-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rtForm),
    });
    const data = await res.json();
    if (!data.ok) {
      setError(data.error ?? "Gagal menambah jenis bilik");
      return;
    }
    setRtForm({ name: "", beds: "2" });
    load();
  }

  async function addRoom(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(roomForm),
    });
    const data = await res.json();
    if (!data.ok) {
      setError(data.error ?? "Gagal menambah bilik");
      return;
    }
    setRoomForm({ room_number: "", room_type_id: "", floor: "" });
    load();
  }

  async function updateRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRoom) return;
    const res = await fetch("/api/rooms", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingRoom),
    });
    const data = await res.json();
    if (!data.ok) {
      alert(data.error ?? "Gagal mengemas kini");
      return;
    }
    setEditingRoom(null);
    load();
  }

  async function deleteRoom(id: string) {
    if (!confirm("Padam bilik ini?")) return;
    const res = await fetch(`/api/rooms?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.ok) alert(data.error ?? "Gagal memadam");
    load();
  }

  function typeName(id: string) {
    return roomTypes.find((t) => t.id === id)?.name ?? "-";
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addRoomType} className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-medium">Tambah Jenis Bilik</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <input placeholder="Nama (cth: 2 Beds)" value={rtForm.name} onChange={(e) => setRtForm({ ...rtForm, name: e.target.value })} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" required />
          <input placeholder="Bilangan katil" type="number" min={1} value={rtForm.beds} onChange={(e) => setRtForm({ ...rtForm, beds: e.target.value })} className="w-32 rounded-lg border border-neutral-300 px-3 py-2 text-sm" required />
          <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white">Tambah</button>
        </div>
        {roomTypes.length > 0 && (
          <p className="mt-3 text-sm text-neutral-500">
            Sedia ada: {roomTypes.map((t) => `${t.name} (${t.beds} katil)`).join(", ")}
          </p>
        )}
      </form>

      <form onSubmit={addRoom} className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-medium">Tambah Bilik</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <input placeholder="Nombor bilik (cth: 401)" value={roomForm.room_number} onChange={(e) => setRoomForm({ ...roomForm, room_number: e.target.value })} className="w-36 rounded-lg border border-neutral-300 px-3 py-2 text-sm" required />
          <select value={roomForm.room_type_id} onChange={(e) => setRoomForm({ ...roomForm, room_type_id: e.target.value })} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" required>
            <option value="">Pilih jenis</option>
            {roomTypes.filter((t) => t.is_active).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input placeholder="Aras (pilihan)" value={roomForm.floor} onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })} className="w-28 rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white">Tambah</button>
        </div>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-medium">Senarai Bilik ({rooms.length})</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-500 border-b border-neutral-200">
                <th className="py-2 pr-4">Bilik</th>
                <th className="py-2 pr-4">Jenis</th>
                <th className="py-2 pr-4">Aras</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id} className="border-b border-neutral-100">
                  <td className="py-2 pr-4 font-medium">{r.room_number}</td>
                  <td className="py-2 pr-4">{typeName(r.room_type_id)}</td>
                  <td className="py-2 pr-4">{r.floor || "-"}</td>
                  <td className="py-2 text-right space-x-2">
                    <button onClick={() => setEditingRoom(r)} className="text-xs rounded-lg border border-neutral-300 px-2 py-1">Edit</button>
                    <button onClick={() => deleteRoom(r.id)} className="text-xs rounded-lg border border-red-300 text-red-600 px-2 py-1">Padam</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingRoom && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditingRoom(null)}>
          <form onSubmit={updateRoom} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-5 space-y-3">
            <h2 className="font-medium">Edit Bilik {editingRoom.room_number}</h2>
            <input value={editingRoom.room_number} onChange={(e) => setEditingRoom({ ...editingRoom, room_number: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            <select value={editingRoom.room_type_id} onChange={(e) => setEditingRoom({ ...editingRoom, room_type_id: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm">
              {roomTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <input placeholder="Aras" value={editingRoom.floor} onChange={(e) => setEditingRoom({ ...editingRoom, floor: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 rounded-lg bg-neutral-900 py-2 text-sm text-white">Simpan</button>
              <button type="button" onClick={() => setEditingRoom(null)} className="flex-1 rounded-lg border border-neutral-300 py-2 text-sm">Batal</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ ITEM ------------------------------ */

function ItemTab() {
  const [items, setItems] = useState<Item[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", category: "consumable", is_tracked: true, current_stock: "0", responsible_staff_id: "" });
  const [editing, setEditing] = useState<Item | null>(null);

  async function load() {
    const [iRes, sRes] = await Promise.all([fetch("/api/items"), fetch("/api/staff")]);
    const i = await iRes.json();
    const s = await sRes.json();
    if (i.ok) setItems(i.items);
    if (s.ok) setStaff(s.staff);
  }

  useEffect(() => {
    load();
  }, []);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!data.ok) {
      setError(data.error ?? "Gagal menambah item");
      return;
    }
    setForm({ name: "", category: "consumable", is_tracked: true, current_stock: "0", responsible_staff_id: "" });
    load();
  }

  async function updateItem(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const res = await fetch("/api/items", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    const data = await res.json();
    if (!data.ok) {
      alert(data.error ?? "Gagal mengemas kini");
      return;
    }
    setEditing(null);
    load();
  }

  async function deleteItem(id: string) {
    if (!confirm("Padam item ini?")) return;
    const res = await fetch(`/api/items?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.ok) alert(data.error ?? "Gagal memadam");
    load();
  }

  function staffName(id: string) {
    return staff.find((s) => s.id === id)?.name ?? "-";
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addItem} className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-medium">Tambah Item</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input placeholder="Nama item (cth: Shampoo)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" required />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
            <option value="consumable">Consumable (habis guna)</option>
            <option value="linen">Linen (towel, cadar)</option>
          </select>
          <select value={form.responsible_staff_id} onChange={(e) => setForm({ ...form, responsible_staff_id: e.target.value })} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
            <option value="">Staff penjaga (pilihan)</option>
            {staff.filter((s) => s.is_active).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input placeholder="Stok awal" type="number" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_tracked} onChange={(e) => setForm({ ...form, is_tracked: e.target.checked })} />
            Track dalam sistem stok (SO/LNB)
          </label>
        </div>
        <button className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white">Tambah</button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-medium">Senarai Item ({items.length})</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-500 border-b border-neutral-200">
                <th className="py-2 pr-4">Item</th>
                <th className="py-2 pr-4">Kategori</th>
                <th className="py-2 pr-4">Track</th>
                <th className="py-2 pr-4">Stok</th>
                <th className="py-2 pr-4">Penjaga</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-b border-neutral-100">
                  <td className="py-2 pr-4 font-medium">{i.name}</td>
                  <td className="py-2 pr-4">{i.category}</td>
                  <td className="py-2 pr-4">{i.is_tracked ? "Ya" : "Tidak"}</td>
                  <td className="py-2 pr-4">{i.current_stock}</td>
                  <td className="py-2 pr-4">{staffName(i.responsible_staff_id)}</td>
                  <td className="py-2 text-right space-x-2">
                    <button onClick={() => setEditing(i)} className="text-xs rounded-lg border border-neutral-300 px-2 py-1">Edit</button>
                    <button onClick={() => deleteItem(i.id)} className="text-xs rounded-lg border border-red-300 text-red-600 px-2 py-1">Padam</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <form onSubmit={updateItem} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-5 space-y-3">
            <h2 className="font-medium">Edit Item</h2>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm">
              <option value="consumable">Consumable</option>
              <option value="linen">Linen</option>
            </select>
            <select value={editing.responsible_staff_id} onChange={(e) => setEditing({ ...editing, responsible_staff_id: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm">
              <option value="">Tiada penjaga</option>
              {staff.filter((s) => s.is_active).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input type="number" value={editing.current_stock} onChange={(e) => setEditing({ ...editing, current_stock: Number(e.target.value) })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" placeholder="Stok semasa" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.is_tracked} onChange={(e) => setEditing({ ...editing, is_tracked: e.target.checked })} />
              Track dalam sistem stok
            </label>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 rounded-lg bg-neutral-900 py-2 text-sm text-white">Simpan</button>
              <button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-lg border border-neutral-300 py-2 text-sm">Batal</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ MAXSO ------------------------------ */

function MaxSOTab() {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [maxso, setMaxso] = useState<RoomTypeMaxSO[]>([]);
  const [error, setError] = useState("");
  const [savingCell, setSavingCell] = useState("");

  async function load() {
    const [rtRes, iRes, mRes] = await Promise.all([
      fetch("/api/room-types"),
      fetch("/api/items"),
      fetch("/api/maxso"),
    ]);
    const rt = await rtRes.json();
    const i = await iRes.json();
    const m = await mRes.json();
    if (rt.ok) setRoomTypes(rt.roomTypes.filter((t: RoomType) => t.is_active));
    if (i.ok) setItems(i.items.filter((x: Item) => x.is_active && x.is_tracked));
    if (m.ok) setMaxso(m.maxso);
  }

  useEffect(() => {
    load();
  }, []);

  function getValue(roomTypeId: string, itemId: string): { max: number; min: number } {
    const row = maxso.find((m) => m.room_type_id === roomTypeId && m.item_id === itemId);
    return { max: row?.max_so ?? 0, min: row?.min_so ?? 0 };
  }

  async function saveCell(roomTypeId: string, itemId: string, maxSo: number, minSo: number) {
    const key = `${roomTypeId}:${itemId}`;
    setSavingCell(key);
    setError("");
    const res = await fetch("/api/maxso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_type_id: roomTypeId, item_id: itemId, max_so: maxSo, min_so: minSo }),
    });
    const data = await res.json();
    if (!data.ok) setError(data.error ?? "Gagal menyimpan");
    setSavingCell("");
    load();
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h2 className="font-medium">MaxSO / MinSO setiap jenis bilik</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Nilai ini menentukan had stock keluar untuk setiap bilik LNB. Ubah nombor dan ia disimpan automatik bila anda keluar dari kotak.
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-500 border-b border-neutral-200">
              <th className="py-2 pr-4">Item</th>
              {roomTypes.map((t) => (
                <th key={t.id} className="py-2 pr-4">{t.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-neutral-100">
                <td className="py-2 pr-4 font-medium">{item.name}</td>
                {roomTypes.map((t) => {
                  const v = getValue(t.id, item.id);
                  const key = `${t.id}:${item.id}`;
                  return (
                    <td key={t.id} className="py-2 pr-4">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          defaultValue={v.max}
                          key={`max-${key}-${v.max}`}
                          onBlur={(e) => {
                            const val = Number(e.target.value);
                            if (val !== v.max) saveCell(t.id, item.id, val, v.min);
                          }}
                          className="w-16 rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                          title="MaxSO"
                        />
                        <span className="text-neutral-400 text-xs">/</span>
                        <input
                          type="number"
                          min={0}
                          defaultValue={v.min}
                          key={`min-${key}-${v.min}`}
                          onBlur={(e) => {
                            const val = Number(e.target.value);
                            if (val !== v.min) saveCell(t.id, item.id, v.max, val);
                          }}
                          className="w-16 rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                          title="MinSO"
                        />
                        {savingCell === key && <span className="text-xs text-neutral-400">...</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="py-4 text-sm text-neutral-500">Tiada item yang di-track. Tambah item dahulu di tab Item.</p>}
        {roomTypes.length === 0 && <p className="py-4 text-sm text-neutral-500">Tiada jenis bilik. Tambah dahulu di tab Bilik.</p>}
      </div>
      <p className="mt-3 text-xs text-neutral-400">Format: MaxSO / MinSO</p>
    </div>
  );
}

/* ------------------------------ SYSTEM ------------------------------ */

function SystemTab() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const FIELDS: { key: string; label: string; hint?: string }[] = [
    { key: "stor_timer_minutes", label: "Timer stor (minit)", hint: "Tempoh untuk staff update stock selepas scan kad" },
    { key: "stor_buzzer_seconds", label: "Buzzer (saat)", hint: "Tempoh buzzer berbunyi" },
    { key: "late_grace_minutes", label: "Toleransi lewat (minit)" },
    { key: "compare_period", label: "Tempoh perbandingan stok", hint: "daily atau weekly" },
    { key: "max_concurrent_leave", label: "Maksimum cuti serentak setiap role" },
    { key: "max_deduction_percent", label: "Had maksimum potongan gaji (%)" },
    { key: "guest_request_daily_limit", label: "Had permintaan tambahan / bilik / hari" },
    { key: "daily_check_time", label: "Masa semakan harian", hint: "cth: 23:30" },
    { key: "deduction_tiers", label: "Tingkat potongan demerit (JSON)", hint: '[{"min":1,"max":5,"percent":2}, ...]' },
  ];

  async function load() {
    setLoading(true);
    const res = await fetch("/api/settings");
    const data = await res.json();
    if (data.ok) setSettings(data.settings);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    const data = await res.json();
    setSaving(false);
    setMessage(data.ok ? "Tersimpan." : data.error ?? "Gagal menyimpan");
  }

  if (loading) return <p className="text-sm text-neutral-500">Memuatkan...</p>;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h2 className="font-medium">Tetapan System</h2>
      <div className="mt-4 space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="block text-sm font-medium">{f.label}</label>
            {f.hint && <p className="text-xs text-neutral-400 mb-1">{f.hint}</p>}
            <input
              value={settings[f.key] ?? ""}
              onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button onClick={save} disabled={saving} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50">
          {saving ? "Menyimpan..." : "Simpan Semua"}
        </button>
        {message && <span className="text-sm text-neutral-500">{message}</span>}
      </div>
    </div>
  );
}
