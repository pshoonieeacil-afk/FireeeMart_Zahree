'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from './Modal';
import { useToast } from './Toast';
import { api } from '@/lib/api';

export default function ChangePasswordModal({ open, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ current_password: '', new_password: '', confirm: '' });
  }, [open]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const mismatch = form.confirm && form.new_password !== form.confirm;

  async function submit(e) {
    e.preventDefault();
    if (form.new_password !== form.confirm) return toast.error('Konfirmasi password tidak sama');
    setSaving(true);
    try {
      await api('/auth/password', { method: 'PUT', body: { current_password: form.current_password, new_password: form.new_password } });
      toast.success('Password berhasil diganti');
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
      title="Ganti Password"
      subtitle="Gunakan minimal 6 karakter"
      width={420}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Batal</button>
          <button type="submit" form="pw-form" className="btn btn-primary" disabled={saving || mismatch}>
            {saving && <Loader2 size={16} className="spin" />} Simpan
          </button>
        </>
      }
    >
      <form id="pw-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="pw-cur">Password lama</label>
          <input id="pw-cur" type="password" className="input" value={form.current_password} onChange={set('current_password')} autoComplete="current-password" required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="pw-new">Password baru</label>
          <input id="pw-new" type="password" className="input" value={form.new_password} onChange={set('new_password')} autoComplete="new-password" minLength={6} required />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="pw-conf">Ulangi password baru</label>
          <input id="pw-conf" type="password" className="input" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" required />
          {mismatch && <span className="hint text-red">Password tidak sama</span>}
        </div>
      </form>
    </Modal>
  );
}
