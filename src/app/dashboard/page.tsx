import { getSession } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Selamat datang, {session.name}</h1>
      <p className="mt-1 text-neutral-500">
        Anda log masuk sebagai {ROLE_LABELS[session.role]}.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="font-medium">Modul akan datang</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Dashboard penuh (kehadiran, alert stok, pending bilik dan report) akan dibina dalam fasa seterusnya.
          </p>
        </div>
        {session.role === "admin" && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="font-medium">Langkah seterusnya untuk Admin</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Pergi ke <strong>Settings</strong> untuk tambah staff, bilik, jenis bilik, item dan tetapan MaxSO.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
