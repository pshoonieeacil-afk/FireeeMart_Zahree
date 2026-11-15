'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ClipboardCheck, ClipboardList, Eye, History, Info, Loader2, RotateCcw, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { dateTime, num, round2, rupiah } from '@/lib/format';
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from '@/components/ui';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { motion } from 'framer-motion';
import { Guard } from '@/components/ui';
import { MotionRow } from '@/components/motion';

function DiffBadge({ diff, unit }) {
  if (diff === null) return <span className="muted">—</span>;
  if (diff === 0) return <span className="badge badge-green"><Check size={12} /> Sesuai</span>;
  return (
    <span className={`badge ${diff > 0 ? 'badge-blue' : 'badge-red'}`}>
      {diff > 0 ? 'Lebih' : 'Kurang'} {diff > 0 ? '+' : '−'}{num(Math.abs(diff))} {unit}
    </span>
  );
}

function OpnameDetailModal({ id, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!id) return;
    setData(null);
    setError('');
    api(`/opname/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  const accuracy = data?.total_items ? Math.round((data.matched_items / data.total_items) * 100) : 0;

  return (
    <Modal open={!!id} onClose={onClose} width={760} title={data ? `Detail Opname ${data.code}` : 'Detail Opname'} subtitle={data ? `${dateTime(data.created_at)}${data.note ? ` · ${data.note}` : ''}` : ''}>
      {error ? (
        <div className="alert alert-danger">{error}</div>
      ) : !data ? (
        <TableSkeleton rows={4} cols={4} />
      ) : (
        <>
          <div className="summary-grid">
            <div><small>Produk dihitung</small><strong>{data.total_items}</strong></div>
            <div><small>Sesuai</small><strong className="text-green">{data.matched_items}</strong></div>
            <div><small>Selisih</small><strong className="text-amber">{data.total_items - data.matched_items}</strong></div>
            <div><small>Akurasi</small><strong>{accuracy}%</strong></div>
          </div>
          <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 12 }}>
            <table className="table" style={{ minWidth: 600 }}>
              <thead>
                <tr><th>Produk</th><th className="text-right">Sistem</th><th className="text-right">Fisik</th><th>Selisih</th><th className="text-right">Nilai Selisih</th></tr>
              </thead>
              <tbody>
                {data.items.map((i) => (
                  <tr key={i.id}>
                    <td><div className="cell-title">{i.product_name}</div><div className="cell-sub mono">{i.sku}</div></td>
                    <td className="text-right nums">{num(i.system_stock)}</td>
                    <td className="text-right nums strong">{num(i.physical_stock)}</td>
                    <td><DiffBadge diff={i.difference} unit={i.unit} /></td>
                    <td className={`text-right nums ${i.difference < 0 ? 'text-red' : ''}`}>{i.difference ? rupiah(i.difference * i.buy_price) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

export default function OpnamePage() {
  return (
    <Guard perm="opname">
      <OpnameContent />
    </Guard>
  );
}

function OpnameContent() {
  const toast = useToast();
  const [tab, setTab] = useState('count');
  const [products, setProducts] = useState(null);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const [counts, setCounts] = useState({});
  const [search, setSearch] = useState('');
  const [onlyUncounted, setOnlyUncounted] = useState(false);
  const [note, setNote] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const [p, h] = await Promise.all([api('/products'), api('/opname')]);
      setProducts(p);
      setHistory(h);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    if (!products) return [];
    return products.map((p) => {
      const raw = counts[p.id];
      const counted = raw !== undefined && raw !== '';
      const physical = counted ? Number(raw) : null;
      return { ...p, counted, physical, diff: counted ? round2(physical - p.stock) : null };
    });
  }, [products, counts]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyUncounted && r.counted) return false;
      return !q || [r.name, r.sku, r.location, r.category_name].some((v) => v?.toLowerCase().includes(q));
    });
  }, [rows, search, onlyUncounted]);

  const counted = rows.filter((r) => r.counted);
  const invalid = counted.some((r) => !Number.isFinite(r.physical) || r.physical < 0);
  const mismatched = counted.filter((r) => r.diff !== 0);
  const lossValue = mismatched.reduce((s, r) => s + (r.diff < 0 ? -r.diff * r.buy_price : 0), 0);

  const setCount = (id, value) => setCounts((c) => ({ ...c, [id]: value }));
  const matchSystem = (r) => setCount(r.id, String(r.stock));

  async function save() {
    setSaving(true);
    try {
      const res = await api('/opname', {
        method: 'POST',
        body: { note, items: counted.map((r) => ({ product_id: r.id, physical_stock: r.physical })) },
      });
      toast.success(`Opname ${res.code} disimpan. ${res.total_items - res.matched_items} produk disesuaikan.`);
      setCounts({});
      setNote('');
      setConfirmOpen(false);
      await load();
      setTab('history');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Stock Opname"
        description="Hitung stok fisik di rak & gudang, bandingkan dengan catatan sistem, lalu sesuaikan otomatis. Lakukan rutin agar stok selalu akurat."
      />

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'count'} className={`tab ${tab === 'count' ? 'active' : ''}`} onClick={() => setTab('count')}>
          {tab === 'count' && <motion.span layoutId="op-tab" className="tab-line" />}
          <ClipboardList size={16} /> Hitung Stok Fisik
        </button>
        <button role="tab" aria-selected={tab === 'history'} className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          {tab === 'history' && <motion.span layoutId="op-tab" className="tab-line" />}
          <History size={16} /> Riwayat Opname {history ? `(${history.length})` : ''}
        </button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : tab === 'count' ? (
        <>
          <div className="alert alert-info">
            <Info size={16} />
            <span>
              Isi kolom <strong>Stok Fisik</strong> sesuai hasil hitung. Klik <Check size={13} style={{ verticalAlign: -2 }} /> jika jumlahnya sama dengan sistem.
              Produk yang tidak diisi tidak ikut opname. Selisih akan dicatat sebagai transaksi <em>Penyesuaian</em> di kartu stok.
            </span>
          </div>

          <div className="card">
            <div className="toolbar">
              <div className="input-icon grow">
                <Search size={16} />
                <input className="input" placeholder="Cari produk atau lokasi rak…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Cari produk" />
              </div>
              <label className="row" style={{ gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                <input type="checkbox" checked={onlyUncounted} onChange={(e) => setOnlyUncounted(e.target.checked)} /> Hanya yang belum dihitung
              </label>
            </div>

            {!products ? (
              <TableSkeleton cols={5} />
            ) : products.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="Belum ada produk" description="Tambahkan produk terlebih dahulu sebelum melakukan stock opname." />
            ) : visible.length === 0 ? (
              <EmptyState icon={Search} title="Tidak ada produk" description={onlyUncounted ? 'Semua produk sudah dihitung.' : 'Coba kata kunci lain.'} />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Produk</th>
                      <th>Lokasi</th>
                      <th className="text-right">Stok Sistem</th>
                      <th className="text-right">Stok Fisik</th>
                      <th>Selisih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <tr key={r.id} className={r.counted ? (r.diff === 0 ? 'row-match' : 'row-diff') : ''}>
                        <td>
                          <div className="cell-title">{r.name}</div>
                          <div className="cell-sub"><span className="mono">{r.sku}</span> · {r.category_name}</div>
                        </td>
                        <td className="muted">{r.location || '-'}</td>
                        <td className="text-right nums strong">{num(r.stock)} <span className="muted" style={{ fontWeight: 500 }}>{r.unit}</span></td>
                        <td className="text-right">
                          <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                            <input
                              className={`input opname-input nums ${r.counted ? (r.diff === 0 ? 'match' : 'diff') : ''}`}
                              type="number" min="0" step="any" inputMode="decimal" placeholder="—"
                              value={counts[r.id] ?? ''}
                              onChange={(e) => setCount(r.id, e.target.value)}
                              aria-label={`Stok fisik ${r.name}`}
                            />
                            <button className="icon-btn in" title="Sama dengan sistem" aria-label={`Tandai ${r.name} sesuai sistem`} onClick={() => matchSystem(r)}>
                              <Check size={16} />
                            </button>
                          </div>
                        </td>
                        <td><DiffBadge diff={r.diff} unit={r.unit} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {products && products.length > 0 && (
            <div className="opname-bar">
              <div className="ob-stat"><small>Dihitung</small><strong>{counted.length} / {products.length}</strong></div>
              <div className="ob-stat"><small>Sesuai</small><strong style={{ color: '#4ade80' }}>{counted.length - mismatched.length}</strong></div>
              <div className="ob-stat"><small>Selisih</small><strong style={{ color: '#fbbf24' }}>{mismatched.length}</strong></div>
              <div className="ob-stat"><small>Nilai kekurangan</small><strong style={{ color: lossValue ? '#fca5a5' : undefined }}>{rupiah(lossValue)}</strong></div>
              <div className="spacer" />
              <button className="btn btn-secondary" onClick={() => setCounts({})} disabled={!counted.length || saving}><RotateCcw size={16} /> Reset</button>
              <button className="btn btn-primary" onClick={() => setConfirmOpen(true)} disabled={!counted.length || invalid || saving}>
                <ClipboardCheck size={16} /> Simpan Opname
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="card">
          {!history ? (
            <TableSkeleton cols={5} />
          ) : history.length === 0 ? (
            <EmptyState icon={History} title="Belum ada riwayat opname" description="Hasil stock opname yang disimpan akan muncul di sini." action={<button className="btn btn-primary" onClick={() => setTab('count')}>Mulai Hitung</button>} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Tanggal</th>
                    <th className="text-right">Produk</th>
                    <th>Akurasi</th>
                    <th className="text-right">Nilai Kekurangan</th>
                    <th>Catatan</th>
                    <th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((o, i) => {
                    const pct = o.total_items ? Math.round((o.matched_items / o.total_items) * 100) : 0;
                    const color = pct >= 90 ? 'var(--success)' : pct >= 70 ? '#f59e0b' : 'var(--danger)';
                    return (
                      <MotionRow key={o.id} index={i}>
                        <td className="mono strong">{o.code}</td>
                        <td className="nums" style={{ whiteSpace: 'nowrap' }}>{dateTime(o.created_at)}</td>
                        <td className="text-right nums">{o.total_items}</td>
                        <td style={{ minWidth: 170 }}>
                          <div className="row" style={{ gap: 10 }}>
                            <div className="progress" style={{ flex: 1 }}><span style={{ width: `${pct}%`, background: color }} /></div>
                            <strong className="nums" style={{ color, width: 40 }}>{pct}%</strong>
                          </div>
                          <div className="cell-sub">{o.matched_items} sesuai · {o.shortage_items} kurang · {o.surplus_items} lebih</div>
                        </td>
                        <td className={`text-right nums ${o.shortage_value ? 'text-red strong' : 'muted'}`}>{rupiah(o.shortage_value)}</td>
                        <td className="muted">{o.note || '-'}{o.created_by_name && <div className="cell-sub">oleh {o.created_by_name}</div>}</td>
                        <td className="text-right"><button className="btn btn-secondary btn-sm" onClick={() => setDetailId(o.id)}><Eye size={14} /> Detail</button></td>
                      </MotionRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal
        open={confirmOpen}
        onClose={saving ? undefined : () => setConfirmOpen(false)}
        title="Simpan hasil stock opname?"
        subtitle={`${counted.length} produk dihitung · ${mismatched.length} selisih`}
        width={560}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setConfirmOpen(false)} disabled={saving}>Periksa lagi</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving && <Loader2 size={16} className="spin" />} Simpan & Sesuaikan Stok
            </button>
          </>
        }
      >
        {mismatched.length === 0 ? (
          <div className="alert alert-success"><Check size={16} /> Semua stok yang dihitung sesuai dengan sistem.</div>
        ) : (
          <>
            <div className="alert alert-warning">
              <Info size={16} />
              <span>Stok {mismatched.length} produk berikut akan disesuaikan ke jumlah fisik dan dicatat di kartu stok.</span>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, marginBottom: 14, maxHeight: 240, overflowY: 'auto' }}>
              {mismatched.map((r) => (
                <div key={r.id} className="list-item" style={{ padding: '10px 14px' }}>
                  <div className="grow">
                    <div className="cell-title truncate">{r.name}</div>
                    <div className="cell-sub nums">{num(r.stock)} → {num(r.physical)} {r.unit}</div>
                  </div>
                  <DiffBadge diff={r.diff} unit={r.unit} />
                </div>
              ))}
            </div>
          </>
        )}
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="op-note">Catatan opname</label>
          <input id="op-note" className="input" placeholder="Mis. Opname mingguan, petugas: Budi" value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} />
        </div>
      </Modal>

      <OpnameDetailModal id={detailId} onClose={() => setDetailId(null)} />
    </>
  );
}
