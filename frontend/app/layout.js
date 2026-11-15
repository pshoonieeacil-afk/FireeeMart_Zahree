import './globals.css';
import Providers from './providers';

export const metadata = {
  title: { default: 'FireeeMart — Your Daily Needs, One Click Away', template: '%s · FireeeMart' },
  description: 'FireeeMart: aplikasi inventori & kas toko sembako. Stok dan kas tercatat rapi, selalu sesuai kondisi sebenarnya.',
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#5C0F21' };

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
