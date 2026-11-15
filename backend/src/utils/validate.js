const { httpError } = require('./http');

const round2 = (n) => Math.round(Number(n) * 100) / 100;

function str(value, { field, required = false, max = 255 } = {}) {
  const s = (value ?? '').toString().trim();
  if (required && !s) throw httpError(400, `${field} wajib diisi`);
  if (s.length > max) throw httpError(400, `${field} maksimal ${max} karakter`);
  return s || null;
}

function num(value, { field, required = false, min = 0, positive = false, fallback = null } = {}) {
  if (value === '' || value === null || value === undefined) {
    if (required) throw httpError(400, `${field} wajib diisi`);
    return fallback;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) throw httpError(400, `${field} harus berupa angka`);
  if (positive && n <= 0) throw httpError(400, `${field} harus lebih dari 0`);
  if (min !== null && n < min) throw httpError(400, `${field} tidak boleh kurang dari ${min}`);
  return round2(n);
}

function id(value, field = 'ID') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw httpError(400, `${field} tidak valid`);
  return n;
}

module.exports = { str, num, id, round2 };
