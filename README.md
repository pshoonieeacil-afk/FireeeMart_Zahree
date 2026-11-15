# 🔥 FireeeMart

**Your Daily Needs, One Click Away**

Aplikasi web **inventori + kas** untuk toko sembako (beras, minyak goreng, gula, kopi, teh, telur, dll).

**Masalah yang diselesaikan:** pencatatan barang dan stok masih manual, sehingga jumlah stok sering tidak sesuai dengan kondisi sebenarnya.

| Penyebab masalah | Solusi di FireeeMart |
| --- | --- |
| Stok diubah langsung tanpa catatan | Stok **tidak bisa diedit langsung**, hanya lewat Stok Masuk, Stok Keluar, atau Stock Opname |
| Tidak tahu kapan, kenapa, dan **siapa** yang mengubah stok | **Kartu stok**: setiap transaksi menyimpan stok sebelum → sesudah, keterangan, no. faktur/nota, dan nama petugas |
| Catatan dicoret atau dihapus | Transaksi stok & kas **tidak bisa diedit/dihapus**. Kas dikoreksi dengan tombol *Batalkan* yang membuat transaksi pembalik |
| Stok minus atau ditimpa transaksi lain | Stok keluar ditolak jika melebihi stok tersedia. Baris produk dikunci (`SELECT … FOR UPDATE`) selama transaksi |
| Penjualan dan kas dicatat terpisah lalu tidak cocok | **Stok ↔ Kas terhubung**: stok keluar sebagai penjualan otomatis menjadi kas masuk, dan pembelian stok tunai otomatis menjadi kas keluar |
| Selisih baru ketahuan saat barang habis | **Stock Opname**: hitung fisik, lihat selisih & nilai kerugian, lalu stok disesuaikan otomatis |
| Semua orang bisa mengubah apa saja | **Login + peran** Owner / Kasir / Gudang |

## Fitur

- **Login** dengan sesi aman (cookie httpOnly + JWT, password di-hash bcrypt, batas percobaan login).
- **Dashboard**: saldo kas, penjualan hari ini, stok menipis/habis, grafik arus kas & aktivitas stok 7 hari, akurasi stok opname terakhir, daftar restock, dan tombol *Catat Penjualan*.
- **Produk & Kategori (CRUD)**: SKU otomatis, satuan bebas, harga beli/jual + margin, stok minimum, lokasi rak, filter & pencarian.
- **Stok Masuk & Keluar**: pratinjau stok sesudah transaksi, opsi pencatatan kas otomatis, dan kartu stok dengan filter.
- **Stock Opname**: input hitungan fisik, selisih langsung terlihat, riwayat dengan persentase akurasi.
- **Kas**: pemasukan/pengeluaran per kategori, filter periode, saldo awal → saldo akhir, komposisi per kategori, dan pembatalan transaksi.
- **Pengguna** (khusus Owner): tambah/edit/nonaktifkan akun, atur peran, dan reset password.
- **Animasi halus**: transisi halaman, angka menghitung naik, grafik tumbuh, modal & notifikasi beranimasi. Otomatis dimatikan jika perangkat diatur "kurangi gerakan".

### Hak akses per peran

| Menu / aksi | Owner | Kasir | Gudang |
| --- | :-: | :-: | :-: |
| Dashboard, lihat produk & kategori, kartu stok | ✅ | ✅ | ✅ |
| Tambah/edit produk & kategori | ✅ | – | ✅ |
| Hapus produk & kategori | ✅ | – | – |
| Stok masuk | ✅ | – | ✅ |
| Stok keluar | ✅ | ✅ | ✅ |
| Stock opname | ✅ | – | ✅ |
| Kas (lihat & catat) | ✅ | ✅ | – |
| Kelola pengguna | ✅ | – | – |

## Teknologi

- **Frontend:** Next.js 14 (App Router) + React 18, Framer Motion, lucide-react, CSS murni (tanpa framework)
- **Backend:** Node.js + Express (REST API), JWT, bcryptjs
- **Database:** MySQL 8 / MariaDB (XAMPP) / TiDB Cloud

```
fireeemart/
├── backend/                     # REST API Express
│   ├── api/index.js             # entry point Vercel (serverless)
│   ├── vercel.json
│   └── src/
│       ├── app.js               # konfigurasi Express + routing + error handler
│       ├── server.js            # menjalankan server lokal (npm run dev)
│       ├── db/                  # schema.sql, init, seed (data contoh), create-user
│       ├── services/            # logika stok, kas, opname
│       ├── routes/              # auth, users, products, categories, movements, cash, opname, dashboard
│       └── utils/               # auth (JWT), permissions (hak akses), validasi
└── frontend/                    # Next.js
    ├── middleware.js            # mengalihkan ke /login jika belum masuk
    ├── next.config.mjs          # proxy /api -> backend
    ├── app/
    │   ├── login/               # halaman login
    │   └── (app)/               # halaman setelah login: /, produk, kategori, stok, opname, kas, pengguna
    ├── components/              # Sidebar, Modal, Toast, StockModal, CashModal, animasi (motion.js), dll
    └── lib/                     # api client, format Rupiah/tanggal, permissions
```

## Menjalankan di Komputer Sendiri

Yang dibutuhkan: **Node.js 18.17+** dan **MySQL/MariaDB** yang sedang berjalan (mis. klik *Start* pada MySQL di XAMPP Control Panel).

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Buka `backend/.env`, sesuaikan `DB_USER` / `DB_PASSWORD` bila perlu, dan isi `JWT_SECRET` dengan teks acak. Lalu:

```bash
npm run db:init
npm run dev
```

API berjalan di http://localhost:5000/api. Perintah `db:init` membuat database `fireeemart` dan mengisi data contoh beserta 3 akun demo:

| Peran | Username | Password |
| --- | --- | --- |
| Owner | `owner` | `owner123` |
| Kasir | `kasir` | `kasir123` |
| Gudang | `gudang` | `gudang123` |

> ⚠️ `npm run db:init` **menghapus lalu membuat ulang** semua tabel. Untuk database kosong tanpa data contoh, pakai `npm run db:schema`, lalu buat akun Owner:
> `npm run user:create -- --username owner --password RahasiaKuat123 --name "Pemilik Toko"`

### 2. Frontend (terminal baru)

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Buka http://localhost:3000 lalu login.

## Mengubah Sendiri (Edit Minor)

| Ingin mengubah… | File |
| --- | --- |
| Warna tema | `frontend/app/globals.css`, bagian `:root` (`--brand`, `--brand-deep`, `--primary`, …) |
| Nama aplikasi & tagline | `frontend/components/Logo.js` (`APP_NAME`, `TAGLINE`) + `frontend/app/layout.js` (judul tab) |
| Teks & tampilan halaman login | `frontend/app/login/page.js` |
| Menu sidebar | `frontend/components/Sidebar.js` (array `NAV`) |
| Hak akses peran | `backend/src/utils/permissions.js` **dan** `frontend/lib/permissions.js` (samakan keduanya) |
| Kategori kas | `backend/src/services/cash.js` (`CASH_CATEGORIES`) |
| Daftar satuan barang | `frontend/lib/format.js` (`UNITS`) |
| Data contoh | `backend/src/db/seed.js`, lalu jalankan `npm run db:init` |
| Kecepatan animasi | `frontend/components/motion.js` dan `frontend/app/providers.js` |

## Upload ke GitHub & Deploy ke Vercel

Panduan langkah demi langkah ada di **[DEPLOY.md](DEPLOY.md)**.

## Endpoint API (ringkas)

Semua endpoint selain `/api/health` dan `/api/auth/*` wajib login.

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| POST | `/api/auth/login` · `/api/auth/logout` | Masuk / keluar |
| GET · PUT | `/api/auth/me` · `/api/auth/password` | Data user aktif / ganti password |
| GET | `/api/dashboard` | Ringkasan (bagian kas hanya untuk Owner/Kasir) |
| CRUD | `/api/categories`, `/api/products` | Master data |
| GET · POST | `/api/movements` | Kartu stok / catat stok masuk-keluar (`cash: { enabled, unit_price }` untuk kas otomatis) |
| GET · POST | `/api/opname`, `/api/opname/:id` | Stock opname |
| GET · POST | `/api/cash`, `/api/cash/summary`, `/api/cash/categories` | Buku kas & ringkasan |
| POST | `/api/cash/:id/reverse` | Batalkan transaksi kas (`{ reason }`) |
| CRUD | `/api/users` | Kelola pengguna (Owner) |
