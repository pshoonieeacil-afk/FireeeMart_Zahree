/**
 * Data contoh FireeeMart. Stok & kas tidak di-insert langsung, melainkan lewat
 * service yang sama dengan aplikasi (applyMovement, createCash, createOpname),
 * sehingga kartu stok, buku kas, dan saldo selalu konsisten.
 */
const bcrypt = require('bcryptjs');
const { withTransaction } = require('../utils/http');
const { applyMovement } = require('../services/stock');
const { createOpname } = require('../services/opname');
const { createCash, reverseCash } = require('../services/cash');

const DEMO_USERS = [
  { name: 'Fira (Pemilik)', username: 'owner', password: 'owner123', role: 'owner' },
  { name: 'Rina Kasir', username: 'kasir', password: 'kasir123', role: 'kasir' },
  { name: 'Budi Gudang', username: 'gudang', password: 'gudang123', role: 'gudang' },
];

const categories = [
  ['Beras', 'Beras premium, medium, dan curah'],
  ['Minyak Goreng', 'Minyak goreng kemasan dan curah'],
  ['Gula & Garam', 'Gula pasir, gula merah, garam dapur'],
  ['Kopi', 'Kopi bubuk dan kopi sachet'],
  ['Teh', 'Teh celup dan teh tubruk'],
  ['Tepung', 'Tepung terigu, beras, dan tapioka'],
  ['Telur', 'Telur ayam ras dan telur bebek'],
  ['Mi Instan', 'Mi instan kuah dan goreng'],
  ['Susu', 'Susu kental manis dan susu bubuk'],
  ['Bumbu Dapur', 'Bawang, cabai, dan bumbu pokok'],
];

// [sku, nama, kategori, satuan, harga beli, harga jual, stok minimum, lokasi, stok awal]
const products = [
  ['BRS-001', 'Beras Premium 5 kg', 'Beras', 'sak', 72000, 78000, 10, 'Gudang A-1', 40],
  ['BRS-002', 'Beras Medium Curah', 'Beras', 'kg', 12500, 14000, 50, 'Gudang A-2', 150],
  ['MYK-001', 'Minyak Goreng Pouch 2 L', 'Minyak Goreng', 'pouch', 33000, 36500, 10, 'Rak B-1', 30],
  ['MYK-002', 'Minyak Goreng Curah', 'Minyak Goreng', 'liter', 15000, 17000, 20, 'Gudang B-2', 60],
  ['MYK-003', 'Minyak Goreng Botol 1 L', 'Minyak Goreng', 'botol', 15500, 17500, 12, 'Rak B-1', 48],
  ['GLA-001', 'Gula Pasir 1 kg', 'Gula & Garam', 'pak', 16500, 18500, 20, 'Rak C-1', 30],
  ['GLA-002', 'Garam Dapur Halus 250 g', 'Gula & Garam', 'pak', 2500, 3500, 15, 'Rak C-2', 50],
  ['KOP-001', 'Kopi Bubuk Robusta 165 g', 'Kopi', 'pak', 12000, 14500, 8, 'Rak D-1', 24],
  ['KOP-002', 'Kopi Sachet 3in1 (renceng isi 10)', 'Kopi', 'renceng', 13000, 15000, 10, 'Rak D-1', 15],
  ['TEH-001', 'Teh Celup Isi 25', 'Teh', 'kotak', 6500, 8000, 10, 'Rak D-2', 30],
  ['TEH-002', 'Teh Tubruk Melati 40 g', 'Teh', 'pak', 4000, 5000, 10, 'Rak D-2', 40],
  ['TPG-001', 'Tepung Terigu Serbaguna 1 kg', 'Tepung', 'pak', 11000, 13000, 10, 'Rak C-3', 35],
  ['TLR-001', 'Telur Ayam Ras', 'Telur', 'kg', 27000, 30000, 15, 'Rak E-1', 30],
  ['MIE-001', 'Mi Instan Goreng (dus isi 40)', 'Mi Instan', 'dus', 115000, 125000, 5, 'Gudang A-3', 12],
  ['SSU-001', 'Susu Kental Manis 370 g', 'Susu', 'kaleng', 11500, 13000, 10, 'Rak D-3', 36],
  ['BMB-001', 'Bawang Merah', 'Bumbu Dapur', 'kg', 35000, 42000, 5, 'Rak E-2', 15],
];

// Linimasa beberapa hari terakhir.
//  stock : [hari lalu, jam, 'stock', sku, IN|OUT, jumlah, catatan, referensi]  -> penjualan/pembelian otomatis masuk kas
//  cash  : [hari lalu, jam, 'cash', IN|OUT, kategori, nominal, keterangan, user]
//  undo  : [hari lalu, jam, 'undo', alasan]  -> membatalkan transaksi kas terakhir
const timeline = [
  [10, 7, 'cash', 'IN', 'Modal', 5000000, 'Modal kerja awal toko', 'owner'],
  [6, 9, 'stock', 'BRS-002', 'OUT', 25, 'Penjualan harian'],
  [6, 11, 'stock', 'GLA-001', 'OUT', 8, 'Penjualan harian'],
  [6, 14, 'stock', 'KOP-002', 'OUT', 5, 'Penjualan harian'],
  [6, 16, 'stock', 'MYK-003', 'OUT', 6, 'Penjualan grosir', 'NJ-0611'],
  [5, 8, 'stock', 'TLR-001', 'OUT', 8, 'Penjualan harian'],
  [5, 10, 'stock', 'BRS-002', 'IN', 50, 'Pembelian dari supplier', 'PO-0101'],
  [5, 12, 'cash', 'OUT', 'Listrik & Air', 350000, 'Token listrik bulan ini', 'owner'],
  [5, 13, 'stock', 'MIE-001', 'OUT', 3, 'Penjualan harian'],
  [5, 15, 'stock', 'GLA-001', 'OUT', 6, 'Penjualan harian'],
  [4, 9, 'stock', 'KOP-002', 'OUT', 6, 'Penjualan harian'],
  [4, 10, 'stock', 'BRS-001', 'OUT', 7, 'Penjualan grosir', 'NJ-0612'],
  [4, 13, 'stock', 'TEH-001', 'OUT', 5, 'Penjualan harian'],
  [4, 16, 'stock', 'MYK-002', 'OUT', 12, 'Penjualan harian'],
  [3, 17, 'opname'],
  [2, 9, 'stock', 'GLA-001', 'OUT', 8, 'Penjualan harian'],
  [2, 10, 'stock', 'KOP-002', 'OUT', 4, 'Penjualan harian'],
  [2, 11, 'stock', 'TLR-001', 'IN', 20, 'Pembelian dari peternak', 'PO-0102'],
  [2, 12, 'cash', 'OUT', 'Operasional', 150000, 'Beli kantong plastik', 'kasir'],
  [2, 12, 'undo', 'Salah input nominal, seharusnya 85.000'],
  [2, 13, 'cash', 'OUT', 'Operasional', 85000, 'Beli kantong plastik', 'kasir'],
  [2, 14, 'stock', 'MIE-001', 'OUT', 4, 'Penjualan harian'],
  [2, 15, 'stock', 'SSU-001', 'OUT', 6, 'Penjualan harian'],
  [1, 9, 'stock', 'BRS-002', 'OUT', 30, 'Penjualan grosir', 'NJ-0613'],
  [1, 11, 'stock', 'MYK-001', 'OUT', 5, 'Penjualan harian'],
  [1, 12, 'cash', 'OUT', 'Transportasi', 60000, 'Ongkos angkut beras', 'owner'],
  [1, 13, 'stock', 'TLR-001', 'OUT', 10, 'Penjualan harian'],
  [1, 16, 'stock', 'BMB-001', 'OUT', 4, 'Penjualan harian'],
  [0, 0, 'stock', 'BRS-002', 'OUT', 12, 'Penjualan harian'],
  [0, 0, 'stock', 'MYK-002', 'IN', 20, 'Pembelian dari supplier', 'PO-0103'],
  [0, 0, 'stock', 'TEH-002', 'OUT', 6, 'Penjualan harian'],
];

const opname = {
  note: 'Opname mingguan rak & gudang',
  items: [['BRS-001', 0], ['BRS-002', -2], ['MYK-002', 0], ['GLA-001', 0], ['KOP-001', 0], ['TEH-001', 0], ['TLR-001', -1], ['MIE-001', 0]],
};

const p2 = (n) => String(n).padStart(2, '0');
function ts(daysAgo, hour, minuteOffset = 0) {
  const d = new Date();
  if (daysAgo > 0) {
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, minuteOffset % 60, 0, 0);
  } else {
    d.setMinutes(d.getMinutes() - minuteOffset);
  }
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

async function seed() {
  await withTransaction(async (conn) => {
    const userIds = {};
    for (const u of DEMO_USERS) {
      const [r] = await conn.query('INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)', [
        u.name, u.username, await bcrypt.hash(u.password, 10), u.role,
      ]);
      userIds[u.username] = r.insertId;
    }

    const catIds = {};
    for (const [name, description] of categories) {
      const [r] = await conn.query('INSERT INTO categories (name, description) VALUES (?, ?)', [name, description]);
      catIds[name] = r.insertId;
    }

    const productIds = {};
    const prices = {};
    for (const [sku, name, cat, unit, buy, sell, min, location, initial] of products) {
      const created = ts(10, 8);
      const [r] = await conn.query(
        `INSERT INTO products (sku, name, category_id, unit, buy_price, sell_price, min_stock, location, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [sku, name, catIds[cat], unit, buy, sell, min, location, created]
      );
      productIds[sku] = r.insertId;
      prices[sku] = { buy, sell };
      await applyMovement(conn, {
        productId: r.insertId, type: 'IN', quantity: initial, note: 'Stok awal', userId: userIds.gudang, createdAt: created,
      });
    }

    let lastCash = null;
    for (let i = 0; i < timeline.length; i += 1) {
      const [daysAgo, hour, kind, ...rest] = timeline[i];
      const at = ts(daysAgo, hour, daysAgo === 0 ? (timeline.length - i) * 25 : i * 7);

      if (kind === 'stock') {
        const [sku, type, quantity, note, reference = null] = rest;
        const userId = type === 'OUT' ? userIds.kasir : userIds.gudang;
        const mv = await applyMovement(conn, { productId: productIds[sku], type, quantity, note, reference, userId, createdAt: at });
        const isSale = type === 'OUT';
        const unitPrice = isSale ? prices[sku].sell : prices[sku].buy;
        await createCash(conn, {
          type: isSale ? 'IN' : 'OUT',
          category: isSale ? 'Penjualan' : 'Pembelian Stok',
          amount: quantity * unitPrice,
          description: `${isSale ? 'Penjualan' : 'Pembelian'} ${mv.product_name} ${quantity} ${mv.unit}`,
          reference,
          transactionDate: at,
          stockMovementId: mv.id,
          userId: isSale ? userIds.kasir : userIds.owner,
        });
      } else if (kind === 'cash') {
        const [type, category, amount, description, user] = rest;
        lastCash = await createCash(conn, { type, category, amount, description, transactionDate: at, userId: userIds[user] });
      } else if (kind === 'undo') {
        await reverseCash(conn, { id: lastCash.id, reason: rest[0], userId: userIds.owner, transactionDate: at });
      } else if (kind === 'opname') {
        const items = [];
        for (const [sku, delta] of opname.items) {
          const [[row]] = await conn.query('SELECT stock FROM products WHERE id = ?', [productIds[sku]]);
          items.push({ product_id: productIds[sku], physical_stock: row.stock + delta });
        }
        await createOpname(conn, { note: opname.note, items, userId: userIds.gudang, createdAt: at });
      }
    }
  });
}

module.exports = { seed, DEMO_USERS };
