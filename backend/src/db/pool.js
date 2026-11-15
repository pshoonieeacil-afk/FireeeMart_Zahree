const mysql = require('mysql2/promise');
const { connectionConfig, DB_TIMEZONE } = require('./config');

const pool = mysql.createPool({
  ...connectionConfig(),
  waitForConnections: true,
  // Di Vercel (serverless) tiap instance cukup memakai sedikit koneksi
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || (process.env.VERCEL ? 3 : 10)),
  maxIdle: 3,
  idleTimeout: 60000,
  enableKeepAlive: true,
  decimalNumbers: true, // DECIMAL dikembalikan sebagai number, bukan string
  dateStrings: true, // DATETIME dikembalikan apa adanya: "YYYY-MM-DD HH:MM:SS"
});

// Samakan zona waktu sesi MySQL (NOW(), CURDATE()) dengan zona waktu toko
pool.pool.on('connection', (conn) => {
  conn.query(`SET time_zone = '${DB_TIMEZONE.replace(/[^0-9:+-]/g, '')}'`);
});

module.exports = pool;
