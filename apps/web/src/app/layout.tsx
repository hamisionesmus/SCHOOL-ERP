import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from './providers';

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

export const metadata: Metadata = {
  title: 'School ERP',
  description: 'Kenyan CBC School Management ERP',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50`}>
        <Providers>{children}</Providers>
        <p className="pointer-events-none fixed bottom-2 right-2 z-[200] select-none text-[11px] font-medium text-slate-400/80">
          Built by Hamzone Technologies
        </p>
      </body>
    </html>
  );
}
