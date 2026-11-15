/**
 * Membuat database + tabel, lalu (opsional) mengisi data contoh.
 *   npm run db:init       -> skema + data contoh + akun demo
 *   npm run db:schema     -> skema saja (tabel kosong). Lanjutkan dengan `npm run user:create`
 * PERINGATAN: tabel lama akan dihapus dan dibuat ulang.
 */
// --env=.env.production -> pakai file env lain (mis. untuk database cloud)
const envArg = process.argv.find((a) => a.startsWith('--env='));
require('dotenv').config({ path: envArg ? envArg.slice(6) : '.env' });
process.env.TZ = process.env.APP_TIMEZONE || 'Asia/Jakarta';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { connectionConfig } = require('./config');

async function main() {
  const dbName = process.env.DB_NAME || 'fireeemart';
  if (!/^\w+$/.test(dbName)) throw new Error('DB_NAME hanya boleh berisi huruf, angka, dan underscore');

  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8').replace(/\bfireeemart\b/g, dbName);

  const conn = await mysql.createConnection({ ...connectionConfig({ withDatabase: false }), multipleStatements: true });
  await conn.query(sql);
  await conn.end();
  console.log(`✔ Database "${dbName}" dan tabel berhasil dibuat`);

  if (!process.argv.includes('--no-seed')) {
    const { seed, DEMO_USERS } = require('./seed');
    await seed();
    console.log('✔ Data contoh berhasil ditambahkan');
    console.log('\n  Akun demo:');
    DEMO_USERS.forEach((u) => console.log(`   - ${u.role.padEnd(6)}  username: ${u.username.padEnd(7)} password: ${u.password}`));
    console.log('\n  ⚠ Ganti/nonaktifkan akun demo sebelum dipakai sungguhan.\n');
  } else {
    console.log('  Buat akun Owner pertama dengan:');
    console.log('  npm run user:create -- --username owner --password RahasiaKuat123 --name "Pemilik Toko"');
  }
  await require('./pool').end();
}

main().catch((err) => {
  console.error('✖ Gagal inisialisasi database:', err.message);
  process.exit(1);
});
