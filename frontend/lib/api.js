// Default: lewat proxy Next.js (/api -> BACKEND_URL). Bisa di-override bila perlu.
export const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

let redirecting = false;

/** Pemanggil REST API backend. Melempar Error dengan pesan berbahasa Indonesia. */
export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
      cache: 'no-store',
    });
  } catch {
    throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet atau pastikan backend berjalan.');
  }

  const data = await res.json().catch(() => ({}));

  // Sesi habis / belum login -> bersihkan cookie lalu kembali ke halaman login
  if (res.status === 401 && !path.startsWith('/auth/') && typeof window !== 'undefined' && !redirecting) {
    redirecting = true;
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    const next = window.location.pathname === '/' ? '' : `?next=${encodeURIComponent(window.location.pathname)}`;
    window.location.href = `/login${next}`;
  }

  if (!res.ok) {
    const err = new Error(
      data.message || (res.status >= 500 ? 'Server sedang bermasalah. Coba lagi beberapa saat.' : `Terjadi kesalahan (${res.status})`)
    );
    err.status = res.status;
    throw err;
  }
  return data;
}
