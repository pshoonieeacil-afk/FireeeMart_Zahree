/** Salinan aturan akses dari backend (backend/src/utils/permissions.js) — untuk menyembunyikan menu & tombol. */
export const PERMISSIONS = {
  'product.write': ['owner', 'gudang'],
  'product.delete': ['owner'],
  'category.write': ['owner', 'gudang'],
  'category.delete': ['owner'],
  'stock.in': ['owner', 'gudang'],
  'stock.out': ['owner', 'kasir', 'gudang'],
  opname: ['owner', 'gudang'],
  'cash.view': ['owner', 'kasir'],
  'cash.write': ['owner', 'kasir'],
  users: ['owner'],
};

export const can = (user, perm) => !!user && (PERMISSIONS[perm] || []).includes(user.role);

export const ROLE_META = {
  owner: { label: 'Owner', badge: 'badge-purple', tone: 'tone-purple', desc: 'Akses penuh ke semua menu, laporan kas, dan kelola pengguna.' },
  kasir: { label: 'Kasir', badge: 'badge-blue', tone: 'tone-blue', desc: 'Mencatat penjualan (stok keluar) dan transaksi kas harian.' },
  gudang: { label: 'Gudang', badge: 'badge-amber', tone: 'tone-amber', desc: 'Barang masuk & keluar, data produk, kategori, dan stock opname.' },
};
