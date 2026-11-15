const router = require('express').Router();
const pool = require('../db/pool');
const { asyncHandler, httpError } = require('../utils/http');
const { str, id } = require('../utils/validate');
const { requirePerm } = require('../utils/auth');

const parse = (body) => ({
  name: str(body.name, { field: 'Nama kategori', required: true, max: 100 }),
  description: str(body.description, { field: 'Deskripsi', max: 255 }),
});

const SELECT = `
  SELECT c.*, COUNT(p.id) AS product_count, COALESCE(SUM(p.stock * p.buy_price), 0) AS stock_value
  FROM categories c LEFT JOIN products p ON p.category_id = c.id`;

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`${SELECT} GROUP BY c.id ORDER BY c.name`);
  res.json(rows);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`${SELECT} WHERE c.id = ? GROUP BY c.id`, [id(req.params.id)]);
  if (!rows[0]) throw httpError(404, 'Kategori tidak ditemukan');
  res.json(rows[0]);
}));

router.post('/', requirePerm('category.write'), asyncHandler(async (req, res) => {
  const data = parse(req.body);
  const [r] = await pool.query('INSERT INTO categories (name, description) VALUES (?, ?)', [data.name, data.description]);
  res.status(201).json({ id: r.insertId, ...data, product_count: 0, stock_value: 0 });
}));

router.put('/:id', requirePerm('category.write'), asyncHandler(async (req, res) => {
  const categoryId = id(req.params.id);
  const data = parse(req.body);
  const [r] = await pool.query('UPDATE categories SET name = ?, description = ? WHERE id = ?', [data.name, data.description, categoryId]);
  if (!r.affectedRows) throw httpError(404, 'Kategori tidak ditemukan');
  res.json({ id: categoryId, ...data });
}));

router.delete('/:id', requirePerm('category.delete'), asyncHandler(async (req, res) => {
  const categoryId = id(req.params.id);
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM products WHERE category_id = ?', [categoryId]);
  if (total > 0) {
    throw httpError(409, `Kategori masih dipakai oleh ${total} produk. Pindahkan atau hapus produknya terlebih dahulu.`);
  }
  const [r] = await pool.query('DELETE FROM categories WHERE id = ?', [categoryId]);
  if (!r.affectedRows) throw httpError(404, 'Kategori tidak ditemukan');
  res.json({ message: 'Kategori berhasil dihapus' });
}));

module.exports = router;
