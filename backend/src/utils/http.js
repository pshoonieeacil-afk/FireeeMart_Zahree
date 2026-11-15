const pool = require('../db/pool');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** Bungkus handler async agar error otomatis diteruskan ke error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Jalankan fn di dalam satu transaksi database. Rollback otomatis jika gagal. */
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { httpError, asyncHandler, withTransaction };
