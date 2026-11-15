import { NextResponse } from 'next/server';

/**
 * Pengaman rute: halaman aplikasi hanya bisa dibuka jika ada cookie login.
 * Validasi token sebenarnya tetap dilakukan backend; jika token kedaluwarsa,
 * frontend otomatis logout dan kembali ke halaman login.
 */
export function middleware(req) {
  const hasToken = !!req.cookies.get('fm_token')?.value;
  const { pathname, search } = req.nextUrl;
  const isLogin = pathname === '/login';

  if (!hasToken && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if (hasToken && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)'],
};
