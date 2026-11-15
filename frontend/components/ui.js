'use client';

import { Lock, RefreshCw, WifiOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_META, num, stockStatus } from '@/lib/format';
import { useAuth } from './AuthProvider';
import { EASE } from './motion';

export function PageHeader({ title, description, actions, eyebrow }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ product }) {
  const meta = STATUS_META[stockStatus(product)];
  return <span className={`badge badge-dot ${meta.badge}`}>{meta.label}</span>;
}

/** Jumlah stok + bar visual relatif terhadap stok minimum */
export function StockCell({ product }) {
  const status = stockStatus(product);
  const min = Number(product.min_stock);
  const pct = min > 0 ? Math.min(100, (Number(product.stock) / (min * 3)) * 100) : product.stock > 0 ? 100 : 0;
  return (
    <div>
      <span className={`strong nums ${status === 'out' ? 'text-red' : status === 'low' ? 'text-amber' : ''}`}>{num(product.stock)}</span>{' '}
      <span className="muted">{product.unit}</span>
      <div className="stockbar" title={`Minimum ${num(min)} ${product.unit}`}>
        <motion.span
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(pct, status === 'out' ? 0 : 4)}%` }}
          transition={{ duration: 0.8, ease: EASE }}
          style={{ background: STATUS_META[status].color }}
        />
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <motion.div className="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="empty-icon">{Icon && <Icon size={24} />}</div>
      <h4>{title}</h4>
      {description && <p>{description}</p>}
      {action}
    </motion.div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="card">
      <div className="empty">
        <div className="empty-icon" style={{ color: 'var(--danger)', background: 'var(--danger-50)', borderColor: '#fecaca' }}>
          <WifiOff size={24} />
        </div>
        <h4>Gagal memuat data</h4>
        <p>{message}</p>
        {onRetry && (
          <button className="btn btn-secondary" onClick={onRetry}>
            <RefreshCw size={16} /> Coba lagi
          </button>
        )}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div style={{ padding: 16 }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="row" style={{ gap: 16, padding: '10px 0' }}>
          {Array.from({ length: cols }).map((__, c) => (
            <div key={c} className="skeleton" style={{ height: 14, flex: c === 0 ? 2 : 1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Tampilkan halaman hanya jika peran pengguna punya akses. */
export function Guard({ perm, children }) {
  const { can } = useAuth();
  if (can(perm)) return children;
  return (
    <div className="card">
      <div className="empty">
        <div className="empty-icon"><Lock size={24} /></div>
        <h4>Akses dibatasi</h4>
        <p>Halaman ini tidak tersedia untuk peran Anda. Hubungi Owner toko jika Anda membutuhkan akses.</p>
      </div>
    </div>
  );
}
