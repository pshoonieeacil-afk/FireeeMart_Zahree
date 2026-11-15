const router = require('express').Router();
const pool = require('../db/pool');
const { asyncHandler, httpError, withTransaction } = require('../utils/http');
const { str, num, id } = require('../utils/validate');
const { can } = require('../utils/permissions');
const { applyMovement } = require('../services/stock');
const { createCash } = require('../services/cash');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const rupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

// GET /api/movements?product_id=&type=IN|OUT|ADJUST&from=YYYY-MM-DD&to=YYYY-MM-DD&search=&limit=
router.get('/', asyncHandler(async (req, res) => {
  const where = [];
  const params = [];
  const { product_id, type, from, to, search } = req.query;

  if (product_id) { where.push('m.product_id = ?'); params.push(id(product_id, 'Produk')); }
  if (type) {
    if (!['IN', 'OUT', 'ADJUST'].includes(type)) throw httpError(400, 'Jenis transaksi tidak valid');
    where.push('m.type = ?'); params.push(type);
  }
  if (from) {
    if (!DATE_RE.test(from)) throw httpError(400, 'Format tanggal awal tidak valid');
    where.push('m.created_at >= ?'); params.push(from);
  }
  if (to) {
    if (!DATE_RE.test(to)) throw httpError(400, 'Format tanggal akhir tidak valid');
    where.push('m.created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(to);
  }
  if (search) {
    where.push('(p.name LIKE ? OR p.sku LIKE ? OR m.reference LIKE ? OR m.note LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000);

  const [rows] = await pool.query(
    `SELECT m.*, p.name AS product_name, p.sku, p.unit, u.name AS created_by_name,
            c.id AS cash_id, c.type AS cash_type, c.amount AS cash_amount
     FROM stock_movements m
     JOIN products p ON p.id = m.product_id
     LEFT JOIN users u ON u.id = m.created_by
     LEFT JOIN cash_transactions c ON c.stock_movement_id = m.id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY m.created_at DESC, m.id DESC LIMIT ${limit}`,
    params
  );
  res.json(rows);
}));

/**
 * POST /api/movements
 * { product_id, type: 'IN'|'OUT', quantity, note?, reference?, cash?: { enabled, unit_price } }
 *
 * Jika `cash.enabled`, transaksi kas dibuat otomatis dalam transaksi DB yang sama:
 *   - stok KELUAR  -> kas MASUK  kategori "Penjualan"      (jumlah × harga jual)
 *   - stok MASUK   -> kas KELUAR kategori "Pembelian Stok" (jumlah × harga beli)
 */
router.post('/', asyncHandler(async (req, res) => {
  const { type } = req.body;
  if (!['IN', 'OUT'].includes(type)) {
    throw httpError(400, 'Jenis transaksi harus IN (masuk) atau OUT (keluar). Gunakan stock opname untuk penyesuaian.');
  }
  if (!can(req.user, type === 'IN' ? 'stock.in' : 'stock.out')) {
    throw httpError(403, `Peran Anda tidak bisa mencatat stok ${type === 'IN' ? 'masuk' : 'keluar'}`);
  }

  const payload = {
    productId: id(req.body.product_id, 'Produk'),
    type,
    quantity: num(req.body.quantity, { field: 'Jumlah', required: true, positive: true }),
    note: str(req.body.note, { field: 'Catatan', max: 255 }),
    reference: str(req.body.reference, { field: 'Referensi', max: 100 }),
    userId: req.user.id,
  };

  const withCash = !!req.body.cash?.enabled;
  let unitPrice = 0;
  if (withCash) {
    if (!can(req.user, 'cash.write')) throw httpError(403, 'Peran Anda tidak bisa mencatat transaksi kas');
    unitPrice = num(req.body.cash.unit_price, { field: 'Harga satuan', required: true, positive: true });
  }

  const result = await withTransaction(async (conn) => {
    const movement = await applyMovement(conn, payload);
    let cash = null;
    if (withCash) {
      const isSale = type === 'OUT';
      cash = await createCash(conn, {
        type: isSale ? 'IN' : 'OUT',
        category: isSale ? 'Penjualan' : 'Pembelian Stok',
        amount: movement.quantity * unitPrice,
        description: `${isSale ? 'Penjualan' : 'Pembelian'} ${movement.product_name} ${movement.quantity} ${movement.unit} × ${rupiah(unitPrice)}`,
        reference: payload.reference,
        stockMovementId: movement.id,
        userId: req.user.id,
      });
    }
    return { ...movement, cash };
  });

  res.status(201).json(result);
}));

// Catatan: transaksi stok sengaja tidak bisa diedit/dihapus (jejak audit).
// Kesalahan input dikoreksi dengan transaksi kebalikan atau lewat stock opname.

module.exports = router;
