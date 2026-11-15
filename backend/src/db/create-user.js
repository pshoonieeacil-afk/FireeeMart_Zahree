/**
 * Membuat akun pengguna dari terminal (berguna untuk akun Owner pertama di production).
 *   npm run user:create -- --username owner --password RahasiaKuat123 --name "Pemilik Toko" [--role owner|kasir|gudang]
 */
// --env=.env.production -> pakai file env lain (mis. untuk database cloud)
const envArg = process.argv.find((a) => a.startsWith('--env='));
require('dotenv').config({ path: envArg ? envArg.slice(6) : '.env' });
const bcrypt = require('bcryptjs');
const pool = require('./pool');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const username = (arg('username') || '').toLowerCase();
  const password = arg('password') || '';
  const name = arg('name') || username;
  const role = arg('role') || 'owner';

  if (!/^[a-z0-9._]{3,30}$/.test(username)) throw new Error('Username 3–30 karakter: huruf kecil, angka, titik, underscore');
  if (password.length < 6) throw new Error('Password minimal 6 karakter');
  if (!['owner', 'kasir', 'gudang'].includes(role)) throw new Error('Role harus owner, kasir, atau gudang');

  await pool.query('INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)', [
    name, username, await bcrypt.hash(password, 10), role,
  ]);
  console.log(`✔ Akun "${username}" (${role}) berhasil dibuat`);
}

main()
  .catch((err) => {
    console.error('✖', err.code === 'ER_DUP_ENTRY' ? 'Username sudah dipakai' : err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
