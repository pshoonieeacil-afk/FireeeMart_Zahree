'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';
import Modal from './Modal';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Hapus', danger = true, loading, onConfirm, onClose, children }) {
  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      title={title}
      width={440}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Batal</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={loading}>
            {loading && <Loader2 size={16} className="spin" />} {confirmLabel}
          </button>
        </>
      }
    >
      <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
        <div className={`stat-icon ${danger ? 'tone-red' : 'tone-green'}`}>
          <AlertTriangle size={20} />
        </div>
        <div style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>{message}</div>
      </div>
      {children}
    </Modal>
  );
}
