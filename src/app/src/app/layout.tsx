import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Global MarketCap Tracker | 글로벌 시가총액 순위',
  description: '글로벌 주식 · ETF · 암호화폐 통합 시가총액 순위 및 365일 히스토리',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
