const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { httpError } = require('./http');
const { can } = require('./permissions');

const COOKIE_NAME = 'fm_token';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

function secret() {
  const s = process.env.JWT_SECRET;
  if (s && s !== 'ganti-dengan-string-acak-yang-panjang') return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET belum di-set. Isi environment variable JWT_SECRET dengan string acak yang panjang.');
  }
  return 'dev-only-secret-fireeemart';
}

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
  path: '/',
});

function setAuthCookie(res, user) {
  const token = jwt.sign({ sub: user.id, role: user.role }, secret(), { expiresIn: Math.floor(MAX_AGE_MS / 1000) });
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: MAX_AGE_MS });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

const publicUser = (u) => ({ id: u.id, name: u.name, username: u.username, role: u.role });

/** Middleware: wajib login. Data user dibaca ulang dari DB agar perubahan peran/nonaktif langsung berlaku. */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = req.cookies?.[COOKIE_NAME] || (header.startsWith('Bearer ') ? header.slice(7) : null);
    if (!token) throw httpError(401, 'Silakan login terlebih dahulu');

    let payload;
    try {
      payload = jwt.verify(token, secret());
    } catch {
      throw httpError(401, 'Sesi berakhir, silakan login kembali');
    }

    const [[user]] = await pool.query('SELECT id, name, username, role, is_active FROM users WHERE id = ?', [payload.sub]);
    if (!user || !user.is_active) throw httpError(401, 'Akun tidak aktif, silakan hubungi pemilik toko');
    req.user = publicUser(user);
    next();
  } catch (err) {
    next(err);
  }
}

/** Middleware: wajib punya hak akses tertentu. */
const requirePerm = (perm) => (req, res, next) =>
  can(req.user, perm) ? next() : next(httpError(403, 'Anda tidak memiliki akses untuk tindakan ini'));

module.exports = { authenticate, requirePerm, setAuthCookie, clearAuthCookie, publicUser };
