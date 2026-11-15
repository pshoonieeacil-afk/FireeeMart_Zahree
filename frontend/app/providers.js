'use client';

import { MotionConfig } from 'framer-motion';
import { ToastProvider } from '@/components/Toast';

export default function Providers({ children }) {
  // reducedMotion="user": animasi otomatis dimatikan jika perangkat diatur "kurangi gerakan"
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
      <ToastProvider>{children}</ToastProvider>
    </MotionConfig>
  );
}
