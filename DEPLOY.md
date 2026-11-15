# Panduan Upload GitHub & Deploy Vercel — FireeeMart

Arsitektur saat online:

```
Browser ──► Frontend Next.js (Vercel)  ──/api proxy──►  Backend Express (Vercel)  ──►  MySQL cloud
            fireeemart.vercel.app                        fireeemart-api.vercel.app      (TiDB Cloud / Aiven)
```

Vercel **tidak menyediakan MySQL**, jadi database perlu ditaruh di layanan MySQL cloud. Frontend memanggil backend lewat proxy `/api`, sehingga cookie login tetap aman dan tidak perlu pengaturan CORS.

---

## 1. Upload ke GitHub

1. Buat repository baru (kosong) di https://github.com/new, misalnya `fireeemart`.
2. Jalankan perintah berikut di folder `fireeemart` (folder yang berisi `backend/` dan `frontend/`):

```bash
git init
git add .
git commit -m "FireeeMart: inventori & kas toko sembako"
git branch -M main
git remote add origin https://github.com/USERNAME/fireeemart.git
git push -u origin main
```

> File `.env`, `.env.local`, `node_modules`, dan `.next` **tidak ikut ter-upload** (sudah diatur di `.gitignore`), jadi password database Anda aman.

---

## 2. Siapkan database MySQL cloud

Pilih salah satu layanan yang punya paket gratis:

- **TiDB Cloud Serverless** (https://tidbcloud.com): kompatibel dengan MySQL dan tersedia region Singapura.
- **Aiven for MySQL** (https://aiven.io): MySQL asli, paket gratis.

Langkah umum:

1. Buat cluster/database baru dan pilih region **Singapore** (paling dekat dengan Indonesia).
2. Catat **host, port, user, password**, dan nama database.
3. Di komputer Anda, buat file `backend/.env.production` (tidak ikut ter-upload) berisi:

```env
DB_HOST=host-dari-provider
DB_PORT=4000
DB_USER=user-dari-provider
DB_PASSWORD=password-dari-provider
DB_NAME=fireeemart
DB_SSL=true
JWT_SECRET=isi-acak-panjang
```

4. Isi tabel di database cloud. Jalankan dari folder `backend` (opsi `--env=` membuat script memakai file `.env.production`, bukan `.env` lokal):

```bash
npm run db:schema -- --env=.env.production
```

```bash
npm run user:create -- --env=.env.production --username owner --password RahasiaKuat123 --name "Pemilik Toko"
```

   Untuk versi demo lengkap dengan data contoh dan akun demo, jalankan `npm run db:init -- --env=.env.production` sebagai gantinya.

> Jika provider mewajibkan CA certificate (biasanya Aiven), isi `DB_SSL_CA` dengan isi file CA. Ganti setiap baris baru dengan `\n`.

---

## 3. Deploy backend ke Vercel

1. Buka https://vercel.com/new, lalu **Import** repository `fireeemart`.
2. **Root Directory** → pilih `backend`.
3. **Framework Preset** → `Other`. Build command dan output dikosongkan.
4. Buka **Environment Variables** dan isi:

| Nama | Nilai |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | dari provider database |
| `DB_SSL` | `true` |
| `JWT_SECRET` | string acak panjang (buat dengan `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `APP_TIMEZONE` | `Asia/Jakarta` |
| `DB_TIMEZONE` | `+07:00` |

5. Klik **Deploy**. Setelah selesai, buka `https://<nama-backend>.vercel.app/api/health`. Hasilnya harus `"database":"connected"`.

---

## 4. Deploy frontend ke Vercel

1. Kembali ke https://vercel.com/new dan **Import** repository yang sama sekali lagi.
2. **Root Directory** → `frontend`. Framework terdeteksi otomatis sebagai **Next.js**.
3. Isi **Environment Variables**:

| Nama | Nilai |
| --- | --- |
| `BACKEND_URL` | `https://<nama-backend>.vercel.app` (tanpa `/api`, tanpa `/` di akhir) |
| `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS` | `false` untuk toko sungguhan, `true` untuk demo/portofolio |

4. Klik **Deploy**, lalu buka URL frontend dan login.

> `BACKEND_URL` dibaca saat build. Jika nilainya diubah, lakukan **Redeploy** frontend.

---

## 5. Update aplikasi setelah online

Setiap kali Anda melakukan perubahan:

```bash
git add .
git commit -m "Deskripsi perubahan"
git push
```

Vercel otomatis mem-build ulang **backend dan frontend** dari branch `main`.

Kalau mengubah struktur tabel di `schema.sql`, ubah juga database cloud secara manual (misalnya lewat SQL editor di dashboard provider). `npm run db:init` akan **menghapus semua data**.

---

## Catatan & Troubleshooting

- **Login berhasil tapi langsung keluar lagi**: pastikan frontend memanggil API lewat proxy, yaitu `BACKEND_URL` sudah di-set dan **tidak** ada `NEXT_PUBLIC_API_URL`.
- **`database: disconnected` di `/api/health`**: cek host/port/password dan `DB_SSL=true`. Pada beberapa provider, IP Vercel perlu diizinkan (*allow all IPs* / `0.0.0.0/0`).
- **Server error saat login di production**: biasanya `JWT_SECRET` belum diisi.
- **Batas percobaan login** (5x gagal → dikunci 5 menit) disimpan di memori server. Di Vercel, perlindungan ini berlaku per instance, cukup untuk toko kecil.
- **Ganti password akun demo** atau nonaktifkan akun demo sebelum dipakai sungguhan (menu **Pengguna**).
