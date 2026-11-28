'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import HistoryChart2000 from '@/components/HistoryChart2000';

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

interface RankingItem {
  rank: number;
  ticker: string;
  name: string;
  asset_type: AssetType;
  country_code?: string | null;
  logo_path?: string | null;
  market_cap_usd: number;
  price_usd: number;
  change_pct: number;
  sparkline_30d?: number[];
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
  sector?: string | null;
  industry?: string | null;
}

interface DailySnapshot {
  date: string;
  total_assets: number;
  total_market_cap_usd: number;
  fx_rates?: Record<string, number>;
  rankings: RankingItem[];
}

const R2_BASE_URL = (
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_LATEST_SNAPSHOT_URL?.replace(/\/snapshots\/rankings\/latest\.json$/, '') ||
  ''
).replace(/\/$/, '');

const RANK_METRICS: { key: RankMetricKey; label: string }[] = [
  { key: 'market_cap_usd', label: 'Market Cap' },
  { key: 'earnings_usd', label: 'Earnings' },
  { key: 'revenue_usd', label: 'Revenue' },
  { key: 'employees', label: 'Employees' },
  { key: 'pe_ratio', label: 'P/E Ratio' },
  { key: 'dividend_yield', label: 'Dividend Yield' },
  { key: 'operating_margin', label: 'Operating Margin' },
  { key: 'total_assets_usd', label: 'Total Assets' },
  { key: 'net_assets_usd', label: 'Net Assets' },
  { key: 'total_liabilities_usd', label: 'Total Liabilities' },
  { key: 'total_debt_usd', label: 'Total Debt' },
  { key: 'total_cash_usd', label: 'Total Cash' },
  { key: 'pb_ratio', label: 'P/B Ratio' },
];

const CATEGORY_RULES: { label: string; keywords: string[] }[] = [
  { label: 'All Categories', keywords: [] },
  { label: 'Technology & Software', keywords: ['tech', 'software', 'semiconductor', 'cloud', 'ai', 'computer', 'apple', 'microsoft', 'nvidia'] },
  { label: 'Financials & Banking', keywords: ['bank', 'financial', 'insurance', 'capital', 'credit', 'berkshire', 'jpmorgan', 'visa', 'mastercard'] },
  { label: 'Healthcare & Pharma', keywords: ['health', 'pharma', 'biotech', 'medical', 'drug', 'hospital', 'eli lilly', 'johnson'] },
  { label: 'Energy & Oil/Gas', keywords: ['energy', 'oil', 'gas', 'petroleum', 'equinor', 'exxon', 'chevron', 'saudi aramco'] },
  { label: 'Consumer & Retail', keywords: ['consumer', 'retail', 'food', 'beverage', 'apparel', 'amazon', 'walmart', 'costco', 'coca-cola'] },
  { label: 'Industrials & Aerospace', keywords: ['industrial', 'aerospace', 'defense', 'machinery', 'transport', 'logistics', 'ge ', 'honeywell'] },
  { label: 'Crypto & Digital Assets', keywords: ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'coin', 'solana'] },
];

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  UK: 'United Kingdom',
  JP: 'Japan',
  CN: 'China',
  DE: 'Germany',
  FR: 'France',
  CA: 'Canada',
  KR: 'South Korea',
  IN: 'India',
  AU: 'Australia',
  CH: 'Switzerland',
  NL: 'Netherlands',
  SE: 'Sweden',
  DK: 'Denmark',
  NO: 'Norway',
  IL: 'Israel',
  SG: 'Singapore',
  BM: 'Bermuda',
  IE: 'Ireland',
  MY: 'Malaysia',
  ZA: 'South Africa',
  CL: 'Chile',
  TR: 'Turkey',
  BR: 'Brazil',
  TW: 'Taiwan',
  HK: 'Hong Kong',
  SA: 'Saudi Arabia',
  ID: 'Indonesia',
  MX: 'Mexico',
  ES: 'Spain',
  IT: 'Italy',
  AE: 'United Arab Emirates',
  BE: 'Belgium',
  FI: 'Finland',
  NZ: 'New Zealand',
  TH: 'Thailand',
  VN: 'Vietnam',
  PL: 'Poland',
  RU: 'Russia',
};

function getCountryLabel(code?: string | null): string {
  if (!code) return '-';
  const normalized = String(code).trim().toUpperCase();
  if (!normalized) return '-';
  return COUNTRY_NAMES[normalized] || normalized;
}

function matchCategory(item: RankingItem, category: string): boolean {
  if (!category || category === 'All Categories') return true;
  const rule = CATEGORY_RULES.find((r) => r.label === category);
  if (!rule || rule.keywords.length === 0) return true;
  if (category === 'Crypto & Digital Assets' && item.asset_type === 'CRYPTO') {
    return true;
  }
  const haystack = `${item.sector || ''} ${item.industry || ''} ${item.name || ''} ${item.ticker || ''}`.toLowerCase();
  return rule.keywords.some((kw) => haystack.includes(kw.toLowerCase()));
}

function formatCompactMoney(usdValue: number | null | undefined, currency: CurrencyCode, fxRates?: Record<string, number>): string {
  if (usdValue === null || usdValue === undefined || !Number.isFinite(Number(usdValue))) {
    return '-';
  }
  const rate = currency === 'USD' ? 1 : Number(fxRates?.[currency] || 1);
  const converted = Number(usdValue) * (rate > 0 ? rate : 1);
  const sign = converted < 0 ? '-' : '';
  const abs = Math.abs(converted);
  const symbolMap: Record<CurrencyCode, string> = {
    USD: '$',
    KRW: '₩',
    EUR: '€',
    JPY: '¥',
    CNY: 'CN¥',
  };
  const sym = symbolMap[currency] || '$';

  if (abs >= 1e12) return `${sign}${sym}${(abs / 1e12).toFixed(2)} tril`;
  if (abs >= 1e9) return `${sign}${sym}${(abs / 1e9).toFixed(0)} bil`;
  if (abs >= 1e6) return `${sign}${sym}${(abs / 1e6).toFixed(1)} mil`;
  return `${sign}${sym}${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatPrice(usdValue: number | null | undefined, currency: CurrencyCode, fxRates?: Record<string, number>): string {
  if (usdValue === null || usdValue === undefined || !Number.isFinite(Number(usdValue))) {
    return '-';
  }
  const rate = currency === 'USD' ? 1 : Number(fxRates?.[currency] || 1);
  const converted = Number(usdValue) * (rate > 0 ? rate : 1);
  const symbolMap: Record<CurrencyCode, string> = {
    USD: '$',
    KRW: '₩',
    EUR: '€',
    JPY: '¥',
    CNY: 'CN¥',
  };
  const sym = symbolMap[currency] || '$';
  const decimals = currency === 'KRW' || currency === 'JPY' ? 0 : 2;
  return `${sym}${converted.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function Sparkline({ data, positive }: { data?: number[]; positive: boolean }) {
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
  const [country, setCountry] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [chartModalTarget, setChartModalTarget] = useState<{ ticker: string; name: string } | null>(null);

  useEffect(() => {
    let active = true;
    async function loadLatest() {
      setLoading(true);
      setErrorMsg('');
      try {
        const base = R2_BASE_URL || '';
        const url = `${base}/snapshots/rankings/latest.json?t=${Date.now()}`;
        const res = await fetch(url, { cache: 'no-store' });
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

  useEffect(() => {
    if (!chartModalTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setChartModalTarget(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [chartModalTarget]);

  const countryOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of snapshot?.rankings || []) {
      const code = String(item.country_code || '').trim().toUpperCase();
      if (code) {
        counts[code] = (counts[code] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([code, count]) => ({
        code,
        count,
        label: getCountryLabel(code),
      }))
      .sort((a, b) => a.label.localeCompare(b.label) || b.count - a.count);
  }, [snapshot]);

  const filteredAndSortedItems = useMemo(() => {
    const list = snapshot?.rankings || [];
    const q = search.trim().toLowerCase();

    const filtered = list.filter((item) => {
      if (assetFilter !== 'ALL' && item.asset_type !== assetFilter) {
        return false;
      }
      if (country !== 'ALL') {
        const itemCountry = String(item.country_code || '').trim().toUpperCase();
        if (itemCountry !== country) return false;
      }
      if (!matchCategory(item, category)) {
        return false;
      }
      if (q) {
        const nameMatch = String(item.name || '').toLowerCase().includes(q);
        const tickerMatch = String(item.ticker || '').toLowerCase().includes(q);
        const countryLabelMatch = getCountryLabel(item.country_code).toLowerCase().includes(q);
        if (!nameMatch && !tickerMatch && !countryLabelMatch) return false;
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
  }, [snapshot, assetFilter, country, category, search, rankBy]);

  return (
    <main className="min-h-screen bg-[#070b14] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Global Market Cap Rankings
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              기준일: {snapshot?.date || '-'} · 총 자산: {(snapshot?.total_assets || 0).toLocaleString()}개
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['USD', 'KRW', 'EUR', 'JPY', 'CNY'] as CurrencyCode[]).map((curr) => (
              <button
                key={curr}
                type="button"
                onClick={() => setCurrency(curr)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  currency === curr
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {curr}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { key: 'ALL', label: '전체 자산' },
                { key: 'STOCK', label: '주식 (Stocks)' },
                { key: 'ETF', label: 'ETF' },
                { key: 'CRYPTO', label: '암호화폐 (Crypto)' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setAssetFilter(tab.key)}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                  assetFilter === tab.key
                    ? 'bg-white text-slate-950 font-semibold'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              aria-label="By country"
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">By country</option>
              {countryOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label} ({opt.count})
                </option>
              ))}
            </select>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Ranking by categories"
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            >
              {CATEGORY_RULES.map((rule) => (
                <option key={rule.label} value={rule.label}>
                  {rule.label}
                </option>
              ))}
            </select>

            <select
              value={rankBy}
              onChange={(e) => setRankBy(e.target.value as RankMetricKey)}
              aria-label="Rank metric"
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            >
              {RANK_METRICS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="종목명 또는 티커 검색..."
              className="w-56 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {loading && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-10 text-center text-sm text-slate-400">
            랭킹 데이터를 불러오는 중입니다...
          </div>
        )}

        {!loading && errorMsg && (
          <div className="rounded-xl border border-rose-900/60 bg-rose-950/30 p-6 text-sm text-rose-300">
            {errorMsg}
          </div>
        )}

        {!loading && !errorMsg && (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/90 text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3.5">#</th>
                  <th className="px-4 py-3.5">자산명</th>
                  <th className="px-4 py-3.5">국가</th>
                  <th className="px-4 py-3.5 text-right">주가</th>
                  <th className="px-4 py-3.5 text-right">시가총액 ({currency})</th>
                  <th className="px-4 py-3.5 text-right">24H</th>
                  <th className="px-4 py-3.5 text-center">30D</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredAndSortedItems.slice(0, 200).map((item, idx) => {
                  const change = Number(item.change_pct || 0);
                  const isPos = change >= 0;
                  return (
                    <tr
                      key={`${item.asset_type}-${item.ticker}-${idx}`}
                      className="transition hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3.5 font-medium text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div>
                            <Link
                              href={`/asset/${encodeURIComponent(item.asset_type || 'STOCK')}/${encodeURIComponent(item.ticker)}`}
                              className="font-semibold text-white hover:text-indigo-400"
                            >
                              {item.name}
                            </Link>
                            <div className="text-xs text-slate-400">{item.ticker}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-200">
                        {getCountryLabel(item.country_code)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-slate-100">
                        {formatPrice(item.price_usd, currency, snapshot?.fx_rates)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-white">
                        {formatCompactMoney(item.market_cap_usd, currency, snapshot?.fx_rates)}
                      </td>
                      <td
                        className={`px-4 py-3.5 text-right font-medium ${
                          isPos ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isPos ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`}
                      </td>
                      <td
                        className="cursor-pointer px-4 py-3.5 text-center"
                        onClick={() => setChartModalTarget({ ticker: item.ticker, name: item.name })}
                        title="히스토리 차트 보기"
                      >
                        <Sparkline data={item.sparkline_30d} positive={isPos} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {chartModalTarget && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
            onClick={() => setChartModalTarget(null)}
          >
            <div
              className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {chartModalTarget.name} ({chartModalTarget.ticker})
                  </h2>
                  <p className="text-xs text-slate-400">히스토리 추이</p>
                </div>
                <button
                  type="button"
                  onClick={() => setChartModalTarget(null)}
                  className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
                >
                  닫기
                </button>
              </div>
              <HistoryChart2000 ticker={chartModalTarget.ticker} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
