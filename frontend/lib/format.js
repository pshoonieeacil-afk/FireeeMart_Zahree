const rupiahFmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

export const rupiah = (n) => rupiahFmt.format(Number(n) || 0);
export const num = (n) => numFmt.format(Number(n) || 0);
export const round2 = (n) => Math.round(Number(n) * 100) / 100;

/** "Rp 1,2 jt" untuk angka besar di kartu statistik */
export function rupiahShort(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e9) return `Rp ${numFmt.format(round2(v / 1e9))} M`;
  if (Math.abs(v) >= 1e6) return `Rp ${numFmt.format(round2(v / 1e6))} jt`;
  return rupiah(v);
}

export const parseDate = (s) => (s ? new Date(String(s).replace(' ', 'T')) : null);

export const dateTime = (s) =>
  parseDate(s)?.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) ?? '-';

export const dateOnly = (s) =>
  parseDate(s)?.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) ?? '-';

export function timeAgo(s) {
  const d = parseDate(s);
  if (!d) return '-';
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'baru saja';
  if (sec < 3600) return `${Math.floor(sec / 60)} menit lalu`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} jam lalu`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)} hari lalu`;
  return dateOnly(s);
}

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function stockStatus(p) {
  if (Number(p.stock) <= 0) return 'out';
  if (Number(p.stock) <= Number(p.min_stock)) return 'low';
  return 'ok';
}

export const STATUS_META = {
  ok: { label: 'Aman', badge: 'badge-green', color: '#22c55e' },
  low: { label: 'Menipis', badge: 'badge-amber', color: '#f59e0b' },
  out: { label: 'Habis', badge: 'badge-red', color: '#ef4444' },
};

export const MOVEMENT_META = {
  IN: { label: 'Masuk', badge: 'badge-green', cls: 'in' },
  OUT: { label: 'Keluar', badge: 'badge-amber', cls: 'out' },
  ADJUST: { label: 'Penyesuaian', badge: 'badge-blue', cls: 'adjust' },
};

/** Jumlah bertanda: +10 untuk masuk, −5 untuk keluar */
export function signedQty(m) {
  const q = Number(m.quantity);
  if (m.type === 'IN') return `+${num(q)}`;
  if (m.type === 'OUT') return `−${num(q)}`;
  return q > 0 ? `+${num(q)}` : q < 0 ? `−${num(Math.abs(q))}` : '0';
}

export const UNITS = ['kg', 'gram', 'liter', 'pcs', 'pak', 'sak', 'karung', 'dus', 'renceng', 'botol', 'pouch', 'kaleng', 'kotak', 'butir', 'ikat'];

export const initials = (name = '') =>
  name.replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';

/** Nilai default input datetime-local = sekarang */
export function nowLocalInput() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const CASH_META = {
  IN: { label: 'Pemasukan', badge: 'badge-green', sign: '+' },
  OUT: { label: 'Pengeluaran', badge: 'badge-red', sign: '−' },
};
