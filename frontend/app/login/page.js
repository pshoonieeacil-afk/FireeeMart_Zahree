'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import {
  AlertCircle, ArrowRight, ClipboardCheck, Coffee, Droplet, Egg, Eye, EyeOff, Loader2, Lock, Milk, ShieldCheck, User, Wallet, Wheat,
} from 'lucide-react';
import Logo, { APP_NAME } from '@/components/Logo';
import { api } from '@/lib/api';
import { EASE } from '@/components/motion';

const SHOW_DEMO = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS !== 'false';
const DEMO = [
  { username: 'owner', password: 'owner123', label: 'Owner', desc: 'Akses penuh' },
  { username: 'kasir', password: 'kasir123', label: 'Kasir', desc: 'Penjualan & kas' },
  { username: 'gudang', password: 'gudang123', label: 'Gudang', desc: 'Stok & opname' },
];

const CHIPS = [
  { icon: Milk, label: 'Susu Kental', sub: '36 kaleng', style: { top: '5%', right: '24%', '--r': '-2deg', animationDelay: '-3s' } },
  { icon: Wheat, label: 'Beras Premium', sub: '+40 sak masuk', style: { top: '19%', right: '4%', '--r': '4deg' } },
  { icon: Droplet, label: 'Minyak Goreng', sub: 'Stok aman', style: { top: '44%', right: '2%', '--r': '-3deg', animationDelay: '-2s' } },
  { icon: Coffee, label: 'Kopi Sachet', sub: 'Perlu restock', style: { bottom: '24%', right: '7%', '--r': '3deg', animationDelay: '-4s' } },
  { icon: Egg, label: 'Telur Ayam', sub: 'Terjual 10 kg', style: { bottom: '7%', right: '22%', '--r': '-4deg', animationDelay: '-1s' } },
];

const FEATURES = [
  { icon: ClipboardCheck, text: 'Stok tercatat otomatis & bisa diaudit' },
  { icon: Wallet, text: 'Kas langsung terhubung dengan penjualan' },
  { icon: ShieldCheck, text: 'Akses sesuai peran: Owner, Kasir, Gudang' },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: EASE, delay },
});

function safeNext() {
  const next = new URLSearchParams(window.location.search).get('next') || '/';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const shake = useAnimationControls();

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api('/auth/login', { method: 'POST', body: form });
      window.location.replace(safeNext());
    } catch (err) {
      setError(err.message);
      setLoading(false);
      shake.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.45 } });
    }
  }

  const fill = (acc) => {
    setForm({ username: acc.username, password: acc.password });
    setError('');
  };

  return (
    <div className="login">
      <section className="login-hero">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
        <div className="float-chips" aria-hidden="true">
          {CHIPS.map((c, i) => (
            <motion.div
              key={c.label}
              className="float-chip"
              style={c.style}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.5 + i * 0.12 }}
            >
              <i><c.icon size={15} /></i>
              <div>{c.label}<small>{c.sub}</small></div>
            </motion.div>
          ))}
        </div>

        <motion.div className="brand" {...fadeUp(0)}>
          <Logo />
        </motion.div>

        <div className="hero-copy">
          <motion.h1 {...fadeUp(0.1)}>
            Your Daily Needs,<br /><em>One Click Away.</em>
          </motion.h1>
          <motion.p {...fadeUp(0.2)}>
            Kelola stok sembako dan kas toko dalam satu aplikasi. Semua tercatat rapi dan selalu sesuai kondisi sebenarnya.
          </motion.p>
          <div className="hero-features">
            {FEATURES.map((f, i) => (
              <motion.div key={f.text} className="hero-feature" {...fadeUp(0.3 + i * 0.08)}>
                <span><f.icon size={17} /></span>
                {f.text}
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div className="hero-foot" {...fadeUp(0.6)}>© {new Date().getFullYear()} {APP_NAME}. Inventori & kas toko sembako.</motion.div>
      </section>

      <section className="login-panel">
        <motion.div className="login-card" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}>
          <motion.div animate={shake}>
            <h2>Selamat datang kembali</h2>
            <p>Masuk ke akun {APP_NAME} Anda untuk melanjutkan.</p>

            <AnimatePresence>
              {error && (
                <motion.div
                  className="alert alert-danger"
                  role="alert"
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 14 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                >
                  <AlertCircle size={16} /> {error}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor="username">Username</label>
                <div className="input-icon">
                  <User size={17} />
                  <input
                    id="username" className="input" placeholder="mis. kasir" autoComplete="username" autoCapitalize="none"
                    value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required autoFocus
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="password">Password</label>
                <div className="input-icon">
                  <Lock size={17} />
                  <input
                    id="password" className="input" type={showPw ? 'text' : 'password'} placeholder="••••••••" autoComplete="current-password"
                    value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required style={{ paddingRight: 46 }}
                  />
                  <button type="button" className="icon-btn input-action" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}>
                    {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <button type="submit" className="btn btn-gradient btn-lg btn-block mt-2" disabled={loading}>
                {loading ? <Loader2 size={18} className="spin" /> : null}
                {loading ? 'Memproses…' : 'Masuk'}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>
          </motion.div>

          {SHOW_DEMO && (
            <motion.div className="demo-box" {...fadeUp(0.4)}>
              <small>Coba dengan akun demo (klik untuk mengisi):</small>
              <div className="demo-accounts">
                {DEMO.map((d) => (
                  <button key={d.username} type="button" onClick={() => fill(d)}>
                    <strong>{d.label}</strong>
                    <small>{d.desc}</small>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      </section>
    </div>
  );
}
