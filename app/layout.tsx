import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
