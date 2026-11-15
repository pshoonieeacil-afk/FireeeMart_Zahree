import { AuthProvider } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';

export default function AppLayout({ children }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
