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
  fx_rates?: Record<string, number>;
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

// 1 USD = localPerUsd 기준 메타데이터
const COUNTRY_TO_CURRENCY: Record<string, { currency: string; countryName: string; localPerUsd: number }> = {
  US: { currency: 'USD', countryName: 'United States', localPerUsd: 1 },
  KR: { currency: 'KRW', countryName: 'South Korea', localPerUsd: 1400 },
  JP: { currency: 'JPY', countryName: 'Japan', localPerUsd: 155 },
  CN: { currency: 'CNY', countryName: 'China', localPerUsd: 7.2 },
  GB: { currency: 'GBP', countryName: 'United Kingdom', localPerUsd: 0.79 },
  UK: { currency: 'GBP', countryName: 'United Kingdom', localPerUsd: 0.79 },
  DE: { currency: 'EUR', countryName: 'Germany', localPerUsd: 0.92 },
  FR: { currency: 'EUR', countryName: 'France', localPerUsd: 0.92 },
  NL: { currency: 'EUR', countryName: 'Netherlands', localPerUsd: 0.92 },
  ES: { currency: 'EUR', countryName: 'Spain', localPerUsd: 0.92 },
  IT: { currency: 'EUR', countryName: 'Italy', localPerUsd: 0.92 },
  IE: { currency: 'EUR', countryName: 'Ireland', localPerUsd: 0.92 },
  FI: { currency: 'EUR', countryName: 'Finland', localPerUsd: 0.92 },
  BE: { currency: 'EUR', countryName: 'Belgium', localPerUsd: 0.92 },
  TH: { currency: 'THB', countryName: 'Thailand', localPerUsd: 34.0 },
  MX: { currency: 'MXN', countryName: 'Mexico', localPerUsd: 19.65 },
  ZA: { currency: 'ZAR', countryName: 'South Africa', localPerUsd: 17.5 },
  IN: { currency: 'INR', countryName: 'India', localPerUsd: 84.0 },
  TW: { currency: 'TWD', countryName: 'Taiwan', localPerUsd: 32.5 },
  HK: { currency: 'HKD', countryName: 'Hong Kong', localPerUsd: 7.8 },
  SG: { currency: 'SGD', countryName: 'Singapore', localPerUsd: 1.34 },
  AU: { currency: 'AUD', countryName: 'Australia', localPerUsd: 1.53 },
  CA: { currency: 'CAD', countryName: 'Canada', localPerUsd: 1.39 },
  CH: { currency: 'CHF', countryName: 'Switzerland', localPerUsd: 0.88 },
  SE: { currency: 'SEK', countryName: 'Sweden', localPerUsd: 10.6 },
  NO: { currency: 'NOK', countryName: 'Norway', localPerUsd: 11.0 },
  DK: { currency: 'DKK', countryName: 'Denmark', localPerUsd: 6.9 },
  BR: { currency: 'BRL', countryName: 'Brazil', localPerUsd: 5.8 },
  CL: { currency: 'CLP', countryName: 'Chile', localPerUsd: 970.0 },
  SA: { currency: 'SAR', countryName: 'Saudi Arabia', localPerUsd: 3.75 },
  IL: { currency: 'ILS', countryName: 'Israel', localPerUsd: 3.65 },
  TR: { currency: 'TRY', countryName: 'Turkey', localPerUsd: 34.5 },
  ID: { currency: 'IDR', countryName: 'Indonesia', localPerUsd: 15800.0 },
  MY: { currency: 'MYR', countryName: 'Malaysia', localPerUsd: 4.45 },
  BM: { currency: 'USD', countryName: 'Bermuda', localPerUsd: 1 },
};

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
  const padLeft = 76;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 42;

  const values = points.map((p) => p.rate);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const span = maxVal - minVal || Math.max(maxVal * 0.05, 0.01);

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
  const [selectedCountry, setSelectedCountry] = useState<string>('KR');
  const [range, setRange] = useState<RangeKey>('ALL');
  const [fxJsonSeries, setFxJsonSeries] = useState<FxPoint[] | null>(null);
  const [isRealSeries, setIsRealSeries] = useState<boolean>(false);

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
          localPerUsd: 1,
        };
        return {
          code,
          count: counts[code] || 0,
          countryName: meta.countryName,
          currency: meta.currency,
          localPerUsd: meta.localPerUsd,
        };
      })
      .sort((a, b) => b.count - a.count || a.countryName.localeCompare(b.countryName));
  }, [snapshot]);

  const activeMeta = useMemo(() => {
    const found = countryList.find((c) => c.code === selectedCountry);
    const baseMeta = found || {
      code: selectedCountry,
      count: 0,
      countryName: COUNTRY_TO_CURRENCY[selectedCountry]?.countryName || selectedCountry,
      currency: COUNTRY_TO_CURRENCY[selectedCountry]?.currency || 'USD',
      localPerUsd: COUNTRY_TO_CURRENCY[selectedCountry]?.localPerUsd || 1,
    };

    // snapshot.fx_rates 에 USD당 단가(usdPerUnit)가 있는 경우 1 / usdPerUnit 으로 환산
    const snapRate = snapshot?.fx_rates?.[baseMeta.currency];
    if (baseMeta.currency !== 'USD' && typeof snapRate === 'number' && snapRate > 0) {
      const derivedLocalPerUsd = snapRate < 0.2 ? 1 / snapRate : snapRate;
      return {
        ...baseMeta,
        localPerUsd: Number(derivedLocalPerUsd.toFixed(4)),
      };
    }
    return baseMeta;
  }, [countryList, selectedCountry, snapshot]);

  useEffect(() => {
    let active = true;
    setFxJsonSeries(null);
    setIsRealSeries(false);
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
            .filter((item: { date?: string; rate?: number }) => item.date && Number.isFinite(Number(item.rate)) && Number(item.rate) > 0)
            .map((item: { date: string; rate: number }) => ({
              date: String(item.date),
              rate: Number(item.rate),
            }));
          if (parsed.length > 0) {
            setFxJsonSeries(parsed);
            setIsRealSeries(true);
          }
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
    const snapDate = snapshot?.date || new Date().toISOString().slice(0, 10);
    return [
      { date: '2000-01-01', rate: activeMeta.localPerUsd },
      { date: snapDate, rate: activeMeta.localPerUsd },
    ];
  }, [fxJsonSeries, activeMeta.localPerUsd, snapshot?.date]);

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
              스냅샷 등록 종목 국가 기준 통화 환율(1 USD 당 현지 통화) · 기준일 {snapshot?.date || '-'}
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

        {!isRealSeries && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-xs text-amber-300">
            R2에 <code>snapshots/fx/{activeMeta.currency}_2000.json</code> 실측 시계열 파일이 아직 업로드되지 않아 현재 기준 환율({activeMeta.localPerUsd.toLocaleString()} {activeMeta.currency})로 표시 중입니다.
          </div>
        )}

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
