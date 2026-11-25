import HistoryChart2000 from '@/components/HistoryChart2000';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-bold">2000년 이후 히스토리 차트</h1>
      <HistoryChart2000 ticker="AAPL" />
    </main>
  );
}
