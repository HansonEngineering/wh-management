# WH Management — Panduan Setup

Panduan ini untuk setup awal app: Google Sheets (database), GitHub (code) dan Cloudflare Pages (hosting).

## 1. Google Sheets + Service Account

1. Pergi ke [Google Cloud Console](https://console.cloud.google.com/) dan log masuk dengan akaun Google hotel.
2. Cipta projek baru, contohnya `wh-management`.
3. Pergi ke **APIs & Services > Library**, cari **Google Sheets API**, dan tekan **Enable**.
4. Pergi ke **APIs & Services > Credentials**:
   - Tekan **Create Credentials > Service Account**.
   - Nama: `wh-management-app`. Tekan **Create and Continue**, kemudian **Done**.
5. Dalam senarai Service Accounts, klik service account tadi:
   - Pergi ke tab **Keys** > **Add Key** > **Create new key** > **JSON**.
   - Fail JSON akan dimuat turun. Simpan baik-baik.
6. Buka fail JSON tu. Catat dua nilai:
   - `client_email` — ini `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` — ini `GOOGLE_PRIVATE_KEY`
7. Buka [Google Sheets](https://sheets.google.com) dan cipta spreadsheet baru, contohnya nama `WH Management DB`.
8. Copy ID spreadsheet dari URL:
   `https://docs.google.com/spreadsheets/d/`**`1AbC...xYz`**`/edit` — bahagian panjang di tengah tu ialah `GOOGLE_SHEET_ID`.
9. Dalam spreadsheet, tekan **Share** dan kongsi dengan `client_email` tadi sebagai **Editor**.

## 2. Jalankan app di komputer (untuk ujian)

1. Dalam folder projek, salin `.env.local.example` kepada `.env.local` dan isi ketiga-tiga nilai di atas.
2. Jana `AUTH_SECRET` (rentetan rawak). Dalam terminal:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
3. Jalankan:
   ```
   npm install
   npm run dev
   ```
4. Buka `http://localhost:3000/setup` dan cipta akaun admin pertama. Ini akan mencipta semua tab dalam Google Sheet secara automatik.
5. Log masuk di `http://localhost:3000/login`.

## 3. GitHub

1. Cipta repo **private** baru di GitHub, contohnya `wh-management`.
2. Dalam folder projek:
   ```
   git add .
   git commit -m "Fasa 1: asas app"
   git branch -M main
   git remote add origin https://github.com/<username>/wh-management.git
   git push -u origin main
   ```

## 4. Cloudflare Pages

1. Log masuk ke [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Pergi ke **Workers & Pages** > **Create** > **Pages** > **Connect to Git**.
3. Pilih repo `wh-management`.
4. Dalam bahagian build settings:
   - Framework preset: **Next.js**
   - Build command: `npx @cloudflare/next-on-pages@1` *(atau ikut panduan semasa Cloudflare untuk Next.js)*
   - Output directory: `.vercel/output/static`
5. Tambah **Environment Variables** (sama seperti `.env.local`):
   - `GOOGLE_SHEET_ID`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `AUTH_SECRET`
6. Tekan **Save and Deploy**.
7. Selepas siap, app boleh diakses di `https://wh-management.pages.dev` (atau domain sendiri).

## Nota keselamatan

- Jangan sekali-kali commit `.env.local` atau fail JSON service account ke GitHub.
- Jangan kongsi `GOOGLE_PRIVATE_KEY` atau `AUTH_SECRET` dalam chat.
- Kalau terdedah secara tidak sengaja, jana key baru di Google Cloud Console dan padam key lama.
