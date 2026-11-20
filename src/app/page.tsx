'use client';

import { useEffect, useMemo, useState } from 'react';

interface RankingItem {
  rank: number;
  ticker: string;
  name: string;
  asset_type: 'STOCK' | 'ETF' | 'CRYPTO';
  country_code: string;
  logo_path: string | null;
  market_cap_usd: number;
  price_usd: number;
  change_pct: number;
  sparkline_30d: number[];
}

interface DailySnapshot {
  date: string;
  total_assets: number;
  total_market_cap_usd: number;
  fx_rates: Record<string, number>;
  rankings: RankingItem[];
}

interface HistoryPoint {
  date: string;
  price_usd: number;
  market_cap_usd: number;
  rank: number;
}

type CurrencyCode = 'USD' | 'KRW' | 'EUR' | 'JPY' | 'CNY';

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  KRW: '₩',
  EUR: '€',
  JPY: '¥',
  CNY: '¥',
};

const R2_BASE =
  process.env.NEXT_PUBLIC_R2_BASE_URL ||
  'https://pub-abab619513474306a997568b43202499.r2.dev';

function getTodayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getPastDates(baseDateStr: string, days: number, step: number): string[] {
  const base = new Date(`${baseDateStr}T00:00:00Z`);
  const list: string[] = [];
  for (let d = days; d >= 0; d -= step) {
    const dt = new Date(base.getTime() - d * 86400 * 1000);
    list.push(dt.toISOString().slice(0, 10));
  }
  if (list[list.length - 1] !== baseDateStr) list.push(baseDateStr);
  return list;
}

function convertFromUsd(
  amountUsd: number,
  currency: CurrencyCode,
  fxRates: Record<string, number>
): number {
  if (currency === 'USD') return amountUsd;
  const usdPerUnit = fxRates?.[currency];
  if (!usdPerUnit || usdPerUnit <= 0) return amountUsd;
  return amountUsd / usdPerUnit;
}

function formatMarketCap(
  amountUsd: number,
  currency: CurrencyCode,
  fxRates: Record<string, number>
): string {
  const val = convertFromUsd(amountUsd, currency, fxRates);
  const sym = CURRENCY_SYMBOLS[currency];

  if (currency === 'KRW') {
    const jo = val / 1e12;
    if (jo >= 1) return `${sym}${jo.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}조`;
    const eok = val / 1e8;
    return `${sym}${eok.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}억`;
  }

  if (val >= 1e12) return `${sym}${(val / 1e12).toFixed(3)} T`;
  if (val >= 1e9) return `${sym}${(val / 1e9).toFixed(2)} B`;
  if (val >= 1e6) return `${sym}${(val / 1e6).toFixed(2)} M`;
  return `${sym}${val.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function formatPrice(
  priceUsd: number,
  currency: CurrencyCode,
  fxRates: Record<string, number>
): string {
  const val = convertFromUsd(priceUsd, currency, fxRates);
  const sym = CURRENCY_SYMBOLS[currency];

  if (currency === 'KRW' || currency === 'JPY') {
    return `${sym}${Math.round(val).toLocaleString('en-US')}`;
  }
  return `${sym}${val.toLocaleString('en-US', {
    minimumFractionDigits: val < 1 ? 4 : 2,
    maximumFractionDigits: val < 1 ? 4 : 2,
  })}`;
}

function getCountryFlag(countryCode: string, assetType: string): string {
  if (assetType === 'CRYPTO' || !countryCode || countryCode.toUpperCase() === 'GLOBAL') return '🌐';
  const codePoints = countryCode
    .trim()
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) {
    return <span className="text-xs text-slate-400">-</span>;
  }

  const width = 108;
  const height = 32;
  const padding = 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, idx) => {
      const x = padding + (idx / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((val - min) / range) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const strokeColor = positive ? '#10b981' : '#ef4444';

  return (
    <svg width={width} height={height} className="overflow-visible inline-block">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

/** 종목 상세 인터랙티브 라인/영역 차트 */
function DetailedAreaChart({
  points,
  metric,
  currency,
  fxRates,
}: {
  points: HistoryPoint[];
  metric: 'market_cap_usd' | 'price_usd' | 'rank';
  currency: CurrencyCode;
  fxRates: Record<string, number>;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-400">
        차트를 그릴 과거 스냅샷 데이터가 부족합니다.
      </div>
    );
  }

  const width = 680;
  const height = 240;
  const padX = 16;
  const padY = 20;

  const values = points.map((p) => p[metric]);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const coords = points.map((p, idx) => {
    const x = padX + (idx / (points.length - 1)) * (width - padX * 2);
    const ratio =
      metric === 'rank'
        ? (maxVal - p[metric]) / range
        : (p[metric] - minVal) / range;
    const y = height - padY - ratio * (height - padY * 2);
    return { x, y, point: p };
  });

  const linePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPoints = `${coords[0].x.toFixed(1)},${height - padY} ${linePoints} ${coords[
    coords.length - 1
  ].x.toFixed(1)},${height - padY}`;

  const isUp =
    metric === 'rank'
      ? points[points.length - 1].rank <= points[0].rank
      : points[points.length - 1][metric] >= points[0][metric];
  const stroke = isUp ? '#10b981' : '#f43f5e';

  const active = hoverIdx !== null ? coords[hoverIdx] : coords[coords.length - 1];

  const formatMetric = (p: HistoryPoint) => {
    if (metric === 'market_cap_usd') return formatMarketCap(p.market_cap_usd, currency, fxRates);
    if (metric === 'price_usd') return formatPrice(p.price_usd, currency, fxRates);
    return `#${p.rank}위`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between bg-slate-950/60 border border-slate-800 rounded-lg px-4 py-2.5">
        <div>
          <span className="text-xs text-slate-400 mr-2">{active.point.date}</span>
          <span className="text-lg font-bold text-white">{formatMetric(active.point)}</span>
        </div>
        <div className="text-xs text-slate-400">
          순위 <span className="text-slate-200 font-semibold">#{active.point.rank}</span> · 주가{' '}
          <span className="text-slate-200 font-semibold">
            {formatPrice(active.point.price_usd, currency, fxRates)}
          </span>
        </div>
      </div>

      <div className="relative w-full overflow-hidden rounded-xl bg-slate-950/50 border border-slate-800 p-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-60 select-none cursor-crosshair"
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          <polygon points={areaPoints} fill="url(#chartGrad)" />
          <polyline
            fill="none"
            stroke={stroke}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={linePoints}
          />

          {active && (
            <>
              <line
                x1={active.x}
                y1={padY}
                x2={active.x}
                y2={height - padY}
                stroke="#475569"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <circle cx={active.x} cy={active.y} r="4.5" fill={stroke} stroke="#0f172a" strokeWidth="2" />
            </>
          )}

          {coords.map((c, idx) => {
            const sliceW = (width - padX * 2) / coords.length;
            return (
              <rect
                key={c.point.date}
                x={c.x - sliceW / 2}
                y={0}
                width={Math.max(sliceW, 4)}
                height={height}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(idx)}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayUtcDate());
  const [snapshot, setSnapshot] = useState<DailySnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [assetFilter, setAssetFilter] = useState<'ALL' | 'STOCK' | 'ETF' | 'CRYPTO'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showTopChart, setShowTopChart] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(250);

  // 종목 상세 그래프 모달 상태
  const [selectedAsset, setSelectedAsset] = useState<RankingItem | null>(null);
  const [chartRange, setChartRange] = useState<30 | 90 | 365 | 3650>(90);
  const [chartMetric, setChartMetric] = useState<'market_cap_usd' | 'price_usd' | 'rank'>('market_cap_usd');
  const [historyPoints, setHistoryPoints] = useState<HistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

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

  // 종목 클릭 시 과거 R2 일자별 스냅샷에서 시계열 추출
  useEffect(() => {
    if (!selectedAsset) return;
    let cancelled = false;

    async function loadAssetHistory() {
      setHistoryLoading(true);
      const step = chartRange === 30 ? 1 : chartRange === 90 ? 3 : chartRange === 365 ? 10 : 90;
      const dates = getPastDates(selectedDate, chartRange, step);

      const results = await Promise.all(
        dates.map(async (d) => {
          try {
            const res = await fetch(`${R2_BASE}/snapshots/rankings/${d}.json`);
            if (!res.ok) return null;
            const snap: DailySnapshot = await res.json();
            const found = snap.rankings.find(
              (r) => r.ticker === selectedAsset?.ticker && r.asset_type === selectedAsset?.asset_type
            );
            if (!found) return null;
            return {
              date: d,
              price_usd: found.price_usd,
              market_cap_usd: found.market_cap_usd,
              rank: found.rank,
            } as HistoryPoint;
          } catch {
            return null;
          }
        })
      );

      if (!cancelled) {
        setHistoryPoints(results.filter((x): x is HistoryPoint => x !== null));
        setHistoryLoading(false);
      }
    }

    loadAssetHistory();
    return () => {
      cancelled = true;
    };
  }, [selectedAsset, chartRange, selectedDate]);

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

  const top10ForBarChart = useMemo(() => filteredRankings.slice(0, 10), [filteredRankings]);
  const maxTop10Mcap = top10ForBarChart[0]?.market_cap_usd || 1;

  const totalPages = Math.max(1, Math.ceil(filteredRankings.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRankings.slice(start, start + pageSize);
  }, [filteredRankings, page, pageSize]);

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
              종목을 클릭하면 30일 · 90일 · 365일 · 10년 시가총액 및 순위 변동 그래프를 볼 수 있습니다
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

        {/* Top 10 시가총액 비교 막대 그래프 */}
        {!loading && !error && top10ForBarChart.length > 0 && (
          <section className="rounded-xl bg-slate-900 border border-slate-800 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-white">
                  📊 Top 10 시가총액 비교 그래프 ({assetFilter === 'ALL' ? '전체 자산' : assetFilter})
                </h2>
                <p className="text-xs text-slate-400">
                  막대를 클릭하면 해당 종목의 30일 · 90일 · 365일 · 10년 추이 차트가 열립니다
                </p>
              </div>
              <button
                onClick={() => setShowTopChart((v) => !v)}
                className="text-xs px-3 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
              >
                {showTopChart ? '그래프 접기 ▲' : '그래프 펼치기 ▼'}
              </button>
            </div>

            {showTopChart && (
              <div className="space-y-2.5 pt-2">
                {top10ForBarChart.map((item, idx) => {
                  const widthPct = Math.max(4, (item.market_cap_usd / maxTop10Mcap) * 100);
                  const isPos = item.change_pct >= 0;
                  return (
                    <button
                      key={`bar-${item.asset_type}-${item.ticker}`}
                      onClick={() => setSelectedAsset(item)}
                      className="w-full text-left group flex items-center gap-3 hover:bg-slate-800/40 p-1.5 rounded-lg transition"
                    >
                      <div className="w-6 text-xs font-bold text-slate-400 text-right">
                        {idx + 1}
                      </div>
                      <div className="w-28 sm:w-40 truncate">
                        <span className="text-xs font-semibold text-white group-hover:text-indigo-400">
                          {item.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 ml-1.5">
                          {item.ticker}
                        </span>
                      </div>
                      <div className="flex-1 h-5 bg-slate-950 rounded-md overflow-hidden p-0.5">
                        <div
                          style={{ width: `${widthPct}%` }}
                          className={`h-full rounded transition-all duration-300 ${
                            item.asset_type === 'CRYPTO'
                              ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                              : item.asset_type === 'ETF'
                              ? 'bg-gradient-to-r from-sky-500 to-cyan-400'
                              : 'bg-gradient-to-r from-indigo-600 to-violet-500'
                          }`}
                        />
                      </div>
                      <div className="w-24 sm:w-28 text-right text-xs font-semibold text-white tabular-nums">
                        {formatMarketCap(item.market_cap_usd, currency, fxRates)}
                      </div>
                      <div
                        className={`w-14 text-right text-xs font-medium tabular-nums hidden sm:block ${
                          isPos ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isPos ? `+${item.change_pct.toFixed(1)}%` : `${item.change_pct.toFixed(1)}%`}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* 필터 · 표시 개수 · 검색 바 */}
        <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
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

            <div className="flex items-center gap-1 rounded-lg bg-slate-900 border border-slate-800 px-2 py-1 text-xs">
              <span className="text-slate-400 mr-1">표시:</span>
              {[100, 250, 500].map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    setPageSize(size);
                    setPage(1);
                  }}
                  className={`px-2 py-0.5 rounded font-semibold transition ${
                    pageSize === size
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {size}개
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full lg:w-72">
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

        {/* 메인 시가총액 순위 테이블 */}
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
                    <th className="py-3.5 px-4">자산명 / 티커 (클릭 시 상세 차트)</th>
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
                    const cleanCountry = (item.country_code || 'US').trim().toUpperCase();
                    return (
                      <tr
                        key={`${item.asset_type}-${item.ticker}`}
                        onClick={() => setSelectedAsset(item)}
                        className="hover:bg-slate-800/60 transition-colors cursor-pointer"
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
                              <div className="font-semibold text-white leading-tight hover:text-indigo-400">
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
                          <span className="mr-1">{getCountryFlag(cleanCountry, item.asset_type)}</span>
                          {cleanCountry}
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

      {/* 종목 상세 히스토리 그래프 모달 */}
      {selectedAsset && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedAsset(null)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-700 p-5 sm:p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg sm:text-xl font-bold text-white">{selectedAsset.name}</h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {selectedAsset.ticker}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  현재 글로벌 순위 #{selectedAsset.rank}위 · 시가총액{' '}
                  {formatMarketCap(selectedAsset.market_cap_usd, currency, fxRates)}
                </p>
              </div>
              <button
                onClick={() => setSelectedAsset(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:text-white"
              >
                닫기 ✕
              </button>
            </div>

            {/* 지표 및 기간 선택 컨트롤 */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                {[
                  { id: 'market_cap_usd', label: '시가총액 추이' },
                  { id: 'price_usd', label: '주가 추이' },
                  { id: 'rank', label: '글로벌 순위 변동' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setChartMetric(m.id as typeof chartMetric)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      chartMetric === m.id
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                {(
                  [
                    { days: 30, label: '30일' },
                    { days: 90, label: '90일' },
                    { days: 365, label: '365일' },
                    { days: 3650, label: '10년' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.days}
                    onClick={() => setChartRange(item.days)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      chartRange === item.days
                        ? 'bg-slate-200 text-slate-900'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {historyLoading ? (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                과거 스냅샷 데이터를 분석해 차트를 그리는 중입니다...
              </div>
            ) : (
              <DetailedAreaChart
                points={historyPoints}
                metric={chartMetric}
                currency={currency}
                fxRates={fxRates}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
