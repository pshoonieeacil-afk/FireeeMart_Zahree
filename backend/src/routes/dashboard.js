const router = require('express').Router();
const pool = require('../db/pool');
const { asyncHandler } = require('../utils/http');
const { can } = require('../utils/permissions');
const { EFFECTIVE, cashBalance } = require('../services/cash');

const p2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

function last7Days(rowsByDay, mapRow) {
  const out = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = ymd(d);
    out.push({ date: key, ...mapRow(rowsByDay[key] || {}) });
  }
  return out;
}

async function stockSection() {
  const [[totals]] = await pool.query(
    `SELECT COUNT(*) AS total_products,
            COALESCE(SUM(stock * buy_price), 0)                AS stock_value,
            COALESCE(SUM(stock * sell_price), 0)               AS potential_value,
            COALESCE(SUM(stock > 0 AND stock <= min_stock), 0) AS low_stock,
            COALESCE(SUM(stock <= 0), 0)                       AS out_of_stock
     FROM products`
  );
  const [[{ total_categories }]] = await pool.query('SELECT COUNT(*) AS total_categories FROM categories');
  const [[today]] = await pool.query(
    `SELECT COALESCE(SUM(type = 'IN'), 0) AS stock_in, COALESCE(SUM(type = 'OUT'), 0) AS stock_out, COUNT(*) AS total
     FROM stock_movements WHERE created_at >= CURDATE()`
  );
  const [lowStock] = await pool.query(
    `SELECT p.id, p.sku, p.name, p.unit, p.stock, p.min_stock, p.buy_price, p.sell_price, c.name AS category_name
     FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.stock <= p.min_stock
     ORDER BY p.stock <= 0 DESC, p.stock / NULLIF(p.min_stock, 0) ASC, p.name
     LIMIT 8`
  );
  const [recent] = await pool.query(
    `SELECT m.*, p.name AS product_name, p.unit, u.name AS created_by_name
     FROM stock_movements m JOIN products p ON p.id = m.product_id LEFT JOIN users u ON u.id = m.created_by
     ORDER BY m.created_at DESC, m.id DESC LIMIT 8`
  );
  const [dailyRows] = await pool.query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d,
            SUM(type = 'IN') AS stock_in, SUM(type = 'OUT') AS stock_out
     FROM stock_movements WHERE created_at >= CURDATE() - INTERVAL 6 DAY
     GROUP BY d`
  );
  const byDay = Object.fromEntries(dailyRows.map((r) => [r.d, r]));
  const [[lastOpname]] = await pool.query(
    'SELECT o.*, u.name AS created_by_name FROM stock_opnames o LEFT JOIN users u ON u.id = o.created_by ORDER BY o.created_at DESC, o.id DESC LIMIT 1'
  );

  return {
    totals: { ...totals, total_categories },
    today,
    low_stock: lowStock,
    recent_movements: recent,
    daily: last7Days(byDay, (r) => ({ stock_in: Number(r.stock_in || 0), stock_out: Number(r.stock_out || 0) })),
    last_opname: lastOpname || null,
  };
}

async function cashSection() {
  const eff = EFFECTIVE('c');
  const [[today]] = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN c.type = 'IN' THEN c.amount END), 0) AS cash_in,
            COALESCE(SUM(CASE WHEN c.type = 'OUT' THEN c.amount END), 0) AS cash_out,
            COALESCE(SUM(CASE WHEN c.type = 'IN' AND c.category = 'Penjualan' THEN c.amount END), 0) AS sales
     FROM cash_transactions c WHERE ${eff} AND c.transaction_date >= CURDATE()`
  );
  const [[month]] = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN c.type = 'IN' THEN c.amount END), 0) AS cash_in,
            COALESCE(SUM(CASE WHEN c.type = 'OUT' THEN c.amount END), 0) AS cash_out
     FROM cash_transactions c WHERE ${eff} AND c.transaction_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`
  );
  const [dailyRows] = await pool.query(
    `SELECT DATE_FORMAT(c.transaction_date, '%Y-%m-%d') AS d,
            SUM(CASE WHEN c.type = 'IN' THEN c.amount ELSE 0 END) AS cash_in,
            SUM(CASE WHEN c.type = 'OUT' THEN c.amount ELSE 0 END) AS cash_out
     FROM cash_transactions c WHERE ${eff} AND c.transaction_date >= CURDATE() - INTERVAL 6 DAY
     GROUP BY d`
  );
  const byDay = Object.fromEntries(dailyRows.map((r) => [r.d, r]));
  return {
    balance: await cashBalance(pool),
    today,
    month,
    daily: last7Days(byDay, (r) => ({ cash_in: Number(r.cash_in || 0), cash_out: Number(r.cash_out || 0) })),
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const [stock, cash] = await Promise.all([stockSection(), can(req.user, 'cash.view') ? cashSection() : null]);
  res.json({ ...stock, cash });
}));

module.exports = router;
