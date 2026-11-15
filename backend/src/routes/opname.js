const router = require('express').Router();
const pool = require('../db/pool');
const { asyncHandler, httpError, withTransaction } = require('../utils/http');
const { id } = require('../utils/validate');
const { createOpname } = require('../services/opname');

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT o.*, u.name AS created_by_name,
            COALESCE(SUM(i.difference > 0), 0) AS surplus_items,
            COALESCE(SUM(i.difference < 0), 0) AS shortage_items,
            COALESCE(SUM(CASE WHEN i.difference < 0 THEN -i.difference * p.buy_price ELSE 0 END), 0) AS shortage_value
     FROM stock_opnames o
     LEFT JOIN users u ON u.id = o.created_by
     LEFT JOIN stock_opname_items i ON i.opname_id = o.id
     LEFT JOIN products p ON p.id = i.product_id
     GROUP BY o.id ORDER BY o.created_at DESC, o.id DESC`
  );
  res.json(rows);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const opnameId = id(req.params.id);
  const [[opname]] = await pool.query(
    'SELECT o.*, u.name AS created_by_name FROM stock_opnames o LEFT JOIN users u ON u.id = o.created_by WHERE o.id = ?',
    [opnameId]
  );
  if (!opname) throw httpError(404, 'Data stock opname tidak ditemukan');
  const [items] = await pool.query(
    `SELECT i.*, p.name AS product_name, p.sku, p.unit, p.buy_price
     FROM stock_opname_items i JOIN products p ON p.id = i.product_id
     WHERE i.opname_id = ? ORDER BY (i.difference = 0), p.name`,
    [opnameId]
  );
  res.json({ ...opname, items });
}));

// POST /api/opname  { note?, items: [{ product_id, physical_stock }] }
router.post('/', asyncHandler(async (req, res) => {
  const result = await withTransaction((conn) =>
    createOpname(conn, { note: req.body.note, items: req.body.items, userId: req.user.id })
  );
  res.status(201).json(result);
}));

module.exports = router;
