import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

// POST /api/upload
// Terima gambar (base64) dan upload ke Cloudinary. Pulangkan URL.
// Badan: { "image": "data:image/jpeg;base64,..." }
export async function POST(req: Request) {
  try {
    await requireRole(["admin", "supervisor", "housekeeping", "maintenance", "receptionist"]);

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
      return NextResponse.json(
        { ok: false, error: "Cloudinary belum diset. Tambah CLOUDINARY_CLOUD_NAME dan CLOUDINARY_UPLOAD_PRESET." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const image = String(body.image ?? "");
    if (!image.startsWith("data:image/")) {
      return NextResponse.json({ ok: false, error: "Format gambar tidak sah." }, { status: 400 });
    }

    const form = new FormData();
    form.append("file", image);
    form.append("upload_preset", uploadPreset);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    if (!res.ok || !data.secure_url) {
      return NextResponse.json({ ok: false, error: data.error?.message ?? "Upload gagal." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url: data.secure_url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ralat";
    const status = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
