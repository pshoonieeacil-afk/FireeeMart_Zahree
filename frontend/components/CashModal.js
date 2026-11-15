'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Info, Loader2 } from 'lucide-react';
import Modal from './Modal';
import { useToast } from './Toast';
import { api } from '@/lib/api';
import { nowLocalInput, rupiah } from '@/lib/format';

const QUICK = [50000, 100000, 250000, 500000, 1000000];
const STOCK_LINKED = { Penjualan: 'Stok Keluar', 'Pembelian Stok': 'Stok Masuk' };

export default function CashModal({ open, onClose, onSaved, defaultType = 'IN', categories, balance }) {
  const toast = useToast();
  const [form, setForm] = useState({ type: defaultType, category: '', amount: '', description: '', reference: '', transaction_date: '' });
  const [saving, setSaving] = useState(false);

  const list = categories?.[form.type] || [];

  useEffect(() => {
    if (!open) return;
    const first = (categories?.[defaultType] || []).find((c) => !STOCK_LINKED[c]) || '';
    setForm({ type: defaultType, category: first, amount: '', description: '', reference: '', transaction_date: nowLocalInput() });
  }, [open, defaultType, categories]);

  const setType = (type) => {
    const first = (categories?.[type] || []).find((c) => !STOCK_LINKED[c]) || '';
    setForm((f) => ({ ...f, type, category: first }));
  };
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const amount = Number(form.amount) || 0;
  const isIn = form.type === 'IN';
  const after = (Number(balance) || 0) + (isIn ? amount : -amount);

  async function submit(e) {
    e.preventDefault();
    if (amount <= 0) return toast.error('Nominal harus lebih dari 0');
    setSaving(true);
    try {
      await api('/cash', { method: 'POST', body: { ...form, amount } });
      toast.success(`${isIn ? 'Pemasukan' : 'Pengeluaran'} ${rupiah(amount)} tercatat`);
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
      title={isIn ? 'Catat Pemasukan Kas' : 'Catat Pengeluaran Kas'}
      subtitle="Transaksi kas tidak bisa dihapus — koreksi dengan tombol Batalkan"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Batal</button>
          <button type="submit" form="cash-form" className="btn btn-primary" disabled={saving}>
            {saving && <Loader2 size={16} className="spin" />} Simpan
          </button>
        </>
      }
    >
      <form id="cash-form" onSubmit={submit}>
        <div className="type-toggle" role="radiogroup" aria-label="Jenis transaksi kas">
          <button type="button" role="radio" aria-checked={isIn} className={`type-option in ${isIn ? 'active' : ''}`} onClick={() => setType('IN')}>
            <span className="ti"><ArrowDownLeft size={18} /></span>
            <span><strong>Pemasukan</strong><small>Modal, pendapatan lain</small></span>
          </button>
          <button type="button" role="radio" aria-checked={!isIn} className={`type-option cash-out ${!isIn ? 'active' : ''}`} onClick={() => setType('OUT')}>
            <span className="ti"><ArrowUpRight size={18} /></span>
            <span><strong>Pengeluaran</strong><small>Listrik, gaji, operasional</small></span>
          </button>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="cm-cat">Kategori <span className="req">*</span></label>
            <select id="cm-cat" className="select" value={form.category} onChange={set('category')} required>
              {list.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cm-date">Tanggal & jam</label>
            <input id="cm-date" className="input" type="datetime-local" value={form.transaction_date} max={nowLocalInput()} onChange={set('transaction_date')} />
          </div>
        </div>

        {STOCK_LINKED[form.category] && (
          <div className="alert alert-info">
            <Info size={16} />
            <span>Agar stok ikut berubah, catat {form.category.toLowerCase()} lewat menu <strong>{STOCK_LINKED[form.category]}</strong> dengan opsi kas aktif.</span>
          </div>
        )}

        <div className="field">
          <label htmlFor="cm-amount">Nominal <span className="req">*</span></label>
          <div className="affix prefix">
            <span className="affix-tag">Rp</span>
            <input id="cm-amount" className="input nums" type="number" min="1" step="any" inputMode="numeric" placeholder="0" value={form.amount} onChange={set('amount')} required autoFocus />
          </div>
          <div className="quick-amounts">
            {QUICK.map((q) => (
              <button type="button" key={q} onClick={() => setForm((f) => ({ ...f, amount: String(q) }))}>{rupiah(q).replace(/\s/g, ' ')}</button>
            ))}
          </div>
        </div>

        {balance !== undefined && amount > 0 && (
          <div className="preview">
            <div><small>Saldo saat ini</small><div className="pv nums" style={{ fontSize: 17 }}>{rupiah(balance)}</div></div>
            <span className="arrow">→</span>
            <div style={{ textAlign: 'right' }}><small>Saldo setelahnya</small><div className={`pv nums ${after < 0 ? 'text-red' : ''}`} style={{ fontSize: 17 }}>{rupiah(after)}</div></div>
          </div>
        )}
        {after < 0 && amount > 0 && (
          <div className="alert alert-warning"><AlertTriangle size={16} /> Saldo kas akan minus. Pastikan semua pemasukan sudah tercatat.</div>
        )}

        <div className="form-grid">
          <div className="field">
            <label htmlFor="cm-desc">Keterangan</label>
            <input id="cm-desc" className="input" placeholder={isIn ? 'Mis. tambahan modal' : 'Mis. token listrik'} value={form.description} onChange={set('description')} maxLength={255} />
          </div>
          <div className="field">
            <label htmlFor="cm-ref">No. bukti / referensi</label>
            <input id="cm-ref" className="input" placeholder="Opsional" value={form.reference} onChange={set('reference')} maxLength={100} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
