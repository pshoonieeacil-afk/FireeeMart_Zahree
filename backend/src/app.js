require('dotenv').config();
// Semua perhitungan tanggal (hari ini, 7 hari terakhir) memakai zona waktu toko
process.env.TZ = process.env.APP_TIMEZONE || 'Asia/Jakarta';

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pool = require('./db/pool');
const { authenticate, requirePerm } = require('./utils/auth');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) : false,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', app: 'FireeeMart API', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'disconnected', message: err.message });
  }
});

// Publik
app.use('/api/auth', require('./routes/auth'));

// Semua endpoint di bawah ini wajib login
app.use('/api', authenticate);
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/products', require('./routes/products'));
app.use('/api/movements', require('./routes/movements'));
app.use('/api/opname', requirePerm('opname'), require('./routes/opname'));
app.use('/api/cash', require('./routes/cash'));
app.use('/api/users', requirePerm('users'), require('./routes/users'));

app.use((req, res) => res.status(404).json({ message: `Endpoint ${req.method} ${req.path} tidak ditemukan` }));

// Error handler: ubah error MySQL menjadi pesan yang mudah dipahami pengguna
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let { message } = err;

  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Format data (JSON) tidak valid';
  } else if (err.code === 'ER_DUP_ENTRY') {
    status = 409;
    if (err.sqlMessage?.includes('uq_products_sku')) message = 'SKU sudah digunakan oleh produk lain';
    else if (err.sqlMessage?.includes('uq_categories_name')) message = 'Nama kategori sudah ada';
    else if (err.sqlMessage?.includes('uq_users_username')) message = 'Username sudah dipakai';
    else if (err.sqlMessage?.includes('uq_cash_reversal')) message = 'Transaksi ini sudah dibatalkan sebelumnya';
    else message = 'Data sudah ada (duplikat)';
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
    status = 400;
    message = 'Kategori yang dipilih tidak ditemukan';
  } else if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
    status = 409;
    message = 'Data masih digunakan oleh data lain';
  } else if (['ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ETIMEDOUT', 'ENOTFOUND'].includes(err.code)) {
    status = 503;
    message = 'Tidak dapat terhubung ke database MySQL. Periksa apakah MySQL berjalan dan konfigurasi .env sudah benar.';
  } else if (status >= 500) {
    console.error(err);
    message = 'Terjadi kesalahan pada server';
  }

  res.status(status).json({ message });
});

module.exports = app;
