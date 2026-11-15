const { httpError } = require('../utils/http');
const { round2 } = require('../utils/validate');

const CASH_CATEGORIES = {
  IN: ['Penjualan', 'Modal', 'Pendapatan Lain'],
  OUT: ['Pembelian Stok', 'Operasional', 'Listrik & Air', 'Gaji Karyawan', 'Sewa Tempat', 'Transportasi', 'Prive', 'Pengeluaran Lain'],
};

/**
 * Transaksi "efektif" = bukan transaksi yang sudah dibatalkan dan bukan transaksi pembatalannya.
 * Dipakai untuk menghitung saldo & ringkasan agar pasangan koreksi tidak mengacaukan laporan.
 */
const EFFECTIVE = (alias = 'c') =>
  `${alias}.reversal_of IS NULL AND NOT EXISTS (SELECT 1 FROM cash_transactions r WHERE r.reversal_of = ${alias}.id)`;

async function createCash(conn, { type, category, amount, description = null, reference = null, transactionDate = null, stockMovementId = null, reversalOf = null, userId = null }) {
  if (!['IN', 'OUT'].includes(type)) throw httpError(400, 'Jenis transaksi kas tidak valid');
  const value = round2(amount);
  if (!(value > 0)) throw httpError(400, 'Nominal harus lebih dari 0');

  const [r] = await conn.query(
    `INSERT INTO cash_transactions
       (type, category, amount, description, reference, transaction_date, stock_movement_id, reversal_of, created_by)
     VALUES (?, ?, ?, ?, ?, COALESCE(?, NOW()), ?, ?, ?)`,
    [type, category, value, description, reference, transactionDate, stockMovementId, reversalOf, userId]
  );
  const [[row]] = await conn.query('SELECT * FROM cash_transactions WHERE id = ?', [r.insertId]);
  return row;
}

/** Batalkan transaksi kas dengan membuat transaksi kebalikan (tidak menghapus data). */
async function reverseCash(conn, { id, reason, userId, transactionDate = null }) {
  const [[original]] = await conn.query('SELECT * FROM cash_transactions WHERE id = ? FOR UPDATE', [id]);
  if (!original) throw httpError(404, 'Transaksi kas tidak ditemukan');
  if (original.reversal_of) throw httpError(400, 'Transaksi koreksi tidak bisa dibatalkan lagi');
  const [[existing]] = await conn.query('SELECT id FROM cash_transactions WHERE reversal_of = ?', [id]);
  if (existing) throw httpError(409, 'Transaksi ini sudah dibatalkan sebelumnya');

  return createCash(conn, {
    type: original.type === 'IN' ? 'OUT' : 'IN',
    category: original.category,
    amount: original.amount,
    description: `Pembatalan #${original.id}: ${reason}`,
    reference: original.reference,
    reversalOf: original.id,
    userId,
    transactionDate,
  });
}

async function cashBalance(conn) {
  const [[row]] = await conn.query(
    `SELECT COALESCE(SUM(CASE WHEN c.type = 'IN' THEN c.amount ELSE -c.amount END), 0) AS balance
     FROM cash_transactions c WHERE ${EFFECTIVE('c')}`
  );
  return row.balance;
}

module.exports = { CASH_CATEGORIES, EFFECTIVE, createCash, reverseCash, cashBalance };
