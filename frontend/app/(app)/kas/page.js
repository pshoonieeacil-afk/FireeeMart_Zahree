'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownLeft, ArrowUpRight, Ban, Loader2, Lock, Package, PieChart, Plus, Scale, Search, Undo2, Wallet, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { CASH_META, dateTime, num, rupiah, rupiahShort, todayISO } from '@/lib/format';
import { EmptyState, ErrorState, Guard, PageHeader, TableSkeleton } from '@/components/ui';
import { CountUp, EASE, MotionRow, Stagger, StaggerItem } from '@/components/motion';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import CashModal from '@/components/CashModal';
import Modal from '@/components/Modal';

const p2 = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

function periodRange(key) {
  const now = new Date();
  if (key === 'today') return { from: todayISO(), to: todayISO() };
  if (key === '7d') { const d = new Date(); d.setDate(d.getDate() - 6); return { from: iso(d), to: todayISO() }; }
  if (key === 'month') return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: todayISO() };
  if (key === 'lastmonth') return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) };
  return { from: '', to: '' };
}

const PERIODS = [['today', 'Hari ini'], ['7d', '7 hari'], ['month', 'Bulan ini'], ['lastmonth', 'Bulan lalu'], ['all', 'Semua'], ['custom', 'Pilih tanggal']];

function SummaryStat({ icon: Icon, tone, label, value, hint, featured }) {
  return (
    <StaggerItem>
      <div className={`card stat ${featured ? 'featured' : ''}`}>
        <div className={`stat-icon ${tone}`}><Icon size={21} /></div>
        <div style={{ minWidth: 0, position: 'relative', zIndex: 1 }}>
          <div className="stat-label">{label}</div>
          <div className="stat-value nums"><CountUp value={value} format={rupiahShort} /></div>
          {hint && <div className="stat-hint">{hint}</div>}
        </div>
      </div>
    </StaggerItem>
  );
}

function CategoryBars({ title, rows, total, color }) {
  return (
    <div style={{ flex: 1, minWidth: 220 }}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <strong style={{ fontSize: 13 }}>{title}</strong>
        <span className="muted nums" style={{ fontSize: 12.5 }}>{rupiah(total)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="muted" style={{ fontSize: 12.5 }}>Belum ada transaksi.</p>
      ) : (
        rows.map((r, i) => (
          <div className="cat-bar" key={r.category}>
            <div className="row between">
              <span>{r.category} <span className="muted">· {r.count}x</span></span>
              <span className="nums strong">{rupiah(r.total)}</span>
            </div>
            <div className="progress">
              <motion.span initial={{ width: 0 }} animate={{ width: `${total ? (r.total / total) * 100 : 0}%` }} transition={{ duration: 0.8, ease: EASE, delay: 0.1 + i * 0.06 }} style={{ background: color }} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function KasPage() {
  return (
    <Guard perm="cash.view">
      <KasContent />
    </Guard>
  );
}

function KasContent() {
  const toast = useToast();
  const { can } = useAuth();
  const canWrite = can('cash.write');

  const [period, setPeriod] = useState('month');
  const [custom, setCustom] = useState({ from: todayISO(), to: todayISO() });
  const [filters, setFilters] = useState({ type: '', category: '', search: '' });
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState(null);
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [reversing, setReversing] = useState(null);
  const [reason, setReason] = useState('');
  const [reverseLoading, setReverseLoading] = useState(false);

  const range = useMemo(() => (period === 'custom' ? custom : periodRange(period)), [period, custom]);

  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, search })), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { api('/cash/categories').then(setCategories).catch(() => {}); }, []);

  const load = useCallback(async () => {
    try {
      setError('');
      const r = new URLSearchParams();
      if (range.from) r.set('from', range.from);
      if (range.to) r.set('to', range.to);
      const l = new URLSearchParams(r);
      Object.entries(filters).forEach(([k, v]) => v && l.set(k, v));
      const [s, list] = await Promise.all([api(`/cash/summary?${r}`), api(`/cash?${l}`)]);
      setSummary(s);
      setRows(list);
    } catch (e) {
      setError(e.message);
    }
  }, [range, filters]);

  useEffect(() => { load(); }, [load]);

  const byType = useMemo(() => {
    const res = { IN: [], OUT: [] };
    (summary?.by_category || []).forEach((c) => res[c.type].push(c));
    return res;
  }, [summary]);

  async function confirmReverse() {
    if (!reason.trim()) return toast.error('Isi alasan pembatalan');
    setReverseLoading(true);
    try {
      await api(`/cash/${reversing.id}/reverse`, { method: 'POST', body: { reason } });
      toast.success('Transaksi dibatalkan dan tercatat sebagai koreksi');
      setReversing(null);
      setReason('');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setReverseLoading(false);
    }
  }

  const allCategories = categories ? [...categories.IN, ...categories.OUT] : [];

  return (
    <>
      <PageHeader
        title="Kas"
        description="Buku kas toko: pemasukan dan pengeluaran. Penjualan & pembelian stok tercatat otomatis dari menu Stok."
        actions={
          canWrite && (
            <>
              <button className="btn btn-secondary" onClick={() => setModal('OUT')}><ArrowUpRight size={17} className="text-red" /> Pengeluaran</button>
              <button className="btn btn-primary" onClick={() => setModal('IN')}><Plus size={17} /> Pemasukan</button>
            </>
          )
        }
      />

      <div className="chips" role="tablist" aria-label="Periode">
        {PERIODS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={period === k} className={`chip ${period === k ? 'active' : ''}`} onClick={() => setPeriod(k)}>
            {period === k && <motion.span layoutId="period-chip" className="chip-bg" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            <span>{l}</span>
          </button>
        ))}
        {period === 'custom' && (
          <div className="row" style={{ gap: 6 }}>
            <input type="date" className="input input-sm" style={{ height: 34, width: 'auto' }} value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} aria-label="Dari tanggal" />
            <span className="muted">s/d</span>
            <input type="date" className="input input-sm" style={{ height: 34, width: 'auto' }} value={custom.to} min={custom.from} max={todayISO()} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} aria-label="Sampai tanggal" />
          </div>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !summary ? (
        <div className="stats">{[0, 1, 2, 3].map((i) => <div key={i} className="card skeleton" style={{ height: 100 }} />)}</div>
      ) : (
        <>
          <Stagger className="stats" key={`${range.from}-${range.to}`}>
            <SummaryStat featured icon={Wallet} tone="" label="Saldo Kas Saat Ini" value={summary.balance} hint="Seluruh transaksi" />
            <SummaryStat icon={ArrowDownLeft} tone="tone-green" label="Pemasukan" value={summary.total_in} hint="Periode terpilih" />
            <SummaryStat icon={ArrowUpRight} tone="tone-red" label="Pengeluaran" value={summary.total_out} hint="Periode terpilih" />
            <SummaryStat icon={Scale} tone={summary.net >= 0 ? 'tone-purple' : 'tone-red'} label={summary.net >= 0 ? 'Surplus Kas' : 'Defisit Kas'} value={summary.net} hint={`${summary.count} transaksi`} />
          </Stagger>

          <div className="grid-2">
            <div className="card">
              <div className="card-header"><div><h3><PieChart size={17} className="text-purple" /> Komposisi per Kategori</h3><p>Ke mana uang masuk dan keluar pada periode ini</p></div></div>
              <div className="card-body row wrap" style={{ alignItems: 'flex-start', gap: 28 }}>
                <CategoryBars title="Pemasukan" rows={byType.IN} total={summary.total_in} color="linear-gradient(90deg,#d9a3f5,#8e44c4)" />
                <CategoryBars title="Pengeluaran" rows={byType.OUT} total={summary.total_out} color="linear-gradient(90deg,#c2416a,#5c0f21)" />
              </div>
            </div>
            <div className="card">
              <div className="card-header"><div><h3><Wallet size={17} className="text-purple" /> Ringkasan Periode</h3><p>{range.from ? `${range.from} s/d ${range.to}` : 'Semua waktu'}</p></div></div>
              <div className="card-body">
                <div className="kv"><span>Saldo awal</span><strong className="nums">{rupiah(summary.opening_balance)}</strong></div>
                <div className="kv"><span>+ Pemasukan</span><strong className="nums text-green">{rupiah(summary.total_in)}</strong></div>
                <div className="kv"><span>− Pengeluaran</span><strong className="nums text-red">{rupiah(summary.total_out)}</strong></div>
                <div className="kv total"><span>Saldo akhir periode</span><strong className="nums">{rupiah(summary.closing_balance)}</strong></div>
                <p className="hint mt-4">Transaksi yang dibatalkan beserta koreksinya tidak dihitung dalam ringkasan.</p>
              </div>
            </div>
          </div>
        </>
      )}

      {!error && (
        <div className="card">
          <div className="toolbar">
            <div className="segmented" role="tablist" aria-label="Jenis">
              {[['', 'Semua'], ['IN', 'Pemasukan'], ['OUT', 'Pengeluaran']].map(([v, l]) => (
                <button key={v} className={filters.type === v ? 'active' : ''} onClick={() => setFilters((f) => ({ ...f, type: v }))}>
                  {filters.type === v && <motion.span layoutId="cash-type" className="seg-bg" />}
                  <span>{l}</span>
                </button>
              ))}
            </div>
            <div className="input-icon grow">
              <Search size={16} />
              <input className="input" placeholder="Cari keterangan atau no. bukti…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Cari transaksi kas" />
            </div>
            <select className="select" value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} aria-label="Filter kategori">
              <option value="">Semua kategori</option>
              {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {(filters.type || filters.category || search) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setFilters({ type: '', category: '', search: '' }); setSearch(''); }}><X size={14} /> Reset</button>
            )}
          </div>

          {!rows ? (
            <TableSkeleton cols={6} />
          ) : rows.length === 0 ? (
            <EmptyState icon={Wallet} title="Belum ada transaksi kas" description="Transaksi pada periode & filter ini akan muncul di sini." />
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Keterangan</th>
                      <th>Tanggal</th>
                      <th>Kategori</th>
                      <th className="text-right">Nominal</th>
                      <th>Dicatat oleh</th>
                      <th className="text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c, i) => {
                      const meta = CASH_META[c.type];
                      const reversed = !!c.reversed_by_id;
                      const isCorrection = !!c.reversal_of;
                      return (
                        <MotionRow key={c.id} index={i} className={reversed || isCorrection ? 'row-faded' : ''}>
                          <td>
                            <div className="cell-title">{c.description || c.category}</div>
                            <div className="cell-sub row" style={{ gap: 6, flexWrap: 'wrap' }}>
                              <span className="mono">#{c.id}</span>
                              {c.reference && <span className="mono">· {c.reference}</span>}
                              {c.product_name && <span className="badge badge-purple"><Package size={11} /> dari stok</span>}
                              {reversed && <span className="badge badge-gray"><Ban size={11} /> Dibatalkan</span>}
                              {isCorrection && <span className="badge badge-gray"><Undo2 size={11} /> Koreksi #{c.reversal_of}</span>}
                            </div>
                          </td>
                          <td className="nums" style={{ whiteSpace: 'nowrap' }}>{dateTime(c.transaction_date)}</td>
                          <td><span className={`badge ${meta.badge}`}>{c.category}</span></td>
                          <td className={`text-right nums strong ${c.type === 'IN' ? 'text-green' : 'text-red'} ${reversed ? 'strike' : ''}`}>
                            {meta.sign}{rupiah(c.amount)}
                          </td>
                          <td className="muted">{c.created_by_name || '-'}</td>
                          <td className="text-right">
                            {canWrite && !reversed && !isCorrection ? (
                              <button className="btn btn-ghost btn-sm" onClick={() => { setReversing(c); setReason(''); }}><Undo2 size={14} /> Batalkan</button>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                        </MotionRow>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="table-foot row between wrap">
                <span>Menampilkan {num(rows.length)} transaksi</span>
                <span className="row" style={{ gap: 6 }}><Lock size={13} /> Transaksi kas tidak bisa diedit/dihapus — gunakan Batalkan untuk koreksi.</span>
              </div>
            </>
          )}
        </div>
      )}

      <CashModal open={!!modal} defaultType={modal || 'IN'} categories={categories} balance={summary?.balance} onClose={() => setModal(null)} onSaved={load} />

      <Modal
        open={!!reversing}
        onClose={reverseLoading ? undefined : () => setReversing(null)}
        title="Batalkan transaksi kas?"
        subtitle="Data asli tetap tersimpan; sistem membuat transaksi koreksi kebalikannya."
        width={460}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setReversing(null)} disabled={reverseLoading}>Tutup</button>
            <button className="btn btn-danger" onClick={confirmReverse} disabled={reverseLoading || !reason.trim()}>
              {reverseLoading && <Loader2 size={16} className="spin" />} Batalkan Transaksi
            </button>
          </>
        }
      >
        {reversing && (
          <>
            <div className="product-pill">
              <div className={`stat-icon ${reversing.type === 'IN' ? 'tone-green' : 'tone-red'}`} style={{ width: 38, height: 38 }}>
                {reversing.type === 'IN' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
              </div>
              <div style={{ flex: 1 }}>
                <div className="cell-title">{reversing.description || reversing.category}</div>
                <div className="cell-sub">{reversing.category} · {dateTime(reversing.transaction_date)}</div>
              </div>
              <strong className={`nums ${reversing.type === 'IN' ? 'text-green' : 'text-red'}`}>{CASH_META[reversing.type].sign}{rupiah(reversing.amount)}</strong>
            </div>
            {reversing.product_name && (
              <div className="alert alert-warning">Transaksi ini berasal dari stok ({reversing.product_name}). Membatalkan kas <strong>tidak</strong> mengembalikan stok — koreksi stok lewat transaksi stok kebalikan bila perlu.</div>
            )}
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="rv-reason">Alasan pembatalan <span className="req">*</span></label>
              <input id="rv-reason" className="input" placeholder="Mis. salah input nominal" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} autoFocus />
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
