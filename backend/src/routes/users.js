const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { asyncHandler, httpError } = require('../utils/http');
const { str, id } = require('../utils/validate');

const ROLES = ['owner', 'kasir', 'gudang'];
const USERNAME_RE = /^[a-z0-9._]{3,30}$/;

const SELECT = `
  SELECT u.id, u.name, u.username, u.role, u.is_active, u.last_login_at, u.created_at,
    (SELECT COUNT(*) FROM stock_movements m WHERE m.created_by = u.id)
    + (SELECT COUNT(*) FROM cash_transactions c WHERE c.created_by = u.id)
    + (SELECT COUNT(*) FROM stock_opnames o WHERE o.created_by = u.id) AS activity_count
  FROM users u`;

function parse(body, { requirePassword }) {
  const username = str(body.username, { field: 'Username', required: true, max: 30 }).toLowerCase();
  if (!USERNAME_RE.test(username)) {
    throw httpError(400, 'Username 3–30 karakter, hanya huruf kecil, angka, titik, atau underscore');
  }
  const role = body.role;
  if (!ROLES.includes(role)) throw httpError(400, 'Peran tidak valid');
  const password = str(body.password, { field: 'Password', required: requirePassword, max: 100 });
  if (password && password.length < 6) throw httpError(400, 'Password minimal 6 karakter');
  return {
    name: str(body.name, { field: 'Nama', required: true, max: 100 }),
    username,
    role,
    password,
    is_active: body.is_active === undefined ? true : !!body.is_active,
  };
}

async function otherActiveOwners(userId) {
  const [[{ total }]] = await pool.query(
    "SELECT COUNT(*) AS total FROM users WHERE role = 'owner' AND is_active = 1 AND id <> ?",
    [userId]
  );
  return total;
}

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`${SELECT} ORDER BY FIELD(u.role, 'owner', 'kasir', 'gudang'), u.name`);
  res.json(rows.map((u) => ({ ...u, is_active: !!u.is_active })));
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = parse(req.body, { requirePassword: true });
  const hash = await bcrypt.hash(data.password, 10);
  const [r] = await pool.query(
    'INSERT INTO users (name, username, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
    [data.name, data.username, hash, data.role, data.is_active ? 1 : 0]
  );
  const [[user]] = await pool.query(`${SELECT} WHERE u.id = ?`, [r.insertId]);
  res.status(201).json({ ...user, is_active: !!user.is_active });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const userId = id(req.params.id);
  const data = parse(req.body, { requirePassword: false });
  const [[existing]] = await pool.query('SELECT id, role, is_active FROM users WHERE id = ?', [userId]);
  if (!existing) throw httpError(404, 'Pengguna tidak ditemukan');

  if (userId === req.user.id && (data.role !== existing.role || !data.is_active)) {
    throw httpError(400, 'Anda tidak bisa mengubah peran atau menonaktifkan akun sendiri');
  }
  const losingOwner = existing.role === 'owner' && existing.is_active && (data.role !== 'owner' || !data.is_active);
  if (losingOwner && (await otherActiveOwners(userId)) === 0) {
    throw httpError(400, 'Harus ada minimal satu Owner yang aktif');
  }

  const fields = ['name = ?', 'username = ?', 'role = ?', 'is_active = ?'];
  const params = [data.name, data.username, data.role, data.is_active ? 1 : 0];
  if (data.password) {
    fields.push('password_hash = ?');
    params.push(await bcrypt.hash(data.password, 10));
  }
  await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, [...params, userId]);
  const [[user]] = await pool.query(`${SELECT} WHERE u.id = ?`, [userId]);
  res.json({ ...user, is_active: !!user.is_active });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const userId = id(req.params.id);
  if (userId === req.user.id) throw httpError(400, 'Anda tidak bisa menghapus akun sendiri');

  const [[user]] = await pool.query(`${SELECT} WHERE u.id = ?`, [userId]);
  if (!user) throw httpError(404, 'Pengguna tidak ditemukan');
  if (user.activity_count > 0) {
    throw httpError(409, 'Pengguna ini sudah punya riwayat transaksi. Nonaktifkan saja agar jejak audit tetap tersimpan.');
  }
  if (user.role === 'owner' && user.is_active && (await otherActiveOwners(userId)) === 0) {
    throw httpError(400, 'Harus ada minimal satu Owner yang aktif');
  }
  await pool.query('DELETE FROM users WHERE id = ?', [userId]);
  res.json({ message: 'Pengguna berhasil dihapus' });
}));

module.exports = router;
