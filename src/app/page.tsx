'use client';

import { useMemo, useState } from 'react';
import HistoryChart2000 from '@/components/HistoryChart2000';

interface AssetItem {
  ticker: string;
  name: string;
  sector: string;
}

const FEATURED_ASSETS: AssetItem[] = [
  { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
  { ticker: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology' },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', sector: 'Semiconductors' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', sector: 'Internet & Media' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', sector: 'E-Commerce & Cloud' },
  { ticker: 'META', name: 'Meta Platforms Inc.', sector: 'Social & Media' },
  { ticker: 'TSLA', name: 'Tesla Inc.', sector: 'EV & Energy' },
  { ticker: 'BRK-B', name: 'Berkshire Hathaway', sector: 'Financials' },
];

export default function HomePage() {
  const [selectedTicker, setSelectedTicker] = useState<string>('AAPL');
  const [query, setQuery] = useState<string>('');

  const filteredAssets = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return FEATURED_ASSETS;
    return FEATURED_ASSETS.filter(
      (item) =>
        item.ticker.toUpperCase().includes(q) ||
        item.name.toUpperCase().includes(q) ||
        item.sector.toUpperCase().includes(q)
    );
  }, [query]);

  const selectedAsset = useMemo(
    () =>
      FEATURED_ASSETS.find((item) => item.ticker === selectedTicker) || {
        ticker: selectedTicker,
        name: selectedTicker,
        sector: 'Equity',
      },
    [selectedTicker]
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              종목별 시가총액 & 히스토리 차트
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              종목을 선택하면 2000년 이후 시가총액 및 주가 추이 차트를 확인할 수 있습니다.
            </p>
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="티커 또는 종목명 검색 (예: AAPL, NVDA)"
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none sm:w-72"
          />
        </div>

        {/* 1. 여러 종목 선택 리스트 */}
        <section className="mb-8">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            종목 목록 ({filteredAssets.length}개)
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {filteredAssets.map((asset) => {
              const isSelected = asset.ticker === selectedTicker;
              return (
                <button
                  key={asset.ticker}
                  type="button"
                  onClick={() => setSelectedTicker(asset.ticker)}
                  className={`flex flex-col items-start rounded-xl border p-4 text-left transition ${
                    isSelected
                      ? 'border-blue-500 bg-blue-950/50 ring-1 ring-blue-500'
                      : 'border-slate-800 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-base font-bold text-white">
                      {asset.ticker}
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                      {asset.sector}
                    </span>
                  </div>
                  <span className="mt-1.5 line-clamp-1 text-xs text-slate-400">
                    {asset.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. 선택한 종목의 차트 영역 */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-lg font-bold text-white">
                {selectedAsset.ticker}
              </span>
              <span className="text-sm text-slate-400">{selectedAsset.name}</span>
            </div>
            <span className="text-xs text-slate-500">
              출처: Cloudflare R2 (snapshots/history/{selectedAsset.ticker}.json)
            </span>
          </div>

          <HistoryChart2000 ticker={selectedAsset.ticker} />
        </section>
      </div>
    </main>
  );
}
