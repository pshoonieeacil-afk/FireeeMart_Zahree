'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AlertTriangle, ArrowDownToLine, ArrowRight, ArrowUpFromLine, ClipboardCheck, Package, PackageX, Plus, RefreshCw,
  Scale, ShoppingCart, TrendingUp, Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';
import { MOVEMENT_META, dateOnly, num, parseDate, rupiahShort, signedQty, timeAgo, todayISO } from '@/lib/format';
import { EmptyState, ErrorState, PageHeader } from '@/components/ui';
import { CountUp, EASE, Stagger, StaggerItem, useAnimatedNumber } from '@/components/motion';
import { useAuth } from '@/components/AuthProvider';
import StockModal from '@/components/StockModal';

const MV_ICON = { IN: ArrowDownToLine, OUT: ArrowUpFromLine, ADJUST: Scale };

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 19) return 'Selamat sore';
  return 'Selamat malam';
}

function Stat({ icon: Icon, tone, label, value, format, hint, href, featured }) {
  const body = (
    <>
      <div className={`stat-icon ${tone}`}><Icon size={21} /></div>
      <div style={{ minWidth: 0, position: 'relative', zIndex: 1 }}>
        <div className="stat-label">{label}</div>
        <div className="stat-value nums"><CountUp value={value} format={format} /></div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </>
  );
  const cls = `card stat card-hover ${featured ? 'featured' : ''}`;
  return <StaggerItem>{href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>}</StaggerItem>;
}

function BarChart({ data, series, formatValue = (v) => v, showValues = true }) {
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key])));
  const today = todayISO();
  return (
    <div className="chart">
      {data.map((d, i) => {
        const date = parseDate(`${d.date} 00:00:00`);
        return (
          <div className="chart-col" key={d.date}>
            <div className="chart-bars">
              {series.map((s, j) => (
                <motion.div
                  key={s.key}
                  className={`bar ${s.cls}`}
                  initial={{ height: 0 }}
                  animate={{ height: `${(d[s.key] / max) * 100}%` }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.1 + i * 0.05 + j * 0.03 }}
                  title={`${s.label}: ${formatValue(d[s.key], true)}`}
                >
                  {showValues && d[s.key] > 0 && <span className="bar-val">{formatValue(d[s.key])}</span>}
                </motion.div>
              ))}
            </div>
            <div className={`chart-label ${d.date === today ? 'today' : ''}`}>
              {d.date === today ? 'Hari ini' : date.toLocaleDateString('id-ID', { weekday: 'short' })}
              <br />
              <span style={{ fontWeight: 500 }}>{date.getDate()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const compact = (v, full) => (full ? rupiahShort(v) : v >= 1e6 ? `${(v / 1e6).toFixed(1).replace('.', ',')}jt` : v >= 1e3 ? `${Math.round(v / 1e3)}rb` : String(v));

function ActivityCard({ data, showCash }) {
  const [tab, setTab] = useState(showCash ? 'cash' : 'stock');
  const isCash = tab === 'cash';
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3><TrendingUp size={17} className="text-purple" /> {isCash ? 'Arus Kas 7 Hari' : 'Aktivitas Stok 7 Hari'}</h3>
          <p>{isCash ? 'Total pemasukan & pengeluaran kas per hari' : 'Jumlah transaksi stok masuk & keluar per hari'}</p>
        </div>
        {showCash && (
          <div className="segmented">
            {[['cash', 'Kas'], ['stock', 'Stok']].map(([k, l]) => (
              <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
                {tab === k && <motion.span layoutId="act-tab" className="seg-bg" />}
                <span>{l}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="card-body">
        {isCash ? (
          <BarChart key="cash" data={data.cash.daily} formatValue={compact} showValues={false} series={[{ key: 'cash_in', cls: 'cash-in', label: 'Pemasukan' }, { key: 'cash_out', cls: 'cash-out', label: 'Pengeluaran' }]} />
        ) : (
          <BarChart key="stock" data={data.daily} series={[{ key: 'stock_in', cls: 'in', label: 'Masuk' }, { key: 'stock_out', cls: 'out', label: 'Keluar' }]} />
        )}
        <div className="legend mt-4">
          {isCash ? (
            <>
              <span><i style={{ background: '#8e44c4' }} /> Pemasukan</span>
              <span><i style={{ background: '#5c0f21' }} /> Pengeluaran</span>
            </>
          ) : (
            <>
              <span><i style={{ background: '#22c55e' }} /> Stok masuk</span>
              <span><i style={{ background: '#f59e0b' }} /> Stok keluar</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AccuracyCard({ opname, canOpname }) {
  const pct = opname?.total_items ? Math.round((opname.matched_items / opname.total_items) * 100) : 0;
  const animated = useAnimatedNumber(pct, 1.2);
  if (!opname) {
    return (
      <div className="card">
        <div className="card-header"><h3><ClipboardCheck size={17} /> Akurasi Stok</h3></div>
        <EmptyState
          icon={ClipboardCheck}
          title="Belum ada stock opname"
          description="Hitung stok fisik untuk mengetahui seberapa akurat catatan stok toko."
          action={canOpname && <Link href="/opname" className="btn btn-primary">Mulai Stock Opname</Link>}
        />
      </div>
    );
  }
  const color = pct >= 90 ? '#16a34a' : pct >= 70 ? '#f59e0b' : '#ef4444';
  const daysSince = Math.floor((Date.now() - parseDate(opname.created_at).getTime()) / 86400000);
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3><ClipboardCheck size={17} className="text-purple" /> Akurasi Stok</h3>
          <p>Hasil stock opname terakhir</p>
        </div>
        <span className="badge badge-gray mono">{opname.code}</span>
      </div>
      <div className="card-body accuracy">
        <div className="ring" style={{ background: `conic-gradient(${color} ${animated * 3.6}deg, #efe8f3 0deg)` }}>
          <div className="ring-inner">
            <div>
              <strong style={{ color }}>{Math.round(animated)}%</strong>
              <small>stok sesuai</small>
            </div>
          </div>
        </div>
        <div>
          <div className="kv"><span>Produk dihitung</span><strong>{opname.total_items}</strong></div>
          <div className="kv"><span>Sesuai sistem</span><strong className="text-green">{opname.matched_items}</strong></div>
          <div className="kv"><span>Ada selisih (sudah disesuaikan)</span><strong className="text-amber">{opname.total_items - opname.matched_items}</strong></div>
          <div className="kv"><span>Tanggal · petugas</span><strong>{dateOnly(opname.created_at)}{opname.created_by_name ? ` · ${opname.created_by_name}` : ''}</strong></div>
        </div>
        {daysSince >= 7 && (
          <div className="alert alert-warning" style={{ margin: 0 }}>
            <AlertTriangle size={16} /> Opname terakhir {daysSince} hari lalu. Lakukan minimal seminggu sekali.
          </div>
        )}
        {canOpname && <Link href="/opname" className="btn btn-secondary btn-block">Lakukan Stock Opname <ArrowRight size={16} /></Link>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, can } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [stockModal, setStockModal] = useState(null); // { product?, type }
  const [products, setProducts] = useState([]);

  const load = useCallback(async () => {
    try {
      setError('');
      setData(await api('/dashboard'));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function quickSale() {
    if (!products.length) {
      try { setProducts(await api('/products')); } catch (e) { setError(e.message); return; }
    }
    setStockModal({ type: 'OUT' });
  }

  const header = (
    <PageHeader
      eyebrow={new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      title={`${greeting()}, ${user.name.replace(/\s*\(.*\)/, '').split(' ')[0]}!`}
      description="Ringkasan stok dan kas toko hari ini. Semua angka dihitung dari transaksi yang tercatat."
      actions={
        <>
          <button className="btn btn-secondary" onClick={load} aria-label="Muat ulang"><RefreshCw size={16} /></button>
          {can('stock.out') && can('cash.write') && (
            <button className="btn btn-gradient" onClick={quickSale}><ShoppingCart size={17} /> Catat Penjualan</button>
          )}
        </>
      }
    />
  );

  if (error) return <>{header}<ErrorState message={error} onRetry={load} /></>;
  if (!data) {
    return (
      <>
        {header}
        <div className="stats">{[0, 1, 2, 3].map((i) => <div key={i} className="card skeleton" style={{ height: 100 }} />)}</div>
        <div className="grid-2">
          <div className="card skeleton" style={{ height: 320 }} />
          <div className="card skeleton" style={{ height: 320 }} />
        </div>
      </>
    );
  }

  const { totals, today, low_stock: lowStock, recent_movements: recent, last_opname: lastOpname, cash } = data;

  return (
    <>
      {header}

      <Stagger className="stats">
        {cash ? (
          <>
            <Stat featured icon={Wallet} tone="" label="Saldo Kas" value={cash.balance} format={rupiahShort} hint={`Bulan ini: +${rupiahShort(cash.month.cash_in)} · −${rupiahShort(cash.month.cash_out)}`} href="/kas" />
            <Stat icon={ShoppingCart} tone="tone-green" label="Penjualan Hari Ini" value={cash.today.sales} format={rupiahShort} hint={`${today.stock_out} transaksi stok keluar`} />
          </>
        ) : (
          <>
            <Stat featured icon={Package} tone="" label="Total Produk" value={totals.total_products} hint={`${totals.total_categories} kategori`} href="/produk" />
            <Stat icon={ArrowDownToLine} tone="tone-green" label="Transaksi Hari Ini" value={today.total} hint={`${today.stock_in} masuk · ${today.stock_out} keluar`} href="/stok" />
          </>
        )}
        <Stat icon={AlertTriangle} tone="tone-amber" label="Stok Menipis" value={totals.low_stock} hint="Di bawah batas minimum" href="/produk?status=low" />
        <Stat icon={PackageX} tone="tone-red" label="Stok Habis" value={totals.out_of_stock} hint={`Nilai stok ${rupiahShort(totals.stock_value)}`} href="/produk?status=out" />
      </Stagger>

      <Stagger className="grid-2">
        <StaggerItem><ActivityCard data={data} showCash={!!cash} /></StaggerItem>
        <StaggerItem><AccuracyCard opname={lastOpname} canOpname={can('opname')} /></StaggerItem>
      </Stagger>

      <Stagger className="grid-2 even">
        <StaggerItem className="card">
          <div className="card-header">
            <div>
              <h3><AlertTriangle size={17} className="text-amber" /> Perlu Restock</h3>
              <p>Produk habis atau di bawah stok minimum</p>
            </div>
            <Link href="/produk?status=low" className="btn btn-ghost btn-sm">Lihat semua <ArrowRight size={14} /></Link>
          </div>
          {lowStock.length === 0 ? (
            <EmptyState icon={Package} title="Semua stok aman" description="Tidak ada produk yang perlu dibeli ulang saat ini." />
          ) : (
            lowStock.map((p, i) => {
              const out = p.stock <= 0;
              return (
                <motion.div className="list-item" key={p.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.04 }}>
                  <div className={`mv-icon ${out ? 'danger' : 'out'}`}>{out ? <PackageX size={18} /> : <AlertTriangle size={18} />}</div>
                  <div className="grow">
                    <div className="cell-title truncate">{p.name}</div>
                    <div className="cell-sub">
                      <span className={out ? 'text-red strong' : 'text-amber strong'}>{num(p.stock)} {p.unit}</span> · min. {num(p.min_stock)} {p.unit}
                    </div>
                  </div>
                  {can('stock.in') && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setStockModal({ product: p, type: 'IN' })}>
                      <Plus size={14} /> Stok
                    </button>
                  )}
                </motion.div>
              );
            })
          )}
        </StaggerItem>

        <StaggerItem className="card">
          <div className="card-header">
            <div>
              <h3>Transaksi Stok Terakhir</h3>
              <p>Riwayat perubahan stok terbaru</p>
            </div>
            <Link href="/stok" className="btn btn-ghost btn-sm">Kartu stok <ArrowRight size={14} /></Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState icon={Package} title="Belum ada transaksi" description="Transaksi stok masuk & keluar akan muncul di sini." />
          ) : (
            recent.map((m, i) => {
              const meta = MOVEMENT_META[m.type];
              const Icon = MV_ICON[m.type];
              return (
                <motion.div className="list-item" key={m.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.04 }}>
                  <div className={`mv-icon ${meta.cls}`}><Icon size={17} /></div>
                  <div className="grow">
                    <div className="cell-title truncate">{m.product_name}</div>
                    <div className="cell-sub truncate">{meta.label} · {m.created_by_name || '-'} · {timeAgo(m.created_at)}</div>
                  </div>
                  <div className="text-right">
                    <div className={`strong nums text-${m.type === 'IN' ? 'green' : m.type === 'OUT' ? 'amber' : 'blue'}`}>{signedQty(m)} {m.unit}</div>
                    <div className="cell-sub nums">sisa {num(m.stock_after)}</div>
                  </div>
                </motion.div>
              );
            })
          )}
        </StaggerItem>
      </Stagger>

      <StockModal
        open={!!stockModal}
        product={stockModal?.product || null}
        products={products}
        defaultType={stockModal?.type || 'IN'}
        onClose={() => setStockModal(null)}
        onSaved={load}
      />
    </>
  );
}
