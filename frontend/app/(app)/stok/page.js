'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, History, Lock, Plus, Scale, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { MOVEMENT_META, dateTime, num, signedQty } from '@/lib/format';
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from '@/components/ui';
import StockModal from '@/components/StockModal';
import { useAuth } from '@/components/AuthProvider';
import { MotionRow } from '@/components/motion';
import { motion } from 'framer-motion';
import { rupiah } from '@/lib/format';

const MV_ICON = { IN: ArrowDownToLine, OUT: ArrowUpFromLine, ADJUST: Scale };
const TYPES = [['', 'Semua'], ['IN', 'Masuk'], ['OUT', 'Keluar'], ['ADJUST', 'Penyesuaian']];

export default function StokPage() {
  const { can } = useAuth();
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ type: '', product_id: '', from: '', to: '', search: '' });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modal, setModal] = useState(null); // 'IN' | 'OUT' | null

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  const loadProducts = useCallback(() => api('/products').then(setProducts).catch(() => {}), []);

  const loadMovements = useCallback(async () => {
    try {
      setError('');
      const params = new URLSearchParams();
      Object.entries({ ...filters, search: debouncedSearch }).forEach(([k, v]) => v && params.set(k, v));
      setMovements(await api(`/movements?${params}`));
    } catch (e) {
      setError(e.message);
    }
  }, [filters.type, filters.product_id, filters.from, filters.to, debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { loadMovements(); }, [loadMovements]);

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const hasFilter = filters.type || filters.product_id || filters.from || filters.to || filters.search;

  const summary = useMemo(() => {
    const s = { IN: 0, OUT: 0, ADJUST: 0 };
    (movements || []).forEach((m) => { s[m.type] += 1; });
    return s;
  }, [movements]);

  const selectedProduct = products.find((p) => String(p.id) === filters.product_id);

  return (
    <>
      <PageHeader
        title="Stok Masuk & Keluar"
        description="Kartu stok: semua perubahan stok tercatat lengkap dengan stok sebelum dan sesudah transaksi."
        actions={
          <>
            {can('stock.out') && <button className="btn btn-secondary" onClick={() => setModal('OUT')}><ArrowUpFromLine size={17} /> Stok Keluar</button>}
            {can('stock.in') && <button className="btn btn-primary" onClick={() => setModal('IN')}><ArrowDownToLine size={17} /> Stok Masuk</button>}
          </>
        }
      />

      <div className="summary-grid">
        <div><small>Total transaksi</small><strong className="nums">{movements ? movements.length : '–'}</strong></div>
        <div><small>Stok masuk</small><strong className="nums text-green">{summary.IN}</strong></div>
        <div><small>Stok keluar</small><strong className="nums text-amber">{summary.OUT}</strong></div>
        <div><small>Penyesuaian opname</small><strong className="nums text-blue">{summary.ADJUST}</strong></div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="segmented" role="tablist" aria-label="Jenis transaksi">
            {TYPES.map(([v, l]) => (
              <button key={v} role="tab" aria-selected={filters.type === v} className={filters.type === v ? 'active' : ''} onClick={() => setFilters((f) => ({ ...f, type: v }))}>
                {filters.type === v && <motion.span layoutId="mv-type" className="seg-bg" />}
                <span>{l}</span>
              </button>
            ))}
          </div>
          <div className="input-icon grow">
            <Search size={16} />
            <input className="input" placeholder="Cari produk, no. referensi, keterangan…" value={filters.search} onChange={set('search')} aria-label="Cari transaksi" />
          </div>
          <select className="select" value={filters.product_id} onChange={set('product_id')} aria-label="Filter produk">
            <option value="">Semua produk</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="date" className="input" style={{ width: 'auto' }} value={filters.from} onChange={set('from')} aria-label="Dari tanggal" />
          <span className="muted">s/d</span>
          <input type="date" className="input" style={{ width: 'auto' }} value={filters.to} onChange={set('to')} aria-label="Sampai tanggal" />
          {hasFilter && (
            <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ type: '', product_id: '', from: '', to: '', search: '' })}>
              <X size={14} /> Reset
            </button>
          )}
        </div>

        {selectedProduct && (
          <div className="alert alert-info" style={{ margin: '14px 16px 0' }}>
            <History size={16} />
            <span>
              Kartu stok <strong>{selectedProduct.name}</strong> — stok saat ini <strong>{num(selectedProduct.stock)} {selectedProduct.unit}</strong>.
            </span>
          </div>
        )}

        {error ? (
          <div style={{ padding: 16 }}><ErrorState message={error} onRetry={loadMovements} /></div>
        ) : !movements ? (
          <TableSkeleton cols={6} />
        ) : movements.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title={hasFilter ? 'Tidak ada transaksi yang cocok' : 'Belum ada transaksi stok'}
            description={hasFilter ? 'Coba ubah filter pencarian.' : 'Catat barang masuk dari supplier atau barang keluar karena penjualan.'}
            action={!hasFilter && can('stock.in') && <button className="btn btn-primary" onClick={() => setModal('IN')}><Plus size={16} /> Catat Stok Masuk</button>}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Produk</th>
                    <th>Jenis</th>
                    <th className="text-right">Jumlah</th>
                    <th className="text-right">Stok Sebelum → Sesudah</th>
                    <th>Keterangan</th>
                    <th>Oleh</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m, i) => {
                    const meta = MOVEMENT_META[m.type];
                    const Icon = MV_ICON[m.type];
                    return (
                      <MotionRow key={m.id} index={i}>
                        <td className="nums" style={{ whiteSpace: 'nowrap' }}>{dateTime(m.created_at)}</td>
                        <td>
                          <div className="cell-title">{m.product_name}</div>
                          <div className="cell-sub mono">{m.sku}</div>
                        </td>
                        <td><span className={`badge ${meta.badge}`}><Icon size={12} /> {meta.label}</span></td>
                        <td className={`text-right nums strong text-${m.type === 'IN' ? 'green' : m.type === 'OUT' ? 'amber' : 'blue'}`}>
                          {signedQty(m)} <span className="muted" style={{ fontWeight: 500 }}>{m.unit}</span>
                        </td>
                        <td className="text-right nums">
                          <span className="muted">{num(m.stock_before)}</span> → <strong>{num(m.stock_after)}</strong>
                        </td>
                        <td>
                          <div>{m.note || <span className="muted">-</span>}</div>
                          <div className="cell-sub row" style={{ gap: 6, flexWrap: 'wrap' }}>
                            {m.reference && <span className="mono">{m.reference}</span>}
                            {m.cash_id && (
                              <span className={`badge ${m.cash_type === 'IN' ? 'badge-green' : 'badge-red'}`} title="Tercatat di buku kas">
                                Kas {m.cash_type === 'IN' ? '+' : '−'}{rupiah(m.cash_amount)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="muted">{m.created_by_name || '-'}</td>
                      </MotionRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="table-foot row between wrap">
              <span>Menampilkan {movements.length} transaksi terbaru{movements.length >= 200 ? ' (maks. 200 — persempit dengan filter tanggal)' : ''}</span>
              <span className="row" style={{ gap: 6 }}><Lock size={13} /> Transaksi tidak bisa diedit/dihapus. Koreksi dengan transaksi kebalikan atau stock opname.</span>
            </div>
          </>
        )}
      </div>

      <StockModal
        open={!!modal}
        products={products}
        defaultType={modal || 'IN'}
        onClose={() => setModal(null)}
        onSaved={() => { loadMovements(); loadProducts(); }}
      />
    </>
  );
}
