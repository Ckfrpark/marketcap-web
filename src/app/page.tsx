'use client';

import React, { useEffect, useMemo, useState } from 'react';

type AssetType = 'STOCK' | 'ETF' | 'CRYPTO';
type CurrencyCode = 'USD' | 'KRW' | 'EUR' | 'JPY' | 'CNY';

type RankMetricKey =
  | 'market_cap_usd'
  | 'earnings_usd'
  | 'revenue_usd'
  | 'employees'
  | 'pe_ratio'
  | 'dividend_yield'
  | 'operating_margin'
  | 'total_assets_usd'
  | 'net_assets_usd'
  | 'total_liabilities_usd'
  | 'total_debt_usd'
  | 'total_cash_usd'
  | 'pb_ratio';

interface MetricOption {
  key: RankMetricKey;
  label: string;
  columnTitle: string;
  kind: 'money' | 'integer' | 'ratio' | 'percent';
}

interface RankingItem {
  rank: number;
  ticker: string;
  name: string;
  asset_type: AssetType;
  country_code: string;
  logo_path: string | null;
  market_cap_usd: number;
  price_usd: number;
  change_pct: number;
  sparkline_30d: number[];
  sector?: string;
  industry?: string;
  revenue_usd?: number | null;
  earnings_usd?: number | null;
  employees?: number | null;
  pe_ratio?: number | null;
  dividend_yield?: number | null;
  operating_margin?: number | null;
  total_assets_usd?: number | null;
  total_liabilities_usd?: number | null;
  net_assets_usd?: number | null;
  total_debt_usd?: number | null;
  total_cash_usd?: number | null;
  pb_ratio?: number | null;
}

interface DailySnapshot {
  date: string;
  total_assets: number;
  total_market_cap_usd: number;
  fx_rates: Record<string, number>;
  rankings: RankingItem[];
}

const DEFAULT_R2_BASE_URL =
  'https://pub-abab619513474306a997568b43202499.r2.dev';

const R2_BASE_URL = (
  process.env.NEXT_PUBLIC_R2_BASE_URL || DEFAULT_R2_BASE_URL
).replace(/\/+$/, '');

const CURRENCY_BUTTONS: CurrencyCode[] = ['USD', 'KRW', 'EUR', 'JPY', 'CNY'];

const DEFAULT_FX_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  KRW: 1350,
  EUR: 0.92,
  JPY: 150,
  CNY: 7.2,
};

const RANK_METRICS: MetricOption[] = [
  { key: 'market_cap_usd', label: 'Market Cap', columnTitle: '시가총액', kind: 'money' },
  { key: 'earnings_usd', label: 'Earnings', columnTitle: '순이익 (TTM)', kind: 'money' },
  { key: 'revenue_usd', label: 'Revenue', columnTitle: '매출 (TTM)', kind: 'money' },
  { key: 'employees', label: 'Employees', columnTitle: '직원 수', kind: 'integer' },
  { key: 'pe_ratio', label: 'P/E ratio', columnTitle: 'P/E ratio', kind: 'ratio' },
  { key: 'dividend_yield', label: 'Dividend %', columnTitle: '배당수익률', kind: 'percent' },
  { key: 'operating_margin', label: 'Operating Margin', columnTitle: '영업이익률', kind: 'percent' },
  { key: 'total_assets_usd', label: 'Total assets', columnTitle: '총자산', kind: 'money' },
  { key: 'net_assets_usd', label: 'Net assets', columnTitle: '순자산', kind: 'money' },
  { key: 'total_liabilities_usd', label: 'Total liabilities', columnTitle: '총부채(부채총계)', kind: 'money' },
  { key: 'total_debt_usd', label: 'Total debt', columnTitle: '총차입부채', kind: 'money' },
  { key: 'total_cash_usd', label: 'Cash on hand', columnTitle: '현금성자산', kind: 'money' },
  { key: 'pb_ratio', label: 'Price to Book', columnTitle: 'PBR', kind: 'ratio' },
];

const CATEGORIES = [
  'All Categories',
  'Technology',
  'Semiconductors',
  'Financials',
  'Healthcare',
  'Consumer',
  'Energy',
  'Industrials',
  'Exchange Traded Fund',
  'Cryptocurrency',
];

function normalizeFxRate(
  currency: CurrencyCode,
  fxRates: Record<string, number> | undefined
): number {
  if (currency === 'USD') return 1;
  const raw = Number(fxRates?.[currency]);
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_FX_RATES[currency];
  }
  if (raw < 1) {
    return 1 / raw;
  }
  return raw;
}

function convertUsdToCurrency(
  amountUsd: number,
  currency: CurrencyCode,
  fxRates: Record<string, number> | undefined
): number {
  const safeUsd = Number(amountUsd || 0);
  if (!Number.isFinite(safeUsd) || safeUsd === 0) return 0;
  if (currency === 'USD') return safeUsd;
  return safeUsd * normalizeFxRate(currency, fxRates);
}

function formatBil(amountUsd: number): string {
  const bil = Number(amountUsd || 0) / 1e9;
  if (!Number.isFinite(bil)) return '$0.0 bil';
  if (Math.abs(bil) >= 10) {
    return `$${Math.round(bil).toLocaleString('en-US')} bil`;
  }
  return `$${bil.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} bil`;
}

function formatMoneyMetric(
  amountUsd: number | null | undefined,
  currency: CurrencyCode,
  fxRates: Record<string, number> | undefined
): string {
  if (amountUsd === null || amountUsd === undefined || !Number.isFinite(Number(amountUsd))) {
    return '-';
  }
  const numUsd = Number(amountUsd);
  if (currency === 'USD') {
    return formatBil(numUsd);
  }

  const converted = convertUsdToCurrency(numUsd, currency, fxRates);

  if (currency === 'KRW') {
    const jo = converted / 1_000_000_000_000;
    if (Math.abs(jo) >= 1) {
      return `₩${Math.round(jo).toLocaleString('ko-KR')}조`;
    }
    const eok = converted / 100_000_000;
    return `₩${Math.round(eok).toLocaleString('ko-KR')}억`;
  }

  if (currency === 'JPY') {
    const cho = converted / 1_000_000_000_000;
    if (Math.abs(cho) >= 1) {
      return `¥${Math.round(cho).toLocaleString('en-US')}조`;
    }
    const oku = converted / 100_000_000;
    return `¥${Math.round(oku).toLocaleString('en-US')}억`;
  }

  const symbol = currency === 'EUR' ? '€' : '¥';
  if (Math.abs(converted) >= 1e12) return `${symbol}${(converted / 1e12).toFixed(2)}T`;
  if (Math.abs(converted) >= 1e9) return `${symbol}${(converted / 1e9).toFixed(1)}B`;
  if (Math.abs(converted) >= 1e6) return `${symbol}${(converted / 1e6).toFixed(1)}M`;
  return `${symbol}${converted.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatPrice(
  priceUsd: number,
  currency: CurrencyCode,
  fxRates: Record<string, number> | undefined
): string {
  const val = convertUsdToCurrency(priceUsd, currency, fxRates);
  if (currency === 'KRW') {
    return `₩${Math.round(val).toLocaleString('ko-KR')}`;
  }
  if (currency === 'JPY') {
    return `¥${Math.round(val).toLocaleString('en-US')}`;
  }
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '¥';
  return `${symbol}${val.toLocaleString('en-US', {
    minimumFractionDigits: val < 1 ? 4 : 2,
    maximumFractionDigits: val < 1 ? 4 : 2,
  })}`;
}

function formatMetricCell(
  item: RankingItem,
  metric: MetricOption,
  currency: CurrencyCode,
  fxRates: Record<string, number> | undefined
): string {
  const raw = item[metric.key];
  if (raw === null || raw === undefined || !Number.isFinite(Number(raw))) {
    return '-';
  }
  const num = Number(raw);
  if (metric.kind === 'money') {
    return formatMoneyMetric(num, currency, fxRates);
  }
  if (metric.kind === 'integer') {
    return Math.round(num).toLocaleString('en-US');
  }
  if (metric.kind === 'percent') {
    return `${num.toFixed(2)}%`;
  }
  return num.toFixed(2);
}

function matchCategory(item: RankingItem, selectedCategory: string): boolean {
  if (!selectedCategory || selectedCategory === 'All Categories') return true;
  const atype = String(item.asset_type || '').toUpperCase();
  if (selectedCategory === 'Exchange Traded Fund') return atype === 'ETF';
  if (selectedCategory === 'Cryptocurrency') return atype === 'CRYPTO';

  const text = `${item.sector || ''} ${item.industry || ''} ${item.name || ''}`.toLowerCase();
  const key = selectedCategory.toLowerCase();
  if (key === 'financials') {
    return text.includes('financ') || text.includes('bank') || text.includes('insurance');
  }
  if (key === 'consumer') {
    return (
      text.includes('consumer') ||
      text.includes('retail') ||
      text.includes('auto') ||
      text.includes('beverage') ||
      text.includes('food')
    );
  }
  return text.includes(key);
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) {
    return <span className="text-xs text-slate-500">-</span>;
  }
  const width = 104;
  const height = 28;
  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (width - pad * 2);
      const y = height - pad - ((v - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} className="inline-block overflow-visible">
      <polyline
        fill="none"
        stroke={positive ? '#10b981' : '#f43f5e'}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
}

export default function HomePage() {
  const [snapshot, setSnapshot] = useState<DailySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [assetFilter, setAssetFilter] = useState<'ALL' | AssetType>('ALL');
  const [rankBy, setRankBy] = useState<RankMetricKey>('market_cap_usd');
  const [category, setCategory] = useState<string>('All Categories');
  const [search, setSearch] = useState<string>('');

  const activeMetric = useMemo(
    () => RANK_METRICS.find((m) => m.key === rankBy) || RANK_METRICS[0],
    [rankBy]
  );

  useEffect(() => {
    let active = true;
    async function loadLatest() {
      setLoading(true);
      setErrorMsg('');
      try {
        const res = await fetch(
          `${R2_BASE_URL}/snapshots/rankings/latest.json?t=${Date.now()}`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          throw new Error(`스냅샷을 불러오지 못했습니다 (HTTP ${res.status})`);
        }
        const data: DailySnapshot = await res.json();
        if (active) {
          setSnapshot(data);
        }
      } catch (err: unknown) {
        if (active) {
          setErrorMsg(
            err instanceof Error ? err.message : '데이터 로딩 중 오류가 발생했습니다.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadLatest();
    return () => {
      active = false;
    };
  }, []);

  const filteredAndSortedItems = useMemo(() => {
    const list = snapshot?.rankings || [];
    const q = search.trim().toLowerCase();

    const filtered = list.filter((item) => {
      if (assetFilter !== 'ALL' && item.asset_type !== assetFilter) {
        return false;
      }
      if (!matchCategory(item, category)) {
        return false;
      }
      if (q) {
        const nameMatch = String(item.name || '').toLowerCase().includes(q);
        const tickerMatch = String(item.ticker || '').toLowerCase().includes(q);
        if (!nameMatch && !tickerMatch) return false;
      }
      return true;
    });

    if (rankBy === 'market_cap_usd') {
      return [...filtered].sort(
        (a, b) => Number(b.market_cap_usd || 0) - Number(a.market_cap_usd || 0)
      );
    }

    return [...filtered].sort((a, b) => {
      const av = a[rankBy];
      const bv = b[rankBy];
      const aValid = av !== null && av !== undefined && Number.isFinite(Number(av));
      const bValid = bv !== null && bv !== undefined && Number.isFinite(Number(bv));
      if (!aValid && !bValid) return 0;
      if (!aValid) return 1;
      if (!bValid) return -1;
      return Number(bv) - Number(av);
    });
  }, [snapshot, assetFilter, category, search, rankBy]);

  const totalMarketCapDisplay = useMemo(() => {
    const sumUsd = filteredAndSortedItems.reduce(
      (acc, cur) => acc + Number(cur.market_cap_usd || 0),
      0
    );
    return formatMoneyMetric(sumUsd, currency, snapshot?.fx_rates);
  }, [filteredAndSortedItems, currency, snapshot?.fx_rates]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 md:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Global MarketCap
            </h1>
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-400">
              LIVE
            </span>
            <select
              aria-label="Ranking by categories"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'All Categories' ? 'Ranking by categories' : cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-1">
              {CURRENCY_BUTTONS.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setCurrency(code)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    currency === code
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
            <span className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300">
              기준일 {snapshot?.date || '-'}
            </span>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs text-slate-400">합산 시가총액 ({currency})</p>
            <p className="mt-2 text-2xl md:text-3xl font-bold text-white">
              {totalMarketCapDisplay}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs text-slate-400">집계 자산 수</p>
            <p className="mt-2 text-2xl md:text-3xl font-bold text-white">
              {filteredAndSortedItems.length.toLocaleString('en-US')} 개
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs text-slate-400">스냅샷 기준일자 (UTC)</p>
            <p className="mt-2 text-2xl md:text-3xl font-bold text-indigo-400">
              {snapshot?.date || '-'}
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 mr-1">Rank by</span>
            {RANK_METRICS.map((m) => {
              const selected = rankBy === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setRankBy(m.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    selected
                      ? 'bg-indigo-600 text-white border border-indigo-500'
                      : 'bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ['ALL', '전체 자산'],
                ['STOCK', '주식 (Stocks)'],
                ['ETF', 'ETF'],
                ['CRYPTO', '암호화폐 (Crypto)'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setAssetFilter(key)}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                  assetFilter === key
                    ? 'bg-white text-slate-950 font-semibold'
                    : 'border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="종목명 또는 티커 검색..."
            className="w-full sm:w-64 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </section>

        {errorMsg && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-300">
            {errorMsg}
          </div>
        )}

        <section className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase text-slate-400">
                <th className="py-3.5 px-4 w-14">#</th>
                <th className="py-3.5 px-4">자산명</th>
                <th className="py-3.5 px-4">국가</th>
                <th className="py-3.5 px-4 text-right">주가</th>
                <th className="py-3.5 px-4 text-right">
                  {activeMetric.columnTitle}
                  {activeMetric.kind === 'money' ? ` (${currency})` : ''}
                </th>
                {activeMetric.key !== 'market_cap_usd' && (
                  <th className="py-3.5 px-4 text-right">시가총액 ({currency})</th>
                )}
                <th className="py-3.5 px-4 text-right">24h</th>
                <th className="py-3.5 px-4 text-right">30d</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-sm">
              {loading ? (
                <tr>
                  <td
                    colSpan={activeMetric.key !== 'market_cap_usd' ? 8 : 7}
                    className="py-10 text-center text-slate-400"
                  >
                    데이터를 불러오는 중입니다...
                  </td>
                </tr>
              ) : filteredAndSortedItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeMetric.key !== 'market_cap_usd' ? 8 : 7}
                    className="py-10 text-center text-slate-400"
                  >
                    조건에 맞는 자산이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredAndSortedItems.slice(0, 200).map((item, idx) => {
                  const pos = Number(item.change_pct || 0) >= 0;
                  return (
                    <tr
                      key={`${item.asset_type}-${item.ticker}-${idx}`}
                      className="hover:bg-slate-800/40 transition"
                    >
                      <td className="py-3.5 px-4 text-slate-400">{idx + 1}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{item.name}</div>
                        <div className="text-xs text-slate-400">{item.ticker}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {item.country_code || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-200">
                        {formatPrice(item.price_usd, currency, snapshot?.fx_rates)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-white">
                        {formatMetricCell(item, activeMetric, currency, snapshot?.fx_rates)}
                      </td>
                      {activeMetric.key !== 'market_cap_usd' && (
                        <td className="py-3.5 px-4 text-right text-slate-300">
                          {formatMoneyMetric(
                            item.market_cap_usd,
                            currency,
                            snapshot?.fx_rates
                          )}
                        </td>
                      )}
                      <td
                        className={`py-3.5 px-4 text-right font-medium ${
                          pos ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {pos ? '+' : ''}
                        {Number(item.change_pct || 0).toFixed(2)}%
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Sparkline data={item.sparkline_30d || []} positive={pos} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
