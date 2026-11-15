import { Flame, ShoppingBag } from 'lucide-react';

export const APP_NAME = 'FireeeMart';
export const TAGLINE = 'Your Daily Needs, One Click Away';

export function LogoMark({ size = 20 }) {
  return (
    <div className="logo" aria-hidden="true">
      <ShoppingBag size={size} strokeWidth={2.2} />
      <span className="logo-flame"><Flame size={11} strokeWidth={2.6} fill="currentColor" /></span>
    </div>
  );
}

export default function Logo() {
  return (
    <>
      <LogoMark />
      <div style={{ minWidth: 0 }}>
        <div className="brand-name">{APP_NAME}</div>
        <div className="brand-sub">{TAGLINE}</div>
      </div>
    </>
  );
}
