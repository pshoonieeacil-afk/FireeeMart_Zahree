'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownToLine, ArrowUpFromLine, Info, Loader2, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { STATUS_META, UNITS, num, rupiah, stockStatus, timeAgo } from '@/lib/format';
import { EmptyState, ErrorState, PageHeader, StatusBadge, StockCell, TableSkeleton } from '@/components/ui';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import StockModal from '@/components/StockModal';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/components/AuthProvider';
import { MotionRow } from '@/components/motion';
import { motion } from 'framer-motion';

const EMPTY_FORM = { name: '', sku: '', category_id: '', unit: 'pcs', buy_price: '', sell_price: '', min_stock: '', location: '', initial_stock: '' };

function ProductFormModal({ open, product, categories, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const isEdit = !!product;

  useEffect(() => {
    if (!open) return;
    setForm(
      product
        ? {
            name: product.name, sku: product.sku, category_id: String(product.category_id), unit: product.unit,
            buy_price: String(product.buy_price), sell_price: String(product.sell_price),
            min_stock: String(product.min_stock), location: product.location || '', initial_stock: '',
          }
        : { ...EMPTY_FORM, category_id: categories[0] ? String(categories[0].id) : '' }
    );
  }, [open, product, categories]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const buy = Number(form.buy_price) || 0;
  const sell = Number(form.sell_price) || 0;
  const margin = sell - buy;

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form };
      if (isEdit) delete body.initial_stock;
      const saved = await api(isEdit ? `/products/${product.id}` : '/products', { method: isEdit ? 'PUT' : 'POST', body });
      toast.success(isEdit ? `Produk "${saved.name}" diperbarui` : `Produk "${saved.name}" ditambahkan dengan SKU ${saved.sku}`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      width={620}
      title={isEdit ? 'Edit Produk' : 'Tambah Produk Baru'}
      subtitle={isEdit ? `${product.sku} · stok saat ini ${num(product.stock)} ${product.unit}` : 'Lengkapi data barang sembako'}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Batal</button>
          <button type="submit" form="product-form" className="btn btn-primary" disabled={saving}>
            {saving && <Loader2 size={16} className="spin" />} {isEdit ? 'Simpan Perubahan' : 'Tambah Produk'}
          </button>
        </>
      }
    >
      {categories.length === 0 ? (
        <div className="alert alert-warning">
          <Info size={16} />
          <span>Belum ada kategori. <Link href="/kategori" className="strong" style={{ textDecoration: 'underline' }}>Buat kategori</Link> terlebih dahulu.</span>
        </div>
      ) : null}
      <form id="product-form" onSubmit={submit} className="form-grid">
        <div className="field span-2">
          <label htmlFor="pf-name">Nama produk <span className="req">*</span></label>
          <input id="pf-name" className="input" placeholder="Mis. Beras Premium 5 kg" value={form.name} onChange={set('name')} required maxLength={150} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="pf-cat">Kategori <span className="req">*</span></label>
          <select id="pf-cat" className="select" value={form.category_id} onChange={set('category_id')} required>
            <option value="">— Pilih kategori —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pf-sku">SKU / Kode barang</label>
          <input id="pf-sku" className="input mono" placeholder="Kosongkan untuk otomatis" value={form.sku} onChange={set('sku')} maxLength={50} style={{ textTransform: 'uppercase' }} />
        </div>
        <div className="field">
          <label htmlFor="pf-unit">Satuan <span className="req">*</span></label>
          <input id="pf-unit" className="input" list="unit-list" placeholder="kg, liter, pcs…" value={form.unit} onChange={set('unit')} required maxLength={30} />
          <datalist id="unit-list">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
        </div>
        <div className="field">
          <label htmlFor="pf-loc">Lokasi rak / gudang</label>
          <input id="pf-loc" className="input" placeholder="Mis. Rak B-1" value={form.location} onChange={set('location')} maxLength={100} />
        </div>
        <div className="field">
          <label htmlFor="pf-buy">Harga beli</label>
          <div className="affix prefix">
            <span className="affix-tag">Rp</span>
            <input id="pf-buy" className="input nums" type="number" min="0" step="any" placeholder="0" value={form.buy_price} onChange={set('buy_price')} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="pf-sell">Harga jual</label>
          <div className="affix prefix">
            <span className="affix-tag">Rp</span>
            <input id="pf-sell" className="input nums" type="number" min="0" step="any" placeholder="0" value={form.sell_price} onChange={set('sell_price')} />
          </div>
          {(buy > 0 || sell > 0) && (
            <span className={`hint ${margin < 0 ? 'text-red' : ''}`}>
              Margin {rupiah(margin)} / {form.unit || 'satuan'}
              {buy > 0 ? ` (${Math.round((margin / buy) * 100)}%)` : ''}
              {margin < 0 ? ' — harga jual di bawah harga beli!' : ''}
            </span>
          )}
        </div>
        <div className="field">
          <label htmlFor="pf-min">Stok minimum</label>
          <div className="affix">
            <input id="pf-min" className="input nums" type="number" min="0" step="any" placeholder="0" value={form.min_stock} onChange={set('min_stock')} />
            <span className="affix-tag">{form.unit || 'satuan'}</span>
          </div>
          <span className="hint">Peringatan muncul jika stok ≤ angka ini</span>
        </div>
        {!isEdit ? (
          <div className="field">
            <label htmlFor="pf-init">Stok awal</label>
            <div className="affix">
              <input id="pf-init" className="input nums" type="number" min="0" step="any" placeholder="0" value={form.initial_stock} onChange={set('initial_stock')} />
              <span className="affix-tag">{form.unit || 'satuan'}</span>
            </div>
            <span className="hint">Dicatat sebagai transaksi “Stok awal”</span>
          </div>
        ) : (
          <div className="field">
            <label>Stok</label>
            <div className="alert alert-info" style={{ margin: 0 }}>
              <Info size={16} />
              <span>Stok tidak diedit di sini agar tetap tercatat. Gunakan tombol Masuk/Keluar atau Stock Opname.</span>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

export default function ProdukPage() {
  const toast = useToast();
  const { can } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [stockTarget, setStockTarget] = useState(null);
  const [stockType, setStockType] = useState('IN');
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const [p, c] = await Promise.all([api('/products'), api('/categories')]);
      setProducts(p);
      setCategories(c);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('status');
    if (['low', 'out', 'ok'].includes(s)) setStatus(s);
    if (/^\d+$/.test(params.get('kategori') || '')) setCategoryId(params.get('kategori'));
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { all: products.length, ok: 0, low: 0, out: 0 };
    products.forEach((p) => { c[stockStatus(p)] += 1; });
    return c;
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (status !== 'all' && stockStatus(p) !== status) return false;
      if (categoryId && String(p.category_id) !== categoryId) return false;
      if (q && ![p.name, p.sku, p.location, p.category_name].some((v) => v?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [products, search, categoryId, status]);

  const openStock = (p, type) => { setStockType(type); setStockTarget(p); };

  async function confirmDelete() {
    setDeleteLoading(true);
    try {
      await api(`/products/${deleting.id}`, { method: 'DELETE' });
      toast.success(`Produk "${deleting.name}" dihapus`);
      setDeleting(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Produk"
        description="Daftar seluruh barang sembako beserta stok, harga, dan lokasi penyimpanannya."
        actions={
          can('product.write') && (
            <button className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus size={17} /> Tambah Produk
            </button>
          )
        }
      />

      <div className="chips" role="tablist" aria-label="Filter status stok">
        {[
          ['all', 'Semua', null],
          ['ok', 'Aman', STATUS_META.ok.color],
          ['low', 'Menipis', STATUS_META.low.color],
          ['out', 'Habis', STATUS_META.out.color],
        ].map(([key, label, color]) => (
          <button key={key} role="tab" aria-selected={status === key} className={`chip ${status === key ? 'active' : ''}`} onClick={() => setStatus(key)}>
            {status === key && <motion.span layoutId="status-chip" className="chip-bg" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            {color && <span className="dot" style={{ background: color }} />}
            <span>{label}</span> <span className="count">{counts[key]}</span>
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <div className="card">
          <div className="toolbar">
            <div className="input-icon grow">
              <Search size={16} />
              <input className="input" placeholder="Cari nama, SKU, atau lokasi rak…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Cari produk" />
            </div>
            <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Filter kategori">
              <option value="">Semua kategori</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {loading ? (
            <TableSkeleton cols={6} />
          ) : filtered.length === 0 ? (
            products.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Belum ada produk"
                description="Tambahkan barang sembako pertama Anda, misalnya beras, minyak goreng, atau gula."
                action={can('product.write') && <button className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={16} /> Tambah Produk</button>}
              />
            ) : (
              <EmptyState icon={Search} title="Produk tidak ditemukan" description="Coba ubah kata kunci atau filter yang dipilih." />
            )
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Produk</th>
                      <th>Kategori</th>
                      <th>Stok</th>
                      <th className="text-right">Harga Beli</th>
                      <th className="text-right">Harga Jual</th>
                      <th>Status</th>
                      <th className="text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p, i) => (
                      <MotionRow key={p.id} index={i}>
                        <td>
                          <div className="cell-title">{p.name}</div>
                          <div className="cell-sub"><span className="mono">{p.sku}</span>{p.location ? ` · ${p.location}` : ''}</div>
                        </td>
                        <td><span className="badge badge-gray">{p.category_name}</span></td>
                        <td>
                          <StockCell product={p} />
                          <div className="cell-sub">min. {num(p.min_stock)} · {p.last_movement_at ? timeAgo(p.last_movement_at) : 'belum ada transaksi'}</div>
                        </td>
                        <td className="text-right nums">{rupiah(p.buy_price)}</td>
                        <td className="text-right nums strong">{rupiah(p.sell_price)}</td>
                        <td><StatusBadge product={p} /></td>
                        <td>
                          <div className="actions">
                            {can('stock.in') && <button className="icon-btn in" title="Stok masuk" aria-label={`Stok masuk ${p.name}`} onClick={() => openStock(p, 'IN')}><ArrowDownToLine size={17} /></button>}
                            {can('stock.out') && <button className="icon-btn out" title="Stok keluar" aria-label={`Stok keluar ${p.name}`} onClick={() => openStock(p, 'OUT')} disabled={p.stock <= 0}><ArrowUpFromLine size={17} /></button>}
                            {can('product.write') && <button className="icon-btn" title="Edit" aria-label={`Edit ${p.name}`} onClick={() => { setEditing(p); setFormOpen(true); }}><Pencil size={16} /></button>}
                            {can('product.delete') && <button className="icon-btn danger" title="Hapus" aria-label={`Hapus ${p.name}`} onClick={() => setDeleting(p)}><Trash2 size={16} /></button>}
                          </div>
                        </td>
                      </MotionRow>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-foot">Menampilkan {filtered.length} dari {products.length} produk</div>
            </>
          )}
        </div>
      )}

      <ProductFormModal open={formOpen} product={editing} categories={categories} onClose={() => setFormOpen(false)} onSaved={load} />
      <StockModal open={!!stockTarget} product={stockTarget} defaultType={stockType} onClose={() => setStockTarget(null)} onSaved={load} />
      <ConfirmDialog
        open={!!deleting}
        title="Hapus produk?"
        loading={deleteLoading}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        message={
          deleting && (
            <>
              Produk <strong>{deleting.name}</strong> beserta <strong>seluruh riwayat stoknya</strong> akan dihapus permanen dan tidak bisa dikembalikan. Transaksi kas terkait tetap tersimpan di buku kas.
            </>
          )
        }
      />
    </>
  );
}
