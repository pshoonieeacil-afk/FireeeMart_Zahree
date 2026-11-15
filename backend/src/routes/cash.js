const router = require('express').Router();
const pool = require('../db/pool');
const { asyncHandler, httpError, withTransaction } = require('../utils/http');
const { str, num, id } = require('../utils/validate');
const { requirePerm } = require('../utils/auth');
const { CASH_CATEGORIES, EFFECTIVE, createCash, reverseCash, cashBalance } = require('../services/cash');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?$/;

const p2 = (n) => String(n).padStart(2, '0');
const nowString = (offsetMs = 0) => {
  const d = new Date(Date.now() + offsetMs);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
};

function dateRange(query, column = 'c.transaction_date') {
  const where = [];
  const params = [];
  if (query.from) {
    if (!DATE_RE.test(query.from)) throw httpError(400, 'Format tanggal awal tidak valid');
    where.push(`${column} >= ?`);
    params.push(query.from);
  }
  if (query.to) {
    if (!DATE_RE.test(query.to)) throw httpError(400, 'Format tanggal akhir tidak valid');
    where.push(`${column} < DATE_ADD(?, INTERVAL 1 DAY)`);
    params.push(query.to);
  }
  return { where, params };
}

router.get('/categories', (req, res) => res.json(CASH_CATEGORIES));

// GET /api/cash?from=&to=&type=&category=&search=&limit=
router.get('/', requirePerm('cash.view'), asyncHandler(async (req, res) => {
  const { where, params } = dateRange(req.query);
  if (req.query.type) {
    if (!['IN', 'OUT'].includes(req.query.type)) throw httpError(400, 'Jenis transaksi tidak valid');
    where.push('c.type = ?');
    params.push(req.query.type);
  }
  if (req.query.category) {
    where.push('c.category = ?');
    params.push(req.query.category);
  }
  if (req.query.search) {
    where.push('(c.description LIKE ? OR c.reference LIKE ? OR c.category LIKE ?)');
    const q = `%${req.query.search}%`;
    params.push(q, q, q);
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 300, 1), 1000);

  const [rows] = await pool.query(
    `SELECT c.*, u.name AS created_by_name, r.id AS reversed_by_id,
            m.product_id, m.quantity AS movement_quantity, p.name AS product_name, p.unit
     FROM cash_transactions c
     LEFT JOIN users u ON u.id = c.created_by
     LEFT JOIN cash_transactions r ON r.reversal_of = c.id
     LEFT JOIN stock_movements m ON m.id = c.stock_movement_id
     LEFT JOIN products p ON p.id = m.product_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY c.transaction_date DESC, c.id DESC LIMIT ${limit}`,
    params
  );
  res.json(rows);
}));

// GET /api/cash/summary?from=&to=  -> saldo awal, pemasukan, pengeluaran, saldo akhir, per kategori
router.get('/summary', requirePerm('cash.view'), asyncHandler(async (req, res) => {
  const { where, params } = dateRange(req.query);
  const effective = EFFECTIVE('c');
  const periodWhere = [effective, ...where].join(' AND ');

  const [[period]] = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN c.type = 'IN' THEN c.amount END), 0) AS total_in,
            COALESCE(SUM(CASE WHEN c.type = 'OUT' THEN c.amount END), 0) AS total_out,
            COUNT(*) AS count
     FROM cash_transactions c WHERE ${periodWhere}`,
    params
  );

  let opening = 0;
  if (req.query.from) {
    const [[row]] = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN c.type = 'IN' THEN c.amount ELSE -c.amount END), 0) AS opening
       FROM cash_transactions c WHERE ${effective} AND c.transaction_date < ?`,
      [req.query.from]
    );
    opening = row.opening;
  }

  const [byCategory] = await pool.query(
    `SELECT c.type, c.category, SUM(c.amount) AS total, COUNT(*) AS count
     FROM cash_transactions c WHERE ${periodWhere}
     GROUP BY c.type, c.category ORDER BY total DESC`,
    params
  );

  const net = period.total_in - period.total_out;
  res.json({
    balance: await cashBalance(pool),
    opening_balance: opening,
    total_in: period.total_in,
    total_out: period.total_out,
    net,
    closing_balance: opening + net,
    count: period.count,
    by_category: byCategory,
  });
}));

// POST /api/cash { type, category, amount, description?, reference?, transaction_date? }
router.post('/', requirePerm('cash.write'), asyncHandler(async (req, res) => {
  const { type, category } = req.body;
  if (!['IN', 'OUT'].includes(type)) throw httpError(400, 'Pilih jenis transaksi: pemasukan atau pengeluaran');
  if (!CASH_CATEGORIES[type].includes(category)) throw httpError(400, 'Kategori kas tidak valid');

  let transactionDate = null;
  if (req.body.transaction_date) {
    const m = DATETIME_RE.exec(String(req.body.transaction_date));
    if (!m) throw httpError(400, 'Format tanggal transaksi tidak valid');
    transactionDate = `${m[1]} ${m[2]}${m[3] || ':00'}`;
    if (transactionDate > nowString(5 * 60 * 1000)) throw httpError(400, 'Tanggal transaksi tidak boleh di masa depan');
  }

  const row = await withTransaction((conn) =>
    createCash(conn, {
      type,
      category,
      amount: num(req.body.amount, { field: 'Nominal', required: true, positive: true }),
      description: str(req.body.description, { field: 'Keterangan', max: 255 }),
      reference: str(req.body.reference, { field: 'Referensi', max: 100 }),
      transactionDate,
      userId: req.user.id,
    })
  );
  res.status(201).json(row);
}));

// POST /api/cash/:id/reverse { reason }
router.post('/:id/reverse', requirePerm('cash.write'), asyncHandler(async (req, res) => {
  const reason = str(req.body.reason, { field: 'Alasan pembatalan', required: true, max: 200 });
  const row = await withTransaction((conn) => reverseCash(conn, { id: id(req.params.id), reason, userId: req.user.id }));
  res.status(201).json(row);
}));

module.exports = router;
