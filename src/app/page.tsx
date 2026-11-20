"use client";

import React, { useEffect, useMemo, useState } from "react";

interface RankingItem {
  rank: number;
  ticker: string;
  name: string;
  asset_type: "STOCK" | "ETF" | "CRYPTO" | string;
  country_code: string;
  logo_path?: string | null;
  market_cap_usd: number;
  price_usd: number;
  change_pct: number;
  sparkline_30d?: number[];
}

interface SnapshotData {
  date: string;
  total_assets: number;
  total_market_cap_usd: number;
  fx_rates?: Record<string, number>;
  rankings: RankingItem[];
}

type CurrencyCode = "USD" | "KRW" | "EUR" | "JPY" | "CNY";
type AssetFilter = "ALL" | "STOCK" | "ETF" | "CRYPTO";
type ChartPeriod = "30D" | "90D" | "365D" | "10Y";

const CURRENCY_META: Record<CurrencyCode, { symbol: string; label: string }> = {
  USD: { symbol: "$", label: "USD" },
  KRW: { symbol: "₩", label: "KRW" },
  EUR: { symbol: "€", label: "EUR" },
  JPY: { symbol: "¥", label: "JPY" },
  CNY: { symbol: "¥", label: "CNY" },
};

const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸",
  KR: "🇰🇷",
  JP: "🇯🇵",
  CN: "🇨🇳",
  HK: "🇭🇰",
  TW: "🇹🇼",
  GB: "🇬🇧",
  DE: "🇩🇪",
  FR: "🇫🇷",
  CH: "🇨🇭",
  NL: "🇳🇱",
  DK: "🇩🇰",
  ES: "🇪🇸",
  IT: "🇮🇹",
  IN: "🇮🇳",
  CA: "🇨🇦",
  AU: "🇦🇺",
  SA: "🇸🇦",
  GLOBAL: "🌐",
};

function formatCountryBadge(rawCode?: string) {
  const code = (rawCode || "US").trim().toUpperCase();
  const flag = COUNTRY_FLAGS[code] || "🏳️";
  return `${flag} ${code}`;
}

function getConversionMultiplier(currency: CurrencyCode, fxRates?: Record<string, number>): number {
  if (currency === "USD" || !fxRates) return 1;
  const rateToUsd = fxRates[currency];
  if (rateToUsd && rateToUsd > 0) {
    return 1 / rateToUsd;
  }
  const fallback: Record<CurrencyCode, number> = {
    USD: 1,
    KRW: 1380,
    EUR: 0.92,
    JPY: 152,
    CNY: 7.24,
  };
  return fallback[currency] || 1;
}

function formatMarketCap(usdVal: number, currency: CurrencyCode, multiplier: number): string {
  const val = usdVal * multiplier;
  const sym = CURRENCY_META[currency].symbol;

  if (currency === "KRW") {
    const jo = val / 1_0000_0000_0000;
    if (jo >= 1) return `${sym}${jo.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}조`;
    const eok = val / 1_0000_0000;
    return `${sym}${eok.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}억`;
  }

  if (val >= 1e12) return `${sym}${(val / 1e12).toFixed(3)} T`;
  if (val >= 1e9) return `${sym}${(val / 1e9).toFixed(2)} B`;
  if (val >= 1e6) return `${sym}${(val / 1e6).toFixed(2)} M`;
  return `${sym}${val.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatPrice(usdVal: number, currency: CurrencyCode, multiplier: number): string {
  const val = usdVal * multiplier;
  const sym = CURRENCY_META[currency].symbol;
  if (currency === "KRW" || currency === "JPY") {
    return `${sym}${Math.round(val).toLocaleString("ko-KR")}`;
  }
  if (val >= 1) {
    return `${sym}${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${sym}${val.toFixed(4)}`;
}

function Sparkline({ data, positive }: { data?: number[]; positive: boolean }) {
  if (!data || data.length < 2) {
    return <span className="text-xs text-slate-600">-</span>;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 96;
  const height = 28;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible inline-block">
      <polyline
        fill="none"
        stroke={positive ? "#10b981" : "#f43f5e"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function HomePage() {
  const R2_BASE = (
    process.env.NEXT_PUBLIC_R2_BASE_URL ||
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_R2_URL ||
    "https://pub-63880054822e4f3e8c0969594b767054.r2.dev"
  ).replace(/\/$/, "");

  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [pageSize, setPageSize] = useState<number>(250);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showTopChart, setShowTopChart] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedAsset, setSelectedAsset] = useState<RankingItem | null>(null);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("365D");
  const [historySeries, setHistorySeries] = useState<{ date: string; marketCap: number; rank: number }[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    async function loadSnapshot() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const targetFile = selectedDate ? `${selectedDate}.json` : "latest.json";
        const url = `${R2_BASE}/snapshots/rankings/${targetFile}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`스냅샷 데이터를 불러오지 못했습니다 (${res.status})`);
        }
        const data: SnapshotData = await res.json();
        if (!cancelled) {
          setSnapshot(data);
          if (!selectedDate && data.date) {
            setSelectedDate(data.date);
          }
          setCurrentPage(1);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : "데이터 로드 중 오류가 발생했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, [R2_BASE, selectedDate]);

  useEffect(() => {
    if (!selectedAsset || !snapshot?.date) return;
    let cancelled = false;

    async function loadAssetHistory() {
      setHistoryLoading(true);
      try {
        const end = new Date(`${snapshot!.date}T00:00:00Z`);
        const config: Record<ChartPeriod, { days: number; step: number }> = {
          "30D": { days: 30, step: 2 },
          "90D": { days: 90, step: 5 },
          "365D": { days: 365, step: 15 },
          "10Y": { days: 3650, step: 90 },
        };
        const { days, step } = config[chartPeriod];
        const datesToFetch: string[] = [];
        for (let offset = days; offset >= 0; offset -= step) {
          const d = new Date(end.getTime() - offset * 86400 * 1000);
          datesToFetch.push(d.toISOString().slice(0, 10));
        }
        if (datesToFetch[datesToFetch.length - 1] !== snapshot!.date) {
          datesToFetch.push(snapshot!.date);
        }

        const results = await Promise.all(
          datesToFetch.map(async (dStr) => {
            try {
              const r = await fetch(`${R2_BASE}/snapshots/rankings/${dStr}.json`);
              if (!r.ok) return null;
              const j: SnapshotData = await r.json();
              const found = j.rankings.find(
                (it) => it.ticker === selectedAsset!.ticker && it.asset_type === selectedAsset!.asset_type
              );
              if (!found) return null;
              return { date: dStr, marketCap: found.market_cap_usd, rank: found.rank };
            } catch {
              return null;
            }
          })
        );

        if (!cancelled) {
          setHistorySeries(results.filter((x): x is { date: string; marketCap: number; rank: number } => x !== null));
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }

    loadAssetHistory();
    return () => {
      cancelled = true;
    };
  }, [selectedAsset, chartPeriod, snapshot, R2_BASE]);

  const multiplier = useMemo(
    () => getConversionMultiplier(currency, snapshot?.fx_rates),
    [currency, snapshot?.fx_rates]
  );

  const filteredRankings = useMemo(() => {
    if (!snapshot?.rankings) return [];
    const q = searchQuery.trim().toLowerCase();
    return snapshot.rankings.filter((item) => {
      if (assetFilter !== "ALL" && item.asset_type !== assetFilter) return false;
      if (!q) return true;
      return (
        item.ticker.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        (item.country_code || "").toLowerCase().includes(q)
      );
    });
  }, [snapshot?.rankings, assetFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRankings.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const startIdx = (safePage - 1) * pageSize;
    return filteredRankings.slice(startIdx, startIdx + pageSize);
  }, [filteredRankings, safePage, pageSize]);

  const top10Items = useMemo(() => filteredRankings.slice(0, 10), [filteredRankings]);
  const maxTop10Mcap = top10Items[0]?.market_cap_usd || 1;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🌍</span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Global MarketCap Tracker
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                LIVE
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              종목을 클릭하면 30일 · 90일 · 365일 · 10년 시가총액 및 순위 변동 그래프를 볼 수 있습니다
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex rounded-xl bg-[#0f1626] p-1 border border-slate-800">
              {(Object.keys(CURRENCY_META) as CurrencyCode[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    currency === c
                      ? "bg-indigo-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-[#0f1626] border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
              <span className="text-slate-400">📅 기준일</span>
              <input
                type="date"
                value={selectedDate}
                max={new Date().toISOString().slice(0, 10)}
                min="2016-11-20"
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-slate-200 font-medium focus:outline-none"
              />
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#0d1424] border border-slate-800/80 rounded-2xl p-5">
            <p className="text-xs text-slate-400">추적 자산 총 시가총액 ({currency})</p>
            <p className="text-2xl sm:text-3xl font-bold text-white mt-2">
              {snapshot ? formatMarketCap(snapshot.total_market_cap_usd, currency, multiplier) : "-"}
            </p>
          </div>

          <div className="bg-[#0d1424] border border-slate-800/80 rounded-2xl p-5">
            <p className="text-xs text-slate-400">집계 자산 수</p>
            <p className="text-2xl sm:text-3xl font-bold text-white mt-2">
              {snapshot ? `${snapshot.total_assets.toLocaleString()} 개` : "-"}
            </p>
          </div>

          <div className="bg-[#0d1424] border border-slate-800/80 rounded-2xl p-5">
            <p className="text-xs text-slate-400">스냅샷 기준일자 (UTC)</p>
            <p className="text-2xl sm:text-3xl font-bold text-indigo-400 mt-2">
              {snapshot?.date || selectedDate || "-"}
            </p>
          </div>
        </section>

        <section className="bg-[#0d1424] border border-slate-800/80 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>📊 Top 10 시가총액 비교 그래프</span>
                <span className="text-xs font-normal text-indigo-400">
                  ({assetFilter === "ALL" ? "전체 자산" : assetFilter})
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                막대를 클릭하면 해당 종목의 30일 · 90일 · 365일 · 10년 추이 차트가 열립니다
              </p>
            </div>
            <button
              onClick={() => setShowTopChart((prev) => !prev)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition shrink-0"
            >
              {showTopChart ? "그래프 접기 ▲" : "그래프 펼치기 ▼"}
            </button>
          </div>

          {showTopChart && top10Items.length > 0 && (
            <div className="mt-5 space-y-3">
              {top10Items.map((item, idx) => {
                const widthPct = Math.max(4, (item.market_cap_usd / maxTop10Mcap) * 100);
                const isPos = item.change_pct >= 0;
                return (
                  <button
                    key={`${item.asset_type}-${item.ticker}`}
                    onClick={() => setSelectedAsset(item)}
                    className="w-full text-left group flex items-center gap-3 hover:bg-slate-800/40 rounded-lg px-2 py-1 transition"
                  >
                    <span className="w-5 text-xs font-semibold text-slate-400 text-right">
                      {idx + 1}
                    </span>
                    <div className="w-44 sm:w-56 truncate text-xs sm:text-sm font-semibold text-slate-100 group-hover:text-indigo-300">
                      {item.name}{" "}
                      <span className="text-[11px] font-normal text-slate-500">{item.ticker}</span>
                    </div>
                    <div className="flex-1 h-4 bg-slate-900/90 rounded-md overflow-hidden">
                      <div
                        className="h-full rounded-md bg-gradient-to-r from-indigo-500 to-purple-500 group-hover:brightness-110 transition-all"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <div className="w-24 text-right text-xs sm:text-sm font-bold text-white">
                      {formatMarketCap(item.market_cap_usd, currency, multiplier)}
                    </div>
                    <div
                      className={`w-16 text-right text-xs font-semibold ${
                        isPos ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {isPos ? `+${item.change_pct.toFixed(2)}%` : `${item.change_pct.toFixed(2)}%`}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { key: "ALL", label: "전체 자산" },
                { key: "STOCK", label: "주식 (Stocks)" },
                { key: "ETF", label: "ETF" },
                { key: "CRYPTO", label: "암호화폐 (Crypto)" },
              ] as { key: AssetFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setAssetFilter(tab.key);
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  assetFilter === tab.key
                    ? "bg-white text-slate-950 shadow"
                    : "bg-[#0f1626] text-slate-300 border border-slate-800 hover:border-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}

            <div className="inline-flex items-center gap-1 bg-[#0f1626] border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs ml-1">
              <span className="text-slate-400 mr-1">표시:</span>
              {[100, 250, 500].map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                  className={`px-2 py-0.5 rounded-md font-semibold transition ${
                    pageSize === size
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {size}개
                </button>
              ))}
            </div>
          </div>

          <div className="w-full lg:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="종목명, 티커(AAPL, BTC), 국가 검색..."
              className="w-full bg-[#0f1626] border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            />
          </div>
        </section>

        <section className="bg-[#0d1424] border border-slate-800/80 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-400">데이터를 불러오는 중입니다...</div>
          ) : errorMsg ? (
            <div className="p-12 text-center text-sm text-rose-400">{errorMsg}</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/90 text-[11px] sm:text-xs text-slate-400 bg-[#0a101d]">
                      <th className="py-3.5 px-4 w-16 text-center">순위</th>
                      <th className="py-3.5 px-4">자산명 / 티커 (클릭 시 상세 차트)</th>
                      <th className="py-3.5 px-4 text-right">시가총액 ({currency})</th>
                      <th className="py-3.5 px-4 text-right">현재가 ({currency})</th>
                      <th className="py-3.5 px-4 text-right">24H 등락</th>
                      <th className="py-3.5 px-4 text-center">국가</th>
                      <th className="py-3.5 px-4 text-right">최근 30일 추이</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs sm:text-sm">
                    {paginatedItems.map((item) => {
                      const isPos = item.change_pct >= 0;
                      return (
                        <tr
                          key={`${item.asset_type}-${item.ticker}`}
                          onClick={() => setSelectedAsset(item)}
                          className="hover:bg-slate-800/40 cursor-pointer transition"
                        >
                          <td className="py-3.5 px-4 text-center font-semibold text-slate-300">
                            {item.rank}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-white">{item.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] font-medium text-slate-400">
                                {item.ticker}
                              </span>
                              <span className="px-1.5 py
