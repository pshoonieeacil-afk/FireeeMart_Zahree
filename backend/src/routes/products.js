const router = require('express').Router();
const pool = require('../db/pool');
const { asyncHandler, httpError, withTransaction } = require('../utils/http');
const { str, num, id } = require('../utils/validate');
const { applyMovement } = require('../services/stock');
const { requirePerm } = require('../utils/auth');

const statusOf = (p) => (p.stock <= 0 ? 'out' : p.stock <= p.min_stock ? 'low' : 'ok');
const withStatus = (p) => ({ ...p, status: statusOf(p) });

const SELECT = `
  SELECT p.*, c.name AS category_name,
         (SELECT MAX(m.created_at) FROM stock_movements m WHERE m.product_id = p.id) AS last_movement_at
  FROM products p JOIN categories c ON c.id = p.category_id`;

function parse(body) {
  const sku = str(body.sku, { field: 'SKU', max: 50 });
  return {
    sku: sku ? sku.toUpperCase() : null,
    name: str(body.name, { field: 'Nama produk', required: true, max: 150 }),
    category_id: id(body.category_id, 'Kategori'),
    unit: str(body.unit, { field: 'Satuan', required: true, max: 30 }),
    buy_price: num(body.buy_price, { field: 'Harga beli', fallback: 0 }),
    sell_price: num(body.sell_price, { field: 'Harga jual', fallback: 0 }),
    min_stock: num(body.min_stock, { field: 'Stok minimum', fallback: 0 }),
    location: str(body.location, { field: 'Lokasi', max: 100 }),
  };
}

async function findProduct(conn, productId) {
  const [rows] = await conn.query(`${SELECT} WHERE p.id = ?`, [productId]);
  if (!rows[0]) throw httpError(404, 'Produk tidak ditemukan');
  return withStatus(rows[0]);
}

// GET /api/products?search=&category_id=&status=low|out|ok
router.get('/', asyncHandler(async (req, res) => {
  const where = [];
  const params = [];
  if (req.query.search) {
    where.push('(p.name LIKE ? OR p.sku LIKE ? OR p.location LIKE ?)');
    const q = `%${req.query.search}%`;
    params.push(q, q, q);
  }
  if (req.query.category_id) {
    where.push('p.category_id = ?');
    params.push(id(req.query.category_id, 'Kategori'));
  }
  if (req.query.status === 'out') where.push('p.stock <= 0');
  if (req.query.status === 'low') where.push('p.stock > 0 AND p.stock <= p.min_stock');
  if (req.query.status === 'ok') where.push('p.stock > p.min_stock');

  const sql = `${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.name`;
  const [rows] = await pool.query(sql, params);
  res.json(rows.map(withStatus));
}));

// GET /api/products/:id  -> detail + 20 riwayat stok terakhir
router.get('/:id', asyncHandler(async (req, res) => {
  const productId = id(req.params.id);
  const product = await findProduct(pool, productId);
  const [movements] = await pool.query(
    'SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC, id DESC LIMIT 20',
    [productId]
  );
  res.json({ ...product, movements });
}));

// POST /api/products  -> stok awal dicatat sebagai transaksi "Stok awal"
router.post('/', requirePerm('product.write'), asyncHandler(async (req, res) => {
  const data = parse(req.body);
  const initialStock = num(req.body.initial_stock, { field: 'Stok awal', fallback: 0 });

  const product = await withTransaction(async (conn) => {
    const tempSku = data.sku || `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [r] = await conn.query(
      `INSERT INTO products (sku, name, category_id, unit, buy_price, sell_price, min_stock, location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tempSku, data.name, data.category_id, data.unit, data.buy_price, data.sell_price, data.min_stock, data.location]
    );
    if (!data.sku) {
      await conn.query('UPDATE products SET sku = ? WHERE id = ?', [`SBK-${String(r.insertId).padStart(4, '0')}`, r.insertId]);
    }
    if (initialStock > 0) {
      await applyMovement(conn, { productId: r.insertId, type: 'IN', quantity: initialStock, note: 'Stok awal', userId: req.user.id });
    }
    return findProduct(conn, r.insertId);
  });

  res.status(201).json(product);
}));

// PUT /api/products/:id  -> stok TIDAK bisa diubah di sini (gunakan /movements atau /opname)
router.put('/:id', requirePerm('product.write'), asyncHandler(async (req, res) => {
  const productId = id(req.params.id);
  const data = parse(req.body);
  const [r] = await pool.query(
    `UPDATE products SET sku = COALESCE(?, sku), name = ?, category_id = ?, unit = ?, buy_price = ?,
       sell_price = ?, min_stock = ?, location = ? WHERE id = ?`,
    [data.sku, data.name, data.category_id, data.unit, data.buy_price, data.sell_price, data.min_stock, data.location, productId]
  );
  if (!r.affectedRows) throw httpError(404, 'Produk tidak ditemukan');
  res.json(await findProduct(pool, productId));
}));

router.delete('/:id', requirePerm('product.delete'), asyncHandler(async (req, res) => {
  const [r] = await pool.query('DELETE FROM products WHERE id = ?', [id(req.params.id)]);
  if (!r.affectedRows) throw httpError(404, 'Produk tidak ditemukan');
  res.json({ message: 'Produk berhasil dihapus' });
}));

module.exports = router;
