'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowDownToLine, ArrowRight, ArrowUpFromLine, Loader2, Package, Wallet } from 'lucide-react';
import Modal from './Modal';
import { useToast } from './Toast';
import { useAuth } from './AuthProvider';
import { api } from '@/lib/api';
import { num, round2, rupiah } from '@/lib/format';

/**
 * Form pencatatan stok masuk / keluar, sekaligus (opsional) mencatat kas:
 *  - Stok keluar + "Catat sebagai penjualan"  -> kas masuk (jumlah × harga jual)
 *  - Stok masuk  + "Dibayar tunai"            -> kas keluar (jumlah × harga beli)
 * `product` diisi -> produk terkunci. Kosong -> pilih dari `products`.
 */
export default function StockModal({ open, onClose, onSaved, product = null, products = [], defaultType = 'IN' }) {
  const toast = useToast();
  const { can } = useAuth();
  const allowed = useMemo(() => ['IN', 'OUT'].filter((t) => can(t === 'IN' ? 'stock.in' : 'stock.out')), [can]);
  const canCash = can('cash.write');

  const [form, setForm] = useState({ product_id: '', type: 'IN', quantity: '', reference: '', note: '' });
  const [withCash, setWithCash] = useState(true);
  const [unitPrice, setUnitPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const selected = product || products.find((p) => String(p.id) === String(form.product_id));
  const isIn = form.type === 'IN';

  useEffect(() => {
    if (!open) return;
    const type = allowed.includes(defaultType) ? defaultType : allowed[0] || 'OUT';
    setForm({ product_id: product?.id ?? '', type, quantity: '', reference: '', note: '' });
    setWithCash(true);
  }, [open, product, defaultType, allowed]);

  // Harga satuan default mengikuti jenis transaksi & produk
  useEffect(() => {
    if (selected) setUnitPrice(String(isIn ? selected.buy_price ?? '' : selected.sell_price ?? ''));
  }, [selected?.id, isIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const qty = Number(form.quantity) || 0;
  const after = selected ? round2(isIn ? selected.stock + qty : selected.stock - qty) : null;
  const insufficient = !isIn && selected && qty > selected.stock;
  const belowMin = !isIn && selected && !insufficient && qty > 0 && after <= selected.min_stock;
  const cashOn = canCash && withCash;
  const total = round2(qty * (Number(unitPrice) || 0));

  async function submit(e) {
    e.preventDefault();
    if (!selected) return toast.error('Pilih produk terlebih dahulu');
    if (qty <= 0) return toast.error('Jumlah harus lebih dari 0');
    if (insufficient) return toast.error('Jumlah keluar melebihi stok tersedia');
    if (cashOn && !(Number(unitPrice) > 0)) return toast.error('Isi harga satuan untuk pencatatan kas');
    setSaving(true);
    try {
      await api('/movements', {
        method: 'POST',
        body: {
          product_id: selected.id, type: form.type, quantity: qty, reference: form.reference, note: form.note,
          cash: cashOn ? { enabled: true, unit_price: Number(unitPrice) } : undefined,
        },
      });
      toast.success(
        `Stok ${selected.name} ${isIn ? 'bertambah' : 'berkurang'} ${num(qty)} ${selected.unit}` +
          (cashOn ? ` · kas ${isIn ? 'keluar' : 'masuk'} ${rupiah(total)}` : '')
      );
      onSaved?.();
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
      title={isIn ? 'Catat Stok Masuk' : 'Catat Stok Keluar'}
      subtitle="Setiap transaksi otomatis tercatat di kartu stok"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Batal</button>
          <button type="submit" form="stock-form" className="btn btn-primary" disabled={saving || insufficient}>
            {saving && <Loader2 size={16} className="spin" />} Simpan Transaksi
          </button>
        </>
      }
    >
      <form id="stock-form" onSubmit={submit}>
        <div className={`type-toggle ${allowed.length < 2 ? 'single' : ''}`} role="radiogroup" aria-label="Jenis transaksi">
          {allowed.includes('IN') && (
            <button type="button" role="radio" aria-checked={isIn} className={`type-option in ${isIn ? 'active' : ''}`} onClick={() => setForm((f) => ({ ...f, type: 'IN' }))}>
              <span className="ti"><ArrowDownToLine size={18} /></span>
              <span><strong>Stok Masuk</strong><small>Pembelian / kiriman supplier</small></span>
            </button>
          )}
          {allowed.includes('OUT') && (
            <button type="button" role="radio" aria-checked={!isIn} className={`type-option out ${!isIn ? 'active' : ''}`} onClick={() => setForm((f) => ({ ...f, type: 'OUT' }))}>
              <span className="ti"><ArrowUpFromLine size={18} /></span>
              <span><strong>Stok Keluar</strong><small>Penjualan / rusak / retur</small></span>
            </button>
          )}
        </div>

        {product ? (
          <div className="product-pill">
            <div className="stat-icon tone-purple" style={{ width: 38, height: 38 }}><Package size={18} /></div>
            <div>
              <div className="cell-title">{product.name}</div>
              <div className="cell-sub">{product.sku} · {product.category_name}</div>
            </div>
          </div>
        ) : (
          <div className="field">
            <label htmlFor="sm-product">Produk <span className="req">*</span></label>
            <select id="sm-product" className="select" value={form.product_id} onChange={set('product_id')} required>
              <option value="">— Pilih produk —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({num(p.stock)} {p.unit})</option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label htmlFor="sm-qty">Jumlah {isIn ? 'masuk' : 'keluar'} <span className="req">*</span></label>
          <div className="affix">
            <input id="sm-qty" className="input" type="number" min="0.01" step="any" inputMode="decimal" placeholder="0" value={form.quantity} onChange={set('quantity')} autoFocus required />
            <span className="affix-tag">{selected?.unit || 'satuan'}</span>
          </div>
        </div>

        {selected && (
          <div className="preview">
            <div>
              <small>Stok saat ini</small>
              <div className="pv nums">{num(selected.stock)}<span>{selected.unit}</span></div>
            </div>
            <ArrowRight className="arrow" size={18} />
            <div style={{ textAlign: 'right' }}>
              <small>Setelah transaksi</small>
              <motion.div key={after} initial={{ scale: 0.92, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} className={`pv nums ${insufficient ? 'text-red' : isIn ? 'text-green' : 'text-amber'}`}>
                {num(Math.max(after, 0))}<span>{selected.unit}</span>
              </motion.div>
            </div>
          </div>
        )}

        {insufficient && (
          <div className="alert alert-danger"><AlertTriangle size={16} /> Stok tidak cukup. Maksimal yang bisa dikeluarkan {num(selected.stock)} {selected.unit}.</div>
        )}
        {belowMin && (
          <div className="alert alert-warning"><AlertTriangle size={16} /> Setelah transaksi ini stok di bawah minimum ({num(selected.min_stock)} {selected.unit}). Segera restock.</div>
        )}

        {canCash && (
          <>
            <label className={`check-card ${withCash ? 'on' : ''}`}>
              <input type="checkbox" checked={withCash} onChange={(e) => setWithCash(e.target.checked)} />
              <div>
                <strong><Wallet size={14} style={{ verticalAlign: -2 }} /> {isIn ? 'Dibayar tunai — catat pengeluaran kas' : 'Catat sebagai penjualan — pemasukan kas'}</strong>
                <small>{isIn ? 'Matikan jika pembelian belum dibayar (hutang ke supplier).' : 'Matikan untuk barang rusak, retur, atau pemakaian sendiri.'}</small>
              </div>
            </label>
            <AnimatePresence initial={false}>
              {withCash && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="sm-price">Harga {isIn ? 'beli' : 'jual'} / {selected?.unit || 'satuan'}</label>
                      <div className="affix prefix">
                        <span className="affix-tag">Rp</span>
                        <input id="sm-price" className="input nums" type="number" min="0" step="any" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
                      </div>
                    </div>
                    <div className="field">
                      <label>Total {isIn ? 'pengeluaran' : 'pemasukan'} kas</label>
                      <div className={`input nums strong ${isIn ? 'text-red' : 'text-green'}`} style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-2)' }}>
                        {isIn ? '−' : '+'} {rupiah(total)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        <div className="form-grid">
          <div className="field">
            <label htmlFor="sm-ref">No. referensi</label>
            <input id="sm-ref" className="input" placeholder={isIn ? 'No. faktur / PO' : 'No. nota'} value={form.reference} onChange={set('reference')} maxLength={100} />
          </div>
          <div className="field">
            <label htmlFor="sm-note">Keterangan</label>
            <input id="sm-note" className="input" placeholder={isIn ? 'Mis. pembelian dari supplier' : 'Mis. penjualan harian'} value={form.note} onChange={set('note')} maxLength={255} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
