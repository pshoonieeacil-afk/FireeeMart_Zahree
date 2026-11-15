/**
 * Hak akses per peran. Disalin juga di frontend (lib/permissions.js) untuk
 * menyembunyikan menu/tombol — tetapi backend inilah yang menegakkannya.
 */
const PERMISSIONS = {
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

const can = (user, perm) => !!user && (PERMISSIONS[perm] || []).includes(user.role);

module.exports = { PERMISSIONS, can };
