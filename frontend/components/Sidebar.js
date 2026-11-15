'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeftRight, ClipboardCheck, KeyRound, LayoutDashboard, LogOut, Menu, Package, Tags, UsersRound, Wallet, X,
} from 'lucide-react';
import Logo from './Logo';
import { useAuth } from './AuthProvider';
import ChangePasswordModal from './ChangePasswordModal';
import { ROLE_META } from '@/lib/permissions';
import { initials } from '@/lib/format';

const NAV = [
  { section: 'Ringkasan' },
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { section: 'Inventori' },
  { href: '/produk', label: 'Produk', icon: Package },
  { href: '/kategori', label: 'Kategori', icon: Tags },
  { href: '/stok', label: 'Stok Masuk & Keluar', icon: ArrowLeftRight },
  { href: '/opname', label: 'Stock Opname', icon: ClipboardCheck, perm: 'opname' },
  { section: 'Keuangan', perm: 'cash.view' },
  { href: '/kas', label: 'Kas', icon: Wallet, perm: 'cash.view' },
  { section: 'Pengaturan', perm: 'users' },
  { href: '/pengguna', label: 'Pengguna', icon: UsersRound, perm: 'users' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, can, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const items = NAV.filter((item) => !item.perm || can(item.perm));

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Buka menu">
          <Menu size={20} />
        </button>
        <div className="row" style={{ gap: 9 }}>
          <Logo />
        </div>
      </header>
      <div className={`backdrop ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <Logo />
          <button className="sidebar-close" onClick={() => setOpen(false)} aria-label="Tutup menu">
            <X size={20} />
          </button>
        </div>

        <nav style={{ overflowY: 'auto' }}>
          {items.map((item) =>
            item.section ? (
              <div key={item.section} className="nav-label">{item.section}</div>
            ) : (
              <Link key={item.href} href={item.href} className={`nav-link ${isActive(item.href) ? 'active' : ''}`}>
                {isActive(item.href) && (
                  <motion.span layoutId="nav-active" className="nav-active" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />
                )}
                <item.icon size={18} />
                <span>{item.label}</span>
              </Link>
            )
          )}
        </nav>

        <div className="sidebar-user">
          <div className="avatar">{initials(user.name)}</div>
          <div className="who">
            <strong title={user.name}>{user.name}</strong>
            <small>{ROLE_META[user.role]?.label} · @{user.username}</small>
          </div>
          <button className="icon-btn" title="Ganti password" aria-label="Ganti password" onClick={() => setPwOpen(true)}>
            <KeyRound size={16} />
          </button>
          <button className="icon-btn" title="Keluar" aria-label="Keluar" onClick={logout}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </>
  );
}
