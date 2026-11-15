const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { asyncHandler, httpError } = require('../utils/http');
const { str } = require('../utils/validate');
const { authenticate, setAuthCookie, clearAuthCookie, publicUser } = require('../utils/auth');

// Pembatas percobaan login sederhana (per instance server): 5x gagal -> kunci 5 menit
const attempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;
// Hash dummy agar waktu respons sama walau username tidak ada (mencegah tebak username)
const DUMMY_HASH = bcrypt.hashSync('dummy-password-fireeemart', 10);

router.post('/login', asyncHandler(async (req, res) => {
  const username = str(req.body.username, { field: 'Username', required: true, max: 50 }).toLowerCase();
  const password = str(req.body.password, { field: 'Password', required: true, max: 100 });

  const key = `${req.ip}|${username}`;
  const entry = attempts.get(key);
  if (entry?.lockedUntil > Date.now()) {
    const minutes = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
    throw httpError(429, `Terlalu banyak percobaan login. Coba lagi dalam ${minutes} menit.`);
  }

  const [[user]] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

  if (!user || !valid) {
    const count = (entry?.count || 0) + 1;
    attempts.set(key, count >= MAX_ATTEMPTS ? { count: 0, lockedUntil: Date.now() + LOCK_MS } : { count });
    throw httpError(401, 'Username atau password salah');
  }
  if (!user.is_active) throw httpError(403, 'Akun Anda dinonaktifkan. Hubungi pemilik toko.');

  attempts.delete(key);
  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
  setAuthCookie(res, user);
  res.json({ user: publicUser(user) });
}));

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ message: 'Berhasil keluar' });
});

router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));

router.put('/password', authenticate, asyncHandler(async (req, res) => {
  const current = str(req.body.current_password, { field: 'Password lama', required: true, max: 100 });
  const next = str(req.body.new_password, { field: 'Password baru', required: true, max: 100 });
  if (next.length < 6) throw httpError(400, 'Password baru minimal 6 karakter');

  const [[user]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(current, user.password_hash))) throw httpError(400, 'Password lama salah');

  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(next, 10), req.user.id]);
  res.json({ message: 'Password berhasil diganti' });
}));

module.exports = router;
