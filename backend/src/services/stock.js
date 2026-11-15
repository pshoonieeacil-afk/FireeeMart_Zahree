const { httpError } = require('../utils/http');
const { round2 } = require('../utils/validate');

/**
 * Satu-satunya jalur untuk mengubah stok produk.
 *
 * - Baris produk dikunci (SELECT ... FOR UPDATE) sehingga dua transaksi
 *   bersamaan tidak saling menimpa jumlah stok.
 * - Stok keluar ditolak jika melebihi stok tersedia (stok tidak bisa minus).
 * - Setiap perubahan dicatat di stock_movements beserta stok sebelum/sesudah
 *   dan siapa yang mencatat.
 *
 * Harus dipanggil di dalam transaksi (lihat withTransaction).
 *
 * @param opts { productId, type: 'IN'|'OUT'|'ADJUST', quantity, targetStock, note, reference, userId, createdAt }
 *   - IN/OUT memakai `quantity` (> 0)
 *   - ADJUST memakai `targetStock` (stok fisik hasil hitung)
 */
async function applyMovement(conn, { productId, type, quantity, targetStock, note = null, reference = null, userId = null, createdAt = null }) {
  const [rows] = await conn.query('SELECT id, name, unit, stock FROM products WHERE id = ? FOR UPDATE', [productId]);
  const product = rows[0];
  if (!product) throw httpError(404, 'Produk tidak ditemukan');

  const before = round2(product.stock);
  let qty;
  let after;

  if (type === 'IN') {
    qty = round2(quantity);
    after = round2(before + qty);
  } else if (type === 'OUT') {
    qty = round2(quantity);
    if (qty > before) {
      throw httpError(400, `Stok ${product.name} tidak cukup. Tersedia ${before} ${product.unit}, diminta ${qty} ${product.unit}.`);
    }
    after = round2(before - qty);
  } else if (type === 'ADJUST') {
    after = round2(targetStock);
    if (after < 0) throw httpError(400, 'Stok fisik tidak boleh negatif');
    qty = round2(after - before);
  } else {
    throw httpError(400, 'Jenis transaksi tidak valid');
  }

  await conn.query('UPDATE products SET stock = ? WHERE id = ?', [after, productId]);
  const [result] = await conn.query(
    `INSERT INTO stock_movements (product_id, type, quantity, stock_before, stock_after, note, reference, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()))`,
    [productId, type, qty, before, after, note, reference, userId, createdAt]
  );

  return {
    id: result.insertId,
    product_id: productId,
    product_name: product.name,
    unit: product.unit,
    type,
    quantity: qty,
    stock_before: before,
    stock_after: after,
  };
}

module.exports = { applyMovement };
