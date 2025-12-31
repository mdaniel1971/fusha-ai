import type { Metadata } from 'next';
import { Amiri } from 'next/font/google';
import './globals.css';

const amiri = Amiri({
  subsets: ['arabic', 'latin'],
  weight: ['400', '700'],
  variable: '--font-amiri',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FushaAI - Learn Quranic Arabic',
  description: 'A personal Quran Arabic tutor you speak with',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={amiri.variable}>
      <body>{children}</body>
    </html>
  );
}
