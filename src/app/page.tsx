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

  if (val >= 999.5e9) return `${sym}${(val / 1e12).toFixed(3)} T`;
  if (val >= 1e9) return `${sym}${Math.round(val / 1e9).toLocaleString('en-US')} B`;
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
