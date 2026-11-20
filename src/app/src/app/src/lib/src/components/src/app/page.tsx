'use client';

import { useEffect, useMemo, useState } from 'react';
import Sparkline from '@/components/Sparkline';
import {
  CurrencyCode,
  DailySnapshot,
  formatMarketCap,
  formatPrice,
  getCountryFlag,
} from '@/lib/marketcap';

const R2_BASE =
  process.env.NEXT_PUBLIC_R2_BASE_URL ||
  'https://pub-abab619513474306a997568b43202499.r2.dev';

function getTodayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function HomePage() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayUtcDate());
  const [snapshot, setSnapshot] = useState<DailySnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [assetFilter, setAssetFilter] = useState<'ALL' | 'STOCK' | 'ETF' | 'CRYPTO'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 100;

  useEffect(() => {
    let cancelled = false;
    async function loadSnapshot() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${R2_BASE}/snapshots/rankings/${selectedDate}.json`);
        if (!res.ok) {
          throw new Error(`해당 날짜(${selectedDate})의 스냅샷 데이터가 없습니다.`);
        }
        const data: DailySnapshot = await res.json();
        if (!cancelled) {
          setSnapshot(data);
          setPage(1);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '데이터를 불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const filteredRankings = useMemo(() => {
    if (!snapshot) return [];
    const q = searchQuery.trim().toLowerCase();
    return snapshot.rankings.filter((item) => {
      if (assetFilter !== 'ALL' && item.asset_type !== assetFilter) return false;
      if (!q) return true;
      return (
        item.ticker.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.country_code.toLowerCase().includes(q)
      );
    });
  }, [snapshot, assetFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRankings.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRankings.slice(start, start + pageSize);
  }, [filteredRankings, page]);

  const fxRates = snapshot?.fx_rates || { USD: 1 };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>🌍 Global MarketCap Tracker</span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                LIVE
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              글로벌 주식 · ETF · 암호화폐 통합 시가총액 순위 및 365일 히스토리
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-slate-800 p-1 border border-slate-700">
              {(['USD', 'KRW', 'EUR', 'JPY', 'CNY'] as CurrencyCode[]).map((curr) => (
                <button
                  key={curr}
                  onClick={() => setCurrency(curr)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                    currency === curr
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1">
              <span className="text-xs text-slate-400">📅 기준일</span>
              <input
                type="date"
                value={selectedDate}
                max={getTodayUtcDate()}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-medium text-white focus:outline-none"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
            <div className="text-xs text-slate-400">추적 자산 총 시가총액 ({currency})</div>
            <div className="text-2xl font-bold text-white mt-1">
              {snapshot
                ? formatMarketCap(snapshot.total_market_cap_usd, currency, fxRates)
                : '계산 중...'}
            </div>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
            <div className="text-xs text-slate-400">집계 자산 수</div>
            <div className="text-2xl font-bold text-white mt-1">
              {snapshot ? `${snapshot.total_assets.toLocaleString()} 개` : '-'}
            </div>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
            <div className="text-xs text-slate-400">스냅샷 기준일자 (UTC)</div>
            <div className="text-2xl font-bold text-indigo-400 mt-1">
              {snapshot?.date || selectedDate}
            </div>
          </div>
        </section>

        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'ALL', label: '전체 자산' },
              { id: 'STOCK', label: '주식 (Stocks)' },
              { id: 'ETF', label: 'ETF' },
              { id: 'CRYPTO', label: '암호화폐 (Crypto)' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setAssetFilter(tab.id as typeof assetFilter);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  assetFilter === tab.id
                    ? 'bg-slate-100 text-slate-900 border-slate-100'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="종목명, 티커(AAPL, BTC), 국가 검색..."
              className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </section>

        <section className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
          {loading ? (
            <div className="py-20 text-center text-sm text-slate-400">
              스냅샷 데이터를 불러오는 중입니다...
            </div>
          ) : error ? (
            <div className="py-16 text-center space-y-3 px-4">
              <p className="text-sm text-rose-400">{error}</p>
              <button
                onClick={() => setSelectedDate(getTodayUtcDate())}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                오늘 날짜로 돌아가기
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-4 w-16 text-center">순위</th>
                    <th className="py-3.5 px-4">자산명 / 티커</th>
                    <th className="py-3.5 px-4 text-right">시가총액 ({currency})</th>
                    <th className="py-3.5 px-4 text-right">현재가 ({currency})</th>
                    <th className="py-3.5 px-4 text-right">24h 등락</th>
                    <th className="py-3.5 px-4 text-center hidden md:table-cell">국가</th>
                    <th className="py-3.5 px-4 text-right hidden sm:table-cell">최근 30일 추이</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-sm">
                  {paginatedRows.map((item) => {
                    const isPos = item.change_pct >= 0;
                    return (
                      <tr
                        key={`${item.asset_type}-${item.ticker}`}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3.5 px-4 text-center font-semibold text-slate-300">
                          {item.rank}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            {item.logo_path ? (
                              <img
                                src={item.logo_path}
                                alt={item.ticker}
                                className="w-7 h-7 rounded-full bg-slate-800 object-contain p-0.5 shrink-0"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                                {item.ticker.slice(0, 2)}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-white leading-tight">
                                {item.name}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs font-mono text-slate-400">
                                  {item.ticker}
                                </span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                    item.asset_type === 'CRYPTO'
                                      ? 'bg-amber-500/15 text-amber-400'
                                      : item.asset_type === 'ETF'
                                      ? 'bg-sky-500/15 text-sky-400'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {item.asset_type}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-white tabular-nums">
                          {formatMarketCap(item.market_cap_usd, currency, fxRates)}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-200 tabular-nums">
                          {formatPrice(item.price_usd, currency, fxRates)}
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-medium tabular-nums ${
                            isPos ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isPos ? `+${item.change_pct.toFixed(2)}%` : `${item.change_pct.toFixed(2)}%`}
                        </td>
                        <td className="py-3.5 px-4 text-center text-xs text-slate-300 hidden md:table-cell">
                          <span className="mr-1">{getCountryFlag(item.country_code, item.asset_type)}</span>
                          {item.country_code}
                        </td>
                        <td className="py-3.5 px-4 text-right hidden sm:table-cell">
                          <Sparkline data={item.sparkline_30d} positive={isPos} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && filteredRankings.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-900/60 text-xs text-slate-400">
              <span>
                총 {filteredRankings.length.toLocaleString()}개 중{' '}
                {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, filteredRankings.length)}위 표시
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700"
                >
                  이전
                </button>
                <span className="text-slate-300 font-medium">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 rounded bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700"
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
