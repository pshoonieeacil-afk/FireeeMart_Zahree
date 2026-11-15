/** Konfigurasi koneksi MySQL yang dipakai bersama oleh pool, init, dan seed. */
function sslConfig() {
  if (process.env.DB_SSL !== 'true') return undefined;
  const ssl = { minVersion: 'TLSv1.2', rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };
  if (process.env.DB_SSL_CA) ssl.ca = process.env.DB_SSL_CA.replace(/\\n/g, '\n');
  return ssl;
}

function connectionConfig({ withDatabase = true } = {}) {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    ...(withDatabase ? { database: process.env.DB_NAME || 'fireeemart' } : {}),
    ssl: sslConfig(),
  };
}

const DB_TIMEZONE = process.env.DB_TIMEZONE || '+07:00';

module.exports = { connectionConfig, DB_TIMEZONE };
