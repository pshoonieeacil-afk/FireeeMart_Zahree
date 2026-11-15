'use client';

import { useAuth } from './AuthProvider';
import Sidebar from './Sidebar';
import { LogoMark } from './Logo';
import { ErrorState } from './ui';

export default function AppShell({ children }) {
  const { user, error, retry } = useAuth();

  if (error) {
    return (
      <div className="splash" style={{ padding: 16 }}>
        <div style={{ maxWidth: 460, width: '100%' }}>
          <ErrorState message={error} onRetry={retry} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="splash" aria-busy="true" aria-label="Memuat FireeeMart">
        <LogoMark size={28} />
      </div>
    );
  }

  return (
    <>
      <Sidebar />
      <main className="main">
        <div className="container">{children}</div>
      </main>
    </>
  );
}
