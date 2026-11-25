
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface HistoryPoint {
  date: string;
  price_usd?: number | null;
  shares_outstanding?: number | null;
  market_cap_usd?: number | null;
}

interface HistoryPayload {
  ticker: string;
  name?: string;
  data: HistoryPoint[];
}

type RangeKey = '1Y' | '5Y' | '10Y' | 'ALL';

const R2_BASE_URL =
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
  'https://pub-abab619513474306a997568b43202499.r2.dev';

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '1Y', label: '1년' },
  { key: '5Y', label: '5년' },
  { key: '10Y', label: '10년' },
  { key: 'ALL', label: '2000~현재' },
];

function getCutoffDate(range: RangeKey): string {
  if (range === 'ALL') return '2000-01-01';
  const now = new Date();
  const yearsBack = range === '1Y' ? 1 : range === '5Y' ? 5 : 10;
  now.setFullYear(now.getFullYear() - yearsBack);
  return now.toISOString().slice(0, 10);
}

function formatMarketCapCompact(val: number): string {
  if (!Number.isFinite(val)) return '-';
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default function HistoryChart2000({ ticker }: { ticker: string }) {
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [range, setRange] = useState<RangeKey>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const safeTicker = encodeURIComponent(ticker.trim());
    fetch(`${R2_BASE_URL}/snapshots/history/${safeTicker}.json`, {
      cache: 'no-store',
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<HistoryPayload>;
      })
      .then((json) => {
        if (!active) return;
        setPoints(Array.isArray(json.data) ? json.data : []);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message || '시가총액 히스토리를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ticker]);

  const { chartData, summary } = useMemo(() => {
    const cutoff = getCutoffDate(range);
    const valid = points
      .filter(
        (p) =>
          typeof p.date === 'string' &&
          p.date >= cutoff &&
          typeof p.market_cap_usd === 'number' &&
          Number.isFinite(p.market_cap_usd) &&
          p.market_cap_usd > 0
      )
      .map((p) => ({
        date: p.date,
        marketCap: Number(p.market_cap_usd),
      }));

    if (valid.length === 0) {
      return { chartData: [], summary: null };
    }

    const firstVal = valid[0].marketCap;
    const lastVal = valid[valid.length - 1].marketCap;
    const changePct = firstVal > 0 ? ((lastVal - firstVal) / firstVal) * 100 : 0;
    let highVal = valid[0].marketCap;
    let lowVal = valid[0].marketCap;

    for (const item of valid) {
      if (item.marketCap > highVal) highVal = item.marketCap;
      if (item.marketCap < lowVal) lowVal = item.marketCap;
    }

    // 2000년 전체(ALL) 구간에서 포인트가 너무 많으면 렌더링 부담을 줄이기 위해 간격 샘플링
    const step = range === 'ALL' && valid.length > 2500 ? Math.ceil(valid.length / 2000) : 1;
    const sampled =
      step === 1
        ? valid
        : valid.filter((_, idx) => idx % step === 0 || idx === valid.length - 1);

    return {
      chartData: sampled,
      summary: {
        latest: lastVal,
        changePct,
        high: highVal,
        low: lowVal,
      },
    };
  }, [points, range]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        {ticker} 시가총액 히스토리 차트 로딩 중...
      </div>
    );
  }

  if (error || chartData.length === 0 || !summary) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6 text-sm text-amber-700">
        {error || `${ticker}의 선택 기간 시가총액 데이터가 아직 없습니다.`}
      </div>
    );
  }

  const isPositive = summary.changePct >= 0;

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* 상단: 제목 + 기간 전환 버튼(1년 / 5년 / 10년 / 2000~현재) */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-slate-500">시가총액 추이 (USD)</div>
          <div className="mt-0.5 flex items-baseline gap-2.5">
            <span className="text-2xl font-bold text-slate-900">
              {formatMarketCapCompact(summary.latest)}
            </span>
            <span
              className={`text-sm font-semibold ${
                isPositive ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {isPositive ? '▲' : '▼'} {Math.abs(summary.changePct).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setRange(opt.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                range === opt.key
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 선택 기간 최고/최저 시총 요약 */}
      <div className="mb-4 flex flex-wrap gap-4 border-y border-slate-100 py-2 text-xs text-slate-500">
        <span>
          기간 최고: <strong className="text-slate-700">{formatMarketCapCompact(summary.high)}</strong>
        </span>
        <span>
          기간 최저: <strong className="text-slate-700">{formatMarketCapCompact(summary.low)}</strong>
        </span>
      </div>

      {/* 시가총액 영역 차트 */}
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={48} />
            <YAxis
              tick={{ fontSize: 11 }}
              domain={['auto', 'auto']}
              tickFormatter={(v) => formatMarketCapCompact(Number(v))}
              width={74}
            />
            <Tooltip
              formatter={(val: unknown) => [formatMarketCapCompact(Number(val)), '시가총액']}
              labelFormatter={(label) => `날짜: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="marketCap"
              stroke={isPositive ? '#059669' : '#e11d48'}
              fill={isPositive ? '#6ee7b7' : '#fda4af'}
              fillOpacity={0.22}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
