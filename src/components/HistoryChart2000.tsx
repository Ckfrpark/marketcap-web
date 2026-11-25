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
type MetricMode = 'auto' | 'market_cap_usd' | 'price_usd';

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

function formatValueCompact(val: number, isMarketCap: boolean): string {
  if (!Number.isFinite(val)) return '-';
  if (isMarketCap) {
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  }
  return `$${val.toLocaleString('en-US', {
    minimumFractionDigits: val < 1 ? 4 : 2,
    maximumFractionDigits: val < 1 ? 4 : 2,
  })}`;
}

export default function HistoryChart2000({ ticker }: { ticker: string }) {
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [range, setRange] = useState<RangeKey>('ALL');
  const [metricMode, setMetricMode] = useState<MetricMode>('auto');
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
        setError(err.message || '히스토리 데이터를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ticker]);

  const { chartData, summary, activeMetric, fallbackNotice } = useMemo(() => {
    const cutoff = getCutoffDate(range);
    const inRange = points.filter(
      (p) => typeof p.date === 'string' && p.date >= cutoff
    );

    const mcapSeries = inRange
      .filter(
        (p) =>
          typeof p.market_cap_usd === 'number' &&
          Number.isFinite(p.market_cap_usd) &&
          p.market_cap_usd > 0
      )
      .map((p) => ({ date: p.date, value: Number(p.market_cap_usd) }));

    const priceSeries = inRange
      .filter(
        (p) =>
          typeof p.price_usd === 'number' &&
          Number.isFinite(p.price_usd) &&
          p.price_usd > 0
      )
      .map((p) => ({ date: p.date, value: Number(p.price_usd) }));

    let chosenMetric: 'market_cap_usd' | 'price_usd' = 'market_cap_usd';
    let valid = mcapSeries;
    let notice: string | null = null;

    if (metricMode === 'price_usd') {
      chosenMetric = 'price_usd';
      valid = priceSeries;
    } else if (metricMode === 'market_cap_usd') {
      chosenMetric = 'market_cap_usd';
      valid = mcapSeries;
    } else {
      // auto: 시총 데이터가 있으면 시총, 없으면 주가로 자동 표시
      if (mcapSeries.length > 0) {
        chosenMetric = 'market_cap_usd';
        valid = mcapSeries;
      } else if (priceSeries.length > 0) {
        chosenMetric = 'price_usd';
        valid = priceSeries;
        notice = '시가총액(shares_outstanding) 미연동 구간이라 주가(USD) 차트로 표시 중입니다.';
      }
    }

    if (valid.length === 0) {
      return {
        chartData: [],
        summary: null,
        activeMetric: chosenMetric,
        fallbackNotice: notice,
      };
    }

    const firstVal = valid[0].value;
    const lastVal = valid[valid.length - 1].value;
    const changePct = firstVal > 0 ? ((lastVal - firstVal) / firstVal) * 100 : 0;
    let highVal = valid[0].value;
    let lowVal = valid[0].value;

    for (const item of valid) {
      if (item.value > highVal) highVal = item.value;
      if (item.value < lowVal) lowVal = item.value;
    }

    const step =
      range === 'ALL' && valid.length > 2500 ? Math.ceil(valid.length / 2000) : 1;
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
      activeMetric: chosenMetric,
      fallbackNotice: notice,
    };
  }, [points, range, metricMode]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        {ticker} 히스토리 차트 로딩 중...
      </div>
    );
  }

  if (error || chartData.length === 0 || !summary) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6 text-sm text-amber-700">
        {error || `${ticker}의 선택 기간 데이터가 아직 없습니다.`}
      </div>
    );
  }

  const isMarketCap = activeMetric === 'market_cap_usd';
  const isPositive = summary.changePct >= 0;

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-slate-500">
            {isMarketCap ? '시가총액 추이 (USD)' : '주가 추이 (USD)'}
          </div>
          <div className="mt-0.5 flex items-baseline gap-2.5">
            <span className="text-2xl font-bold text-slate-900">
              {formatValueCompact(summary.latest, isMarketCap)}
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

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMetricMode('auto')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                metricMode === 'auto'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              자동
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('market_cap_usd')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                metricMode === 'market_cap_usd'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              시가총액
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('price_usd')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                metricMode === 'price_usd'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              주가
            </button>
          </div>

          <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRange(opt.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  range === opt.key
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {fallbackNotice && (
        <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {fallbackNotice}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-4 border-y border-slate-100 py-2 text-xs text-slate-500">
        <span>
          기간 최고:{' '}
          <strong className="text-slate-700">
            {formatValueCompact(summary.high, isMarketCap)}
          </strong>
        </span>
        <span>
          기간 최저:{' '}
          <strong className="text-slate-700">
            {formatValueCompact(summary.low, isMarketCap)}
          </strong>
        </span>
      </div>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={48} />
            <YAxis
              tick={{ fontSize: 11 }}
              domain={['auto', 'auto']}
              tickFormatter={(v) => formatValueCompact(Number(v), isMarketCap)}
              width={74}
            />
            <Tooltip
              formatter={(val: unknown) => [
                formatValueCompact(Number(val), isMarketCap),
                isMarketCap ? '시가총액' : '주가',
              ]}
              labelFormatter={(label) => `날짜: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="value"
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
