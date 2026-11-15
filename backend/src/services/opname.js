const { httpError } = require('../utils/http');
const { num, id: parseId, str, round2 } = require('../utils/validate');
const { applyMovement } = require('./stock');

const pad = (n, len = 2) => String(n).padStart(len, '0');

function datePart(createdAt) {
  if (createdAt) return createdAt.slice(0, 10).replace(/-/g, '');
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/**
 * Simpan hasil stock opname. Untuk setiap produk yang dihitung:
 *  - catat stok sistem vs stok fisik
 *  - jika ada selisih, stok disesuaikan ke stok fisik via movement ADJUST
 */
async function createOpname(conn, { note, items, userId = null, createdAt = null }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw httpError(400, 'Isi hitungan fisik minimal untuk satu produk');
  }

  // Validasi & hilangkan duplikat (entri terakhir yang dipakai)
  const byProduct = new Map();
  for (const item of items) {
    const productId = parseId(item.product_id, 'Produk');
    const physical = num(item.physical_stock, { field: 'Stok fisik', required: true, min: 0 });
    byProduct.set(productId, physical);
  }
  // Urutkan berdasarkan id agar urutan penguncian baris konsisten (hindari deadlock)
  const entries = [...byProduct.entries()].sort((a, b) => a[0] - b[0]);

  const prefix = `SO-${datePart(createdAt)}-`;
  const [[{ total }]] = await conn.query('SELECT COUNT(*) AS total FROM stock_opnames WHERE code LIKE ?', [`${prefix}%`]);
  const code = `${prefix}${pad(total + 1, 3)}`;

  const [result] = await conn.query(
    'INSERT INTO stock_opnames (code, note, total_items, created_by, created_at) VALUES (?, ?, ?, ?, COALESCE(?, NOW()))',
    [code, str(note, { field: 'Catatan' }), entries.length, userId, createdAt]
  );
  const opnameId = result.insertId;

  let matched = 0;
  for (const [productId, physical] of entries) {
    const [rows] = await conn.query('SELECT stock FROM products WHERE id = ? FOR UPDATE', [productId]);
    if (!rows[0]) throw httpError(404, `Produk dengan ID ${productId} tidak ditemukan`);
    const system = round2(rows[0].stock);
    const diff = round2(physical - system);

    await conn.query(
      'INSERT INTO stock_opname_items (opname_id, product_id, system_stock, physical_stock, difference) VALUES (?, ?, ?, ?, ?)',
      [opnameId, productId, system, physical, diff]
    );

    if (diff === 0) {
      matched += 1;
    } else {
      await applyMovement(conn, {
        productId,
        type: 'ADJUST',
        targetStock: physical,
        note: `Penyesuaian hasil stock opname (${diff > 0 ? '+' : ''}${diff})`,
        reference: code,
        userId,
        createdAt,
      });
    }
  }

  await conn.query('UPDATE stock_opnames SET matched_items = ? WHERE id = ?', [matched, opnameId]);
  return { id: opnameId, code, total_items: entries.length, matched_items: matched };
}

module.exports = { createOpname };
