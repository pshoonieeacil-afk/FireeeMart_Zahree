'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { rupiahShort } from '@/lib/format';
import { EmptyState, ErrorState, PageHeader } from '@/components/ui';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/components/AuthProvider';
import { Stagger, StaggerItem } from '@/components/motion';

const PALETTE = [
  ['#f8f0fd', '#8e44c4'], ['#fbecef', '#5c0f21'], ['#fffbeb', '#b45309'], ['#eff6ff', '#1d4ed8'],
  ['#fdf2f8', '#be185d'], ['#ecfdf3', '#15803d'], ['#fff7ed', '#c2410c'], ['#ecfeff', '#0e7490'],
];

function CategoryFormModal({ open, category, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const isEdit = !!category;

  useEffect(() => {
    if (open) setForm({ name: category?.name || '', description: category?.description || '' });
  }, [open, category]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(isEdit ? `/categories/${category.id}` : '/categories', { method: isEdit ? 'PUT' : 'POST', body: form });
      toast.success(isEdit ? 'Kategori diperbarui' : `Kategori "${form.name}" ditambahkan`);
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
      title={isEdit ? 'Edit Kategori' : 'Tambah Kategori'}
      subtitle="Kelompokkan produk agar mudah dicari"
      width={460}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Batal</button>
          <button type="submit" form="category-form" className="btn btn-primary" disabled={saving}>
            {saving && <Loader2 size={16} className="spin" />} Simpan
          </button>
        </>
      }
    >
      <form id="category-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="cf-name">Nama kategori <span className="req">*</span></label>
          <input id="cf-name" className="input" placeholder="Mis. Minyak Goreng" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="cf-desc">Deskripsi</label>
          <textarea id="cf-desc" className="textarea" placeholder="Opsional" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={255} />
        </div>
      </form>
    </Modal>
  );
}

export default function KategoriPage() {
  const toast = useToast();
  const { can } = useAuth();
  const [categories, setCategories] = useState(null);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      setCategories(await api('/categories'));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function confirmDelete() {
    setDeleteLoading(true);
    try {
      await api(`/categories/${deleting.id}`, { method: 'DELETE' });
      toast.success(`Kategori "${deleting.name}" dihapus`);
      setDeleting(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeleteLoading(false);
    }
  }

  const openNew = () => { setEditing(null); setFormOpen(true); };

  return (
    <>
      <PageHeader
        title="Kategori"
        description="Kelompok barang sembako seperti beras, minyak goreng, kopi, dan teh."
        actions={can('category.write') && <button className="btn btn-primary" onClick={openNew}><Plus size={17} /> Tambah Kategori</button>}
      />

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !categories ? (
        <div className="cat-grid">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="card skeleton" style={{ height: 170 }} />)}</div>
      ) : categories.length === 0 ? (
        <div className="card">
          <EmptyState icon={Tags} title="Belum ada kategori" description="Buat kategori pertama sebelum menambahkan produk." action={can('category.write') && <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Tambah Kategori</button>} />
        </div>
      ) : (
        <Stagger className="cat-grid">
          {categories.map((c, i) => {
            const [bg, fg] = PALETTE[i % PALETTE.length];
            return (
              <StaggerItem key={c.id} className="card cat-card card-hover">
                <div className="cat-top">
                  <div className="cat-avatar" style={{ background: bg, color: fg }}>{c.name.charAt(0).toUpperCase()}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="cell-title" style={{ fontSize: 15 }}>{c.name}</div>
                    <div className="cell-sub">{c.description || 'Tanpa deskripsi'}</div>
                  </div>
                </div>
                <div className="cat-meta">
                  <Link href={`/produk?kategori=${c.id}`} title="Lihat produk"><small>Jumlah produk</small><strong>{c.product_count}</strong></Link>
                  <div><small>Nilai stok</small><strong>{rupiahShort(c.stock_value)}</strong></div>
                </div>
                {(can('category.write') || can('category.delete')) && (
                  <div className="cat-actions">
                    {can('category.write') && <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(c); setFormOpen(true); }}><Pencil size={14} /> Edit</button>}
                    {can('category.delete') && <button className="btn btn-secondary btn-sm" onClick={() => setDeleting(c)} style={{ color: 'var(--danger)' }}><Trash2 size={14} /> Hapus</button>}
                  </div>
                )}
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

      <CategoryFormModal open={formOpen} category={editing} onClose={() => setFormOpen(false)} onSaved={load} />
      <ConfirmDialog
        open={!!deleting}
        title="Hapus kategori?"
        loading={deleteLoading}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        message={
          deleting &&
          (deleting.product_count > 0 ? (
            <>Kategori <strong>{deleting.name}</strong> masih berisi <strong>{deleting.product_count} produk</strong>. Pindahkan produk ke kategori lain terlebih dahulu.</>
          ) : (
            <>Kategori <strong>{deleting.name}</strong> akan dihapus permanen.</>
          ))
        }
      />
    </>
  );
}
