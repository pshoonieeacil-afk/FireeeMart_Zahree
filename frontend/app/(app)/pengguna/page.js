'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, ShieldCheck, Trash2, UsersRound } from 'lucide-react';
import { api } from '@/lib/api';
import { initials, timeAgo } from '@/lib/format';
import { ROLE_META } from '@/lib/permissions';
import { EmptyState, ErrorState, Guard, PageHeader, TableSkeleton } from '@/components/ui';
import { MotionRow, Stagger, StaggerItem } from '@/components/motion';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';

const EMPTY = { name: '', username: '', role: 'kasir', password: '', is_active: true };

function UserFormModal({ open, user, isSelf, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const isEdit = !!user;

  useEffect(() => {
    if (open) setForm(user ? { name: user.name, username: user.username, role: user.role, password: '', is_active: user.is_active } : EMPTY);
  }, [open, user]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(isEdit ? `/users/${user.id}` : '/users', { method: isEdit ? 'PUT' : 'POST', body: form });
      toast.success(isEdit ? 'Data pengguna diperbarui' : `Akun @${form.username.toLowerCase()} dibuat`);
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
      title={isEdit ? 'Edit Pengguna' : 'Tambah Pengguna'}
      subtitle={isEdit ? `@${user.username}` : 'Buat akun untuk karyawan toko'}
      width={500}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Batal</button>
          <button type="submit" form="user-form" className="btn btn-primary" disabled={saving}>
            {saving && <Loader2 size={16} className="spin" />} Simpan
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="uf-name">Nama lengkap <span className="req">*</span></label>
            <input id="uf-name" className="input" value={form.name} onChange={set('name')} required maxLength={100} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="uf-username">Username <span className="req">*</span></label>
            <input id="uf-username" className="input" value={form.username} onChange={set('username')} required maxLength={30} autoCapitalize="none" placeholder="mis. rina.kasir" />
          </div>
        </div>

        <div className="field">
          <label>Peran <span className="req">*</span></label>
          <div className="type-toggle" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 0 }}>
            {Object.entries(ROLE_META).map(([key, meta]) => (
              <button
                type="button" key={key} disabled={isSelf}
                className={`type-option ${form.role === key ? 'active in' : ''}`}
                style={form.role === key ? { borderColor: 'var(--brand)', background: 'var(--primary-50)' } : undefined}
                onClick={() => setForm((f) => ({ ...f, role: key }))}
              >
                <span><strong>{meta.label}</strong></span>
              </button>
            ))}
          </div>
          <span className="hint">{ROLE_META[form.role].desc}</span>
        </div>

        <div className="field">
          <label htmlFor="uf-pw">{isEdit ? 'Password baru' : 'Password'} {!isEdit && <span className="req">*</span>}</label>
          <input id="uf-pw" type="password" className="input" value={form.password} onChange={set('password')} required={!isEdit} minLength={6} autoComplete="new-password" placeholder={isEdit ? 'Kosongkan jika tidak diganti' : 'Minimal 6 karakter'} />
        </div>

        <div className="row between" style={{ padding: '10px 0 0' }}>
          <div>
            <div className="strong" style={{ fontSize: 13 }}>Akun aktif</div>
            <div className="hint">Akun nonaktif tidak bisa login, tetapi riwayatnya tetap tersimpan.</div>
          </div>
          <button type="button" className={`switch ${form.is_active ? 'on' : ''}`} disabled={isSelf} onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))} aria-pressed={form.is_active} aria-label="Akun aktif" />
        </div>
      </form>
    </Modal>
  );
}

export default function PenggunaPage() {
  return (
    <Guard perm="users">
      <PenggunaContent />
    </Guard>
  );
}

function PenggunaContent() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      setUsers(await api('/users'));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function confirmDelete() {
    setDeleteLoading(true);
    try {
      await api(`/users/${deleting.id}`, { method: 'DELETE' });
      toast.success(`Akun @${deleting.username} dihapus`);
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
        title="Pengguna"
        description="Kelola akun karyawan dan hak aksesnya. Setiap transaksi mencatat siapa yang menginput."
        actions={<button className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={17} /> Tambah Pengguna</button>}
      />

      <Stagger className="role-grid">
        {Object.entries(ROLE_META).map(([key, meta]) => (
          <StaggerItem key={key} className="card role-card">
            <div className={`stat-icon ${meta.tone}`}><ShieldCheck size={20} /></div>
            <div>
              <h4>{meta.label} <span className="muted" style={{ fontWeight: 500 }}>· {users ? users.filter((u) => u.role === key).length : '–'} akun</span></h4>
              <p>{meta.desc}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <div className="card">
          {!users ? (
            <TableSkeleton cols={5} rows={4} />
          ) : users.length === 0 ? (
            <EmptyState icon={UsersRound} title="Belum ada pengguna" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Pengguna</th><th>Peran</th><th>Status</th><th>Login terakhir</th><th className="text-right">Aktivitas</th><th className="text-right">Aksi</th></tr>
                </thead>
                <tbody>
                  {users.map((u, i) => {
                    const isSelf = u.id === me.id;
                    return (
                      <MotionRow key={u.id} index={i} className={u.is_active ? '' : 'row-faded'}>
                        <td>
                          <div className="row">
                            <div className="avatar">{initials(u.name)}</div>
                            <div>
                              <div className="cell-title">{u.name} {isSelf && <span className="badge badge-maroon">Anda</span>}</div>
                              <div className="cell-sub">@{u.username}</div>
                            </div>
                          </div>
                        </td>
                        <td><span className={`badge ${ROLE_META[u.role].badge}`}>{ROLE_META[u.role].label}</span></td>
                        <td>{u.is_active ? <span className="badge badge-dot badge-green">Aktif</span> : <span className="badge badge-dot badge-gray">Nonaktif</span>}</td>
                        <td className="muted">{u.last_login_at ? timeAgo(u.last_login_at) : 'Belum pernah'}</td>
                        <td className="text-right nums">{u.activity_count} transaksi</td>
                        <td>
                          <div className="actions">
                            <button className="icon-btn" title="Edit" aria-label={`Edit ${u.name}`} onClick={() => { setEditing(u); setFormOpen(true); }}><Pencil size={16} /></button>
                            <button className="icon-btn danger" title="Hapus" aria-label={`Hapus ${u.name}`} disabled={isSelf} onClick={() => setDeleting(u)}><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </MotionRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <UserFormModal open={formOpen} user={editing} isSelf={editing?.id === me.id} onClose={() => setFormOpen(false)} onSaved={load} />
      <ConfirmDialog
        open={!!deleting}
        title="Hapus pengguna?"
        loading={deleteLoading}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        message={
          deleting &&
          (deleting.activity_count > 0 ? (
            <>Akun <strong>@{deleting.username}</strong> sudah punya <strong>{deleting.activity_count} transaksi</strong>, jadi tidak bisa dihapus. Nonaktifkan lewat tombol Edit agar jejak audit tetap tersimpan.</>
          ) : (
            <>Akun <strong>@{deleting.username}</strong> akan dihapus permanen.</>
          ))
        }
      />
    </>
  );
}
