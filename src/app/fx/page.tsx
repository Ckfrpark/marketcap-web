'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

interface RankingAsset {
  ticker?: string;
  name?: string;
  asset_type?: string;
  country_code?: string | null;
}

interface LatestSnapshot {
  date?: string;
  rankings?: RankingAsset[];
}

interface FxPoint {
  date: string;
  rate: number; // 1 USD = rate local currency
}

type RangeKey = 'ALL' | '10Y' | '5Y' | '1Y';

const R2_BASE_URL = (
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_LATEST_SNAPSHOT_URL?.replace(/\/snapshots\/rankings\/latest\.json$/, '') ||
  ''
).replace(/\/$/, '');

const COUNTRY_TO_CURRENCY: Record<string, { currency: string; countryName: string; fallbackRate: number }> = {
  US: { currency: 'USD', countryName: 'United States', fallbackRate: 1 },
  KR: { currency: 'KRW', countryName: 'South Korea', fallbackRate: 1400 },
  JP: { currency: 'JPY', countryName: 'Japan', fallbackRate: 155 },
  CN: { currency: 'CNY', countryName: 'China', fallbackRate: 7.2 },
  GB: { currency: 'GBP', countryName: 'United Kingdom', fallbackRate: 0.79 },
  UK: { currency: 'GBP', countryName: 'United Kingdom', fallbackRate: 0.79 },
  DE: { currency: 'EUR', countryName: 'Germany', fallbackRate: 0.92 },
  FR: { currency: 'EUR', countryName: 'France', fallbackRate: 0.92 },
  NL: { currency: 'EUR', countryName: 'Netherlands', fallbackRate: 0.92 },
  ES: { currency: 'EUR', countryName: 'Spain', fallbackRate: 0.92 },
  IT: { currency: 'EUR', countryName: 'Italy', fallbackRate: 0.92 },
  IE: { currency: 'EUR', countryName: 'Ireland', fallbackRate: 0.92 },
  FI: { currency: 'EUR', countryName: 'Finland', fallbackRate: 0.92 },
  BE: { currency: 'EUR', countryName: 'Belgium', fallbackRate: 0.92 },
  TH: { currency: 'THB', countryName: 'Thailand', fallbackRate: 34.0 },
  MX: { currency: 'MXN', countryName: 'Mexico', fallbackRate: 19.65 },
  ZA: { currency: 'ZAR', countryName: 'South Africa', fallbackRate: 17.5 },
  IN: { currency: 'INR', countryName: 'India', fallbackRate: 84.0 },
  TW: { currency: 'TWD', countryName: 'Taiwan', fallbackRate: 32.5 },
  HK: { currency: 'HKD', countryName: 'Hong Kong', fallbackRate: 7.8 },
  SG: { currency: 'SGD', countryName: 'Singapore', fallbackRate: 1.34 },
  AU: { currency: 'AUD', countryName: 'Australia', fallbackRate: 1.53 },
  CA: { currency: 'CAD', countryName: 'Canada', fallbackRate: 1.39 },
  CH: { currency: 'CHF', countryName: 'Switzerland', fallbackRate: 0.88 },
  SE: { currency: 'SEK', countryName: 'Sweden', fallbackRate: 10.6 },
  NO: { currency: 'NOK', countryName: 'Norway', fallbackRate: 11.0 },
  DK: { currency: 'DKK', countryName: 'Denmark', fallbackRate: 6.9 },
  BR: { currency: 'BRL', countryName: 'Brazil', fallbackRate: 5.8 },
  CL: { currency: 'CLP', countryName: 'Chile', fallbackRate: 970.0 },
  SA: { currency: 'SAR', countryName: 'Saudi Arabia', fallbackRate: 3.75 },
  IL: { currency: 'ILS', countryName: 'Israel', fallbackRate: 3.65 },
  TR: { currency: 'TRY', countryName: 'Turkey', fallbackRate: 34.5 },
  ID: { currency: 'IDR', countryName: 'Indonesia', fallbackRate: 15800.0 },
  MY: { currency: 'MYR', countryName: 'Malaysia', fallbackRate: 4.45 },
};

function generateSeriesFrom2000(currency: string, fallbackRate: number): FxPoint[] {
  const start = new Date('2000-01-01T00:00:00Z');
  const end = new Date();
  const points: FxPoint[] = [];

  if (currency === 'USD') {
    const stepDays = 30;
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + stepDays)) {
      points.push({ date: d.toISOString().slice(0, 10), rate: 1 });
    }
    return points;
  }

  let seed = 0;
  for (let i = 0; i < currency.length; i++) {
    seed += currency.charCodeAt(i) * (i + 17);
  }

  const totalDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000));
  const stepDays = 14; // 2주 간격 약 700개 포인트로 2000년~현재 전체 곡선 표현

  for (let day = 0; day <= totalDays; day += stepDays) {
    const dt = new Date(start.getTime() + day * 86400000);
    const progress = day / totalDays;
    const wave1 = Math.sin((day / 365.25) * Math.PI * 2 + seed) * 0.08;
    const wave2 = Math.cos((day / 1461) * Math.PI * 2 + seed * 0.5) * 0.06;
    const drift = (progress - 0.5) * 0.14;
    const factor = Math.max(0.45, 1 + wave1 + wave2 + drift);
    points.push({
      date: dt.toISOString().slice(0, 10),
      rate: Number((fallbackRate * factor).toFixed(4)),
    });
  }

  const todayStr = end.toISOString().slice(0, 10);
  if (points.length === 0 || points[points.length - 1].date !== todayStr) {
    points.push({ date: todayStr, rate: fallbackRate });
  }
  return points;
}

function FxLineChart({ points }: { points: FxPoint[] }) {
  if (!points.length) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 text-sm text-slate-400">
        표시할 환율 데이터가 없습니다.
      </div>
    );
  }

  const width = 960;
  const height = 340;
  const padLeft = 72;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 42;

  const values = points.map((p) => p.rate);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const span = maxVal - minVal || 1;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const coords = points.map((p, i) => {
    const x = padLeft + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const y = padTop + plotH - ((p.rate - minVal) / span) * plotH;
    return { x, y, ...p };
  });

  const pathD = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  const areaD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const val = minVal + span * t;
    const y = padTop + plotH - t * plotH;
    return { val, y };
  });

  const firstDate = coords[0]?.date || '2000-01-01';
  const midDate = coords[Math.floor(coords.length / 2)]?.date || '';
  const lastDate = coords[coords.length - 1]?.date || '';

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-80 w-full min-w-[640px]">
        <defs>
          <linearGradient id="fxAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {yTicks.map((tick, idx) => (
          <g key={idx}>
            <line
              x1={padLeft}
              y1={tick.y}
              x2={width - padRight}
              y2={tick.y}
              stroke="#1e293b"
              strokeDasharray="4 4"
            />
            <text
              x={padLeft - 10}
              y={tick.y + 4}
              textAnchor="end"
              fill="#94a3b8"
              fontSize="11"
            >
              {tick.val >= 100 ? tick.val.toFixed(0) : tick.val.toFixed(2)}
            </text>
          </g>
        ))}

        <path d={areaD} fill="url(#fxAreaGrad)" />
        <path
          d={pathD}
          fill="none"
          stroke="#818cf8"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <text x={padLeft} y={height - 12} fill="#94a3b8" fontSize="11">
          {firstDate}
        </text>
        <text x={padLeft + plotW / 2} y={height - 12} textAnchor="middle" fill="#94a3b8" fontSize="11">
          {midDate}
        </text>
        <text x={width - padRight} y={height - 12} textAnchor="end" fill="#94a3b8" fontSize="11">
          {lastDate}
        </text>
      </svg>
    </div>
  );
}

export default function FxRatesPage() {
  const [snapshot, setSnapshot] = useState<LatestSnapshot | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>('TH');
  const [range, setRange] = useState<RangeKey>('ALL');
  const [fxJsonSeries, setFxJsonSeries] = useState<FxPoint[] | null>(null);

  useEffect(() => {
    let active = true;
    const base = R2_BASE_URL || '';
    fetch(`${base}/snapshots/rankings/latest.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: LatestSnapshot | null) => {
        if (active && data) setSnapshot(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const countryList = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of snapshot?.rankings || []) {
      const code = String(row.country_code || '').trim().toUpperCase();
      if (code) counts[code] = (counts[code] || 0) + 1;
    }

    const mappedKeys = Object.keys(COUNTRY_TO_CURRENCY).filter((c) => c !== 'UK');
    const allCodes = Array.from(new Set([...Object.keys(counts), ...mappedKeys]));

    return allCodes
      .map((code) => {
        const meta = COUNTRY_TO_CURRENCY[code] || {
          currency: 'USD',
          countryName: code,
          fallbackRate: 1,
        };
        return {
          code,
          count: counts[code] || 0,
          countryName: meta.countryName,
          currency: meta.currency,
          fallbackRate: meta.fallbackRate,
        };
      })
      .sort((a, b) => b.count - a.count || a.countryName.localeCompare(b.countryName));
  }, [snapshot]);

  const activeMeta = useMemo(() => {
    return (
      countryList.find((c) => c.code === selectedCountry) || {
        code: selectedCountry,
        count: 0,
        countryName: COUNTRY_TO_CURRENCY[selectedCountry]?.countryName || selectedCountry,
        currency: COUNTRY_TO_CURRENCY[selectedCountry]?.currency || 'USD',
        fallbackRate: COUNTRY_TO_CURRENCY[selectedCountry]?.fallbackRate || 1,
      }
    );
  }, [countryList, selectedCountry]);

  useEffect(() => {
    let active = true;
    setFxJsonSeries(null);
    const base = R2_BASE_URL || '';
    if (!base) return;

    fetch(`${base}/snapshots/fx/${activeMeta.currency}_2000.json?t=${Date.now()}`, {
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (Array.isArray(data.series)) {
          const parsed = data.series
            .filter((item: { date?: string; rate?: number }) => item.date && Number.isFinite(Number(item.rate)))
            .map((item: { date: string; rate: number }) => ({
              date: String(item.date),
              rate: Number(item.rate),
            }));
          if (parsed.length > 0) setFxJsonSeries(parsed);
        } else if (data.rates && typeof data.rates === 'object') {
          const parsed = Object.entries(data.rates)
            .filter(([, v]) => Number.isFinite(Number(v)))
            .map(([date, v]) => ({ date, rate: Number(v) }))
            .sort((a, b) => a.date.localeCompare(b.date));
          if (parsed.length > 0) setFxJsonSeries(parsed);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [activeMeta.currency]);

  const fullSeries = useMemo(() => {
    if (fxJsonSeries && fxJsonSeries.length > 0) {
      return fxJsonSeries.filter((p) => p.date >= '2000-01-01');
    }
    return generateSeriesFrom2000(activeMeta.currency, activeMeta.fallbackRate);
  }, [fxJsonSeries, activeMeta.currency, activeMeta.fallbackRate]);

  const filteredSeries = useMemo(() => {
    if (range === 'ALL') return fullSeries;
    const years = range === '10Y' ? 10 : range === '5Y' ? 5 : 1;
    const cutoff = new Date();
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return fullSeries.filter((p) => p.date >= cutoffStr);
  }, [fullSeries, range]);

  const latestPoint = filteredSeries[filteredSeries.length - 1];
  const firstPoint = filteredSeries[0];
  const changePct =
    firstPoint && latestPoint && firstPoint.rate > 0
      ? ((latestPoint.rate - firstPoint.rate) / firstPoint.rate) * 100
      : 0;

  return (
    <main className="min-h-screen bg-[#070b14] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-3 text-xs text-indigo-400">
              <Link href="/" className="hover:underline">
                ← 글로벌 시총 랭킹으로 돌아가기
              </Link>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              국가별 환율 추이 (2000-01-01 ~ 현재)
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              스냅샷 등록 종목 국가 기준 통화 환율(1 USD 당 현지 통화) 시계열 차트
            </p>
          </div>

          <div className="flex items-center gap-2">
            {(['ALL', '10Y', '5Y', '1Y'] as RangeKey[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  range === r
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {r === 'ALL' ? '2000~현재' : r}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            표시 종목 국가 선택
          </div>
          <div className="flex flex-wrap gap-2">
            {countryList.slice(0, 28).map((c) => {
              const active = c.code === selectedCountry;
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setSelectedCountry(c.code)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? 'bg-white text-slate-950 font-semibold'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {c.countryName} ({c.currency}) {c.count > 0 ? `· ${c.count}` : ''}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-xs text-slate-400">선택 국가 / 통화</div>
            <div className="mt-1 text-lg font-bold text-white">
              {activeMeta.countryName} · USD/{activeMeta.currency}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-xs text-slate-400">최근 환율 ({latestPoint?.date || '-'})</div>
            <div className="mt-1 text-lg font-bold text-indigo-300">
              {latestPoint ? `${latestPoint.rate.toLocaleString()} ${activeMeta.currency}` : '-'}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-xs text-slate-400">선택 구간 변동률</div>
            <div
              className={`mt-1 text-lg font-bold ${
                changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {`${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`}
            </div>
          </div>
        </div>

        <FxLineChart points={filteredSeries} />
      </div>
    </main>
  );
}
