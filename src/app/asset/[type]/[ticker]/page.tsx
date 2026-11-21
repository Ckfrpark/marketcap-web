'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type AssetType = 'STOCK' | 'ETF' | 'CRYPTO';
type CurrencyCode = 'USD' | 'KRW' | 'EUR' | 'JPY' | 'CNY';

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

interface HistoryPoint {
  date: string;
  price_usd: number;
  market_cap_usd: number;
  rank: number;
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

function getRecentDates(baseDateStr: string, count: number): string[] {
  const parsed = new Date(`${baseDateStr}T00:00:00Z`);
  const base = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(base.getTime() - i * 86400 * 1000);
    dates.push(dt.toISOString().slice(0, 10));
  }
  return dates;
}

function DetailPriceChart({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) {
    return (
      <div className="h-44 flex items-center justify-center text-sm text-slate-400">
        30일 추이 데이터가 부족합니다.
      </div>
    );
  }
  const width = 640;
  const height = 176;
  const padX = 12;
  const padY = 14;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const coords = data.map((v, i) => {
    const x = padX + (i / (data.length - 1)) * (width - padX * 2);
    const y = height - padY - ((v - min) / range) * (height - padY * 2);
    return { x, y, v };
  });

  const linePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPoints = `${coords[0].x.toFixed(1)},${(height - padY).toFixed(1)} ${linePoints} ${coords[coords.length - 1].x.toFixed(1)},${(height - padY).toFixed(1)}`;
  const strokeColor = positive ? '#10b981' : '#f43f5e';
  const fillColor = positive ? 'rgba(16, 185, 129, 0.14)' : 'rgba(244, 63, 94, 0.14)';

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
        <polygon fill={fillColor} points={areaPoints} />
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={linePoints}
        />
      </svg>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>30D 최저: ${min.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
        <span>30D 최고: ${max.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
      </div>
    </div>
  );
}

export default function AssetDetailPage() {
  const params = useParams<{ type?: string; ticker?: string }>();
  const targetType = String(params?.type || '').trim().toUpperCase();
  const targetTicker = decodeURIComponent(String(params?.ticker || '').trim().toUpperCase());

  const [snapshot, setSnapshot] = useState<DailySnapshot | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let active = true;
    async function loadDetail() {
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
        if (!active) return;
        setSnapshot(data);

        const candidateDates = getRecentDates(data.date, 7);
        const histList: HistoryPoint[] = [];

        await Promise.all(
          candidateDates.map(async (dStr) => {
            try {
              const snapRes = await fetch(
                `${R2_BASE_URL}/snapshots/rankings/${dStr}.json`,
                { cache: 'no-store' }
              );
              if (!snapRes.ok) return;
              const snapJson: DailySnapshot = await snapRes.json();
              const found = (snapJson.rankings || []).find(
                (it) =>
                  String(it.ticker || '').trim().toUpperCase() === targetTicker &&
                  (!targetType ||
                    targetType === 'ALL' ||
                    String(it.asset_type || '').trim().toUpperCase() === targetType)
              );
              if (found) {
                histList.push({
                  date: snapJson.date || dStr,
                  price_usd: Number(found.price_usd || 0),
                  market_cap_usd: Number(found.market_cap_usd || 0),
                  rank: Number(found.rank || 0),
                });
              }
            } catch {
              // 특정 일자 스냅샷 부재는 무시
            }
          })
        );

        histList.sort((a, b) => b.date.localeCompare(a.date));
        if (active) {
          setHistory(histList);
        }
      } catch (err: unknown) {
        if (active) {
          setErrorMsg(
            err instanceof Error ? err.message : '상세 정보를 불러오는 중 오류가 발생했습니다.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    if (targetTicker) {
      loadDetail();
    } else {
      setLoading(false);
      setErrorMsg('잘못된 자산 경로입니다.');
    }

    return () => {
      active = false;
    };
  }, [targetTicker, targetType]);

  const asset = useMemo(() => {
    const list = snapshot?.rankings || [];
    return (
      list.find(
        (it) =>
          String(it.ticker || '').trim().toUpperCase() === targetTicker &&
          (!targetType ||
            targetType === 'ALL' ||
            String(it.asset_type || '').trim().toUpperCase() === targetType)
      ) ||
      list.find((it) => String(it.ticker || '').trim().toUpperCase() === targetTicker) ||
      null
    );
  }, [snapshot, targetTicker, targetType]);

  const positive = Number(asset?.change_pct || 0) >= 0;

  const statRows = useMemo(() => {
    if (!asset) return [];
    const fmtInt = (v: number | null | undefined) =>
      v === null || v === undefined || !Number.isFinite(Number(v))
        ? '-'
        : Math.round(Number(v)).toLocaleString('en-US');
    const fmtRatio = (v: number | null | undefined) =>
      v === null || v === undefined || !Number.isFinite(Number(v))
        ? '-'
        : Number(v).toFixed(2);
    const fmtPct = (v: number | null | undefined) =>
      v === null || v === undefined || !Number.isFinite(Number(v))
        ? '-'
        : `${Number(v).toFixed(2)}%`;

    return [
      {
        label: '시가총액',
        value: formatMoneyMetric(asset.market_cap_usd, currency, snapshot?.fx_rates),
      },
      {
        label: '매출 (TTM)',
        value: formatMoneyMetric(asset.revenue_usd, currency, snapshot?.fx_rates),
      },
      {
        label: '순이익 (TTM)',
        value: formatMoneyMetric(asset.earnings_usd, currency, snapshot?.fx_rates),
      },
      {
        label: '직원 수',
        value: fmtInt(asset.employees),
      },
      {
        label: 'P/E ratio',
        value: fmtRatio(asset.pe_ratio),
      },
      {
        label: '배당수익률',
        value: fmtPct(asset.dividend_yield),
      },
      {
        label: '영업이익률',
        value: fmtPct(asset.operating_margin),
      },
      {
        label: '총자산',
        value: formatMoneyMetric(asset.total_assets_usd, currency, snapshot?.fx_rates),
      },
      {
        label: '순자산',
        value: formatMoneyMetric(asset.net_assets_usd, currency, snapshot?.fx_rates),
      },
      {
        label: '총부채(부채총계)',
        value: formatMoneyMetric(asset.total_liabilities_usd, currency, snapshot?.fx_rates),
      },
      {
        label: '총차입부채',
        value: formatMoneyMetric(asset.total_debt_usd, currency, snapshot?.fx_rates),
      },
      {
        label: '현금성자산',
        value: formatMoneyMetric(asset.total_cash_usd, currency, snapshot?.fx_rates),
      },
      {
        label: 'Price to Book (PBR)',
        value: fmtRatio(asset.pb_ratio),
      },
    ];
  }, [asset, currency, snapshot?.fx_rates]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 md:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-800 transition"
          >
            <span>←</span>
            <span>전체 랭킹으로 돌아가기</span>
          </Link>

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
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-12 text-center text-slate-400">
            자산 상세 정보를 불러오는 중입니다...
          </div>
        ) : errorMsg ? (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-6 text-sm text-rose-300">
            {errorMsg}
          </div>
        ) : !asset ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-12 text-center space-y-3">
            <p className="text-slate-300 font-medium">
              해당 자산({targetTicker}) 정보를 현재 스냅샷에서 찾을 수 없습니다.
            </p>
            <Link
              href="/"
              className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              랭킹 목록으로 이동
            </Link>
          </div>
        ) : (
          <>
            <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 flex flex-wrap items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
                    #{asset.rank}
                  </span>
                  <span className="rounded bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
                    {asset.asset_type}
                  </span>
                  {asset.country_code && (
                    <span className="rounded bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
                      {asset.country_code}
                    </span>
                  )}
                  {asset.sector && (
                    <span className="rounded bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
                      {asset.sector}
                    </span>
                  )}
                  {asset.industry && (
                    <span className="rounded bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
                      {asset.industry}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">{asset.name}</h1>
                <p className="text-sm font-mono text-slate-400">{asset.ticker}</p>
              </div>

              <div className="text-left sm:text-right space-y-1">
                <p className="text-xs text-slate-400">현재가 ({currency})</p>
                <p className="text-3xl font-bold text-white">
                  {formatPrice(asset.price_usd, currency, snapshot?.fx_rates)}
                </p>
                <p
                  className={`text-sm font-semibold ${
                    positive ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  24h {positive ? '+' : ''}
                  {Number(asset.change_pct || 0).toFixed(2)}%
                </p>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white">30일 가격 추이 (USD)</h2>
                  <span className="text-xs text-slate-400">스냅샷 기반</span>
                </div>
                <DetailPriceChart data={asset.sparkline_30d || []} positive={positive} />
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
                <h2 className="text-base font-semibold text-white">최근 일자별 스냅샷</h2>
                {history.length === 0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">
                    추가 일자 이력이 아직 없습니다.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-800 text-sm">
                    {history.map((h) => (
                      <div key={h.date} className="py-2.5 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium text-slate-200">{h.date}</div>
                          <div className="text-xs text-slate-400">순위 #{h.rank || '-'}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-white">
                            {formatPrice(h.price_usd, currency, snapshot?.fx_rates)}
                          </div>
                          <div className="text-xs text-slate-400">
                            {formatMoneyMetric(h.market_cap_usd, currency, snapshot?.fx_rates)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">
                  주요 시가총액 · 재무 · 기업 지표 ({currency})
                </h2>
                <span className="text-xs text-slate-400">미수집 항목은 `-` 표시</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {statRows.map((row) => (
                  <div
                    key={row.label}
                    className="rounded-lg border border-slate-800/90 bg-slate-950/60 p-3.5"
                  >
                    <p className="text-xs text-slate-400">{row.label}</p>
                    <p className="mt-1 text-base font-semibold text-white">{row.value}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
