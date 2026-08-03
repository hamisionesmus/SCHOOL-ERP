import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from './providers';
import { BuiltByWatermark } from '@/components/built-by-watermark';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// Server-side fetch so the favicon is present on the very first response — a client-side swap
// would flash the default icon first. Falls back to no custom icon (Next's own default) on any
// fetch failure, same graceful-degradation as every other branding fetch in this codebase.
export async function generateMetadata(): Promise<Metadata> {
  const base: Metadata = {
    title: 'School ERP',
    description: 'Kenyan CBC School Management ERP',
  };
  try {
    const res = await fetch(`${API_URL}/public/branding`, { next: { revalidate: 60 } });
    if (!res.ok) return base;
    const data = (await res.json()) as { faviconUrl?: string | null };
    if (!data.faviconUrl) return base;
    const iconUrl = data.faviconUrl.startsWith('http') ? data.faviconUrl : `${API_URL}${data.faviconUrl}`;
    return { ...base, icons: { icon: iconUrl } };
  } catch {
    return base;
  }
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50`}>
        <Providers>{children}</Providers>
        <BuiltByWatermark />
      </body>
    </html>
  );
}
