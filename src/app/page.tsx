"use client";

import React, { useEffect, useMemo, useState } from "react";

export type RankingAssetItem = {
  rank?: number | null;
  ticker?: string;
  name?: string;
  asset_type?: string;
  country_code?: string | null;
  logo_path?: string | null;
  market_cap_usd?: number | null;
  price_usd?: number | null;
  change_pct?: number | null;
  sparkline_30d?: number[];
};

type SnapshotPayload = {
  date?: string;
  total_assets?: number;
  total_market_cap_usd?: number;
  fx_rates?: Record<string, number>;
  rankings?: RankingAssetItem[];
};

const COUNTRY_REGIONS: {
  title: string;
  items: { code: string; name: string }[];
}[] = [
  {
    title: "AMERICA",
    items: [
      { code: "US", name: "United States" },
      { code: "CA", name: "Canada" },
      { code: "MX", name: "Mexico" },
      { code: "BR", name: "Brazil" },
      { code: "CL", name: "Chile" },
    ],
  },
  {
    title: "EUROPE",
    items: [
      { code: "EU", name: "European Union" },
      { code: "DE", name: "Germany" },
      { code: "GB", name: "United Kingdom" },
      { code: "FR", name: "France" },
      { code: "ES", name: "Spain" },
      { code: "NL", name: "Netherlands" },
      { code: "SE", name: "Sweden" },
      { code: "IT", name: "Italy" },
      { code: "CH", name: "Switzerland" },
      { code: "PL", name: "Poland" },
      { code: "FI", name: "Finland" },
    ],
  },
  {
    title: "ASIA",
    items: [
      { code: "CN", name: "China" },
      { code: "JP", name: "Japan" },
      { code: "KR", name: "South Korea" },
      { code: "HK", name: "Hong Kong" },
      { code: "SG", name: "Singapore" },
      { code: "ID", name: "Indonesia" },
      { code: "IN", name: "India" },
      { code: "MY", name: "Malaysia" },
      { code: "TW", name: "Taiwan" },
      { code: "TH", name: "Thailand" },
      { code: "VN", name: "Vietnam" },
    ],
  },
  {
    title: "OTHERS",
    items: [
      { code: "AU", name: "Australia" },
      { code: "NZ", name: "New Zealand" },
      { code: "IL", name: "Israel" },
      { code: "SA", name: "Saudi Arabia" },
      { code: "TR", name: "Turkey" },
      { code: "RU", name: "Russia" },
      { code: "ZA", name: "South Africa" },
    ],
  },
];

const EU_MEMBER_CODES = ["DE", "FR", "ES", "NL", "SE", "IT", "PL", "FI"];
const CURRENCIES = ["USD", "KRW", "EUR", "JPY", "CNY"] as const;

function formatCompactCurrency(usdValue: number, currency: string, fxRates?: Record<string, number>): string {
  const code = (currency || "USD").toUpperCase();
  const rate = code === "USD" ? 1 : Number(fxRates?.[code] || 1);
  const converted = usdValue * rate;
  const prefix =
    code === "KRW" ? "₩" : code === "EUR" ? "€" : code === "JPY" ? "¥" : code === "CNY" ? "CN¥" : "$";

  const absVal = Math.abs(converted);
  if (absVal >= 1e12) return `${prefix}${(converted / 1e12).toFixed(2)} T`;
  if (absVal >= 1e9) return `${prefix}${(converted / 1e9).toFixed(1)} B`;
  if (absVal >= 1e6) return `${prefix}${(converted / 1e6).toFixed(1)} M`;
  return `${prefix}${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function HomePage() {
  const [snapshot, setSnapshot] = useState<SnapshotPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [assetFilter, setAssetFilter] = useState<"ALL" | "STOCK" | "ETF" | "CRYPTO">("ALL");
  const [currency, setCurrency] = useState<string>("USD");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);

  useEffect(() => {
    const envBase = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "").trim().replace(/\/$/, "");
    const candidateUrls = [
      envBase ? `${envBase}/snapshots/rankings/latest.json` : "",
      "/api/snapshots/rankings/latest.json",
      "/snapshots/rankings/latest.json",
    ].filter(Boolean);

    let cancelled = false;
    (async () => {
      setLoading(true);
      for (const url of candidateUrls) {
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (res.ok) {
            const data = await res.json();
            if (!cancelled && data && Array.isArray(data.rankings)) {
              setSnapshot(data);
              setLoading(false);
              return;
            }
          }
        } catch {
          // 다음 후보 URL 시도
        }
      }
      if (!cancelled) {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const rankings = snapshot?.rankings ?? [];

  const availableCountryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of rankings) {
      if (String(item.asset_type || "").toUpperCase() === "CRYPTO") continue;
      const code = String(item.country_code || "").trim().toUpperCase();
      if (!code) continue;
      counts.set(code, (counts.get(code) || 0) + 1);
    }
    return counts;
  }, [rankings]);

  const visibleCountryRegions = useMemo(() => {
    if (rankings.length === 0) return COUNTRY_REGIONS;
    const hasCountry = (code: string) => {
      const upper = code.toUpperCase().trim();
      if (upper === "EU") {
        return EU_MEMBER_CODES.some((m) => (availableCountryCounts.get(m) || 0) > 0);
      }
      return (availableCountryCounts.get(upper) || 0) > 0;
    };

    return COUNTRY_REGIONS.map((region) => ({
      ...region,
      items: region.items.filter((item) => hasCountry(item.code)),
    })).filter((region) => region.items.length > 0);
  }, [rankings, availableCountryCounts]);

  useEffect(() => {
    if (!selectedCountry || rankings.length === 0) return;
    const target = selectedCountry.toUpperCase();
    const exists =
      target === "EU"
        ? EU_MEMBER_CODES.some((m) => (availableCountryCounts.get(m) || 0) > 0)
        : (availableCountryCounts.get(target) || 0) > 0;
    if (!exists) {
      setSelectedCountry("");
    }
  }, [rankings, selectedCountry, availableCountryCounts]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const targetCountry = selectedCountry.toUpperCase();

    return rankings.filter((item) => {
      const atype = String(item.asset_type || "STOCK").toUpperCase();
      if (assetFilter !== "ALL" && atype !== assetFilter) return false;

      if (targetCountry) {
        const ccode = String(item.country_code || "").toUpperCase();
        if (targetCountry === "EU") {
          if (!EU_MEMBER_CODES.includes(ccode)) return false;
        } else if (ccode !== targetCountry) {
          return false;
        }
      }

      if (q) {
        const sym = String(item.ticker || "").toLowerCase();
        const nm = String(item.name || "").toLowerCase();
        if (!sym.includes(q) && !nm.includes(q)) return false;
      }

      return true;
    });
  }, [rankings, assetFilter, selectedCountry, searchQuery]);

  const totalMarketCapUsd = useMemo(
    () => filteredItems.reduce((acc, cur) => acc + Number(cur.market_cap_usd || 0), 0),
    [filteredItems]
  );

  const activeCountryName = useMemo(() => {
    if (!selectedCountry) return "";
    for (const r of COUNTRY_REGIONS) {
      const found = r.items.find((i) => i.code === selectedCountry.toUpperCase());
      if (found) return `${found.code} ${found.name}`;
    }
    return selectedCountry;
  }, [selectedCountry]);

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100">
      <header className="border-b border-slate-800/80 bg-[#080d1a]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-lg font-bold tracking-tight text-white">Global MarketCap</span>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/20 text-emerald-300">
              LIVE
            </span>

            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition"
              >
                {activeCountryName ? `🌍 ${activeCountryName} ▾` : "Ranking by countries ▾"}
              </button>

              {dropdownOpen && (
                <div className="absolute left-0 mt-2 w-[min(92vw,880px)] z-40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-6 rounded-xl bg-[#0b1020] border border-slate-800 shadow-2xl">
                  {visibleCountryRegions.map((region, idx) => (
                    <div key={region.title} className="space-y-2.5">
                      <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase pb-1.5 border-b border-slate-800">
                        {region.title}
                      </div>
                      <div className="flex flex-col space-y-0.5">
                        {region.items.map((item) => {
                          const isSelected = selectedCountry.toUpperCase() === item.code;
                          return (
                            <button
                              key={item.code}
                              type="button"
                              onClick={() => {
                                setSelectedCountry(item.code);
                                setDropdownOpen(false);
                              }}
                              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-sm transition ${
                                isSelected
                                  ? "bg-indigo-600/30 text-indigo-200 font-semibold"
                                  : "text-slate-200 hover:bg-slate-800/70"
                              }`}
                            >
                              <span className="w-6 text-xs font-bold text-slate-400">{item.code}</span>
                              <span className="truncate">{item.name}</span>
                            </button>
                          );
                        })}
                      </div>
                      {idx === visibleCountryRegions.length - 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCountry("");
                            setDropdownOpen(false);
                          }}
                          className="pt-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                        >
                          &gt;&gt; All Countries
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-slate-900 p-1 border border-slate-800">
              {CURRENCIES.map((cur) => (
                <button
                  key={cur}
                  type="button"
                  onClick={() => setCurrency(cur)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                    currency === cur ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {cur}
                </button>
              ))}
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
              기준일 {snapshot?.date ?? "2026-11-21"}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {selectedCountry && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-indigo-950/40 border border-indigo-800/50">
            <span className="text-sm text-indigo-200">
              국가 필터 적용 중: <strong>{activeCountryName}</strong>
            </span>
            <button
              type="button"
              onClick={() => setSelectedCountry("")}
              className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
            >
              전체 국가 보기 ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl bg-[#0b1020] border border-slate-800">
            <div className="text-xs text-slate-400">합산 시가총액 ({currency})</div>
            <div className="mt-1 text-2xl font-bold text-white">
              {formatCompactCurrency(totalMarketCapUsd, currency, snapshot?.fx_rates)}
            </div>
          </div>
          <div className="p-5 rounded-xl bg-[#0b1020] border border-slate-800">
            <div className="text-xs text-slate-400">집계 자산 수</div>
            <div className="mt-1 text-2xl font-bold text-white">
              {filteredItems.length.toLocaleString()} 개
            </div>
          </div>
          <div className="p-5 rounded-xl bg-[#0b1020] border border-slate-800">
            <div className="text-xs text-slate-400">스냅샷 기준일자 (UTC)</div>
            <div className="mt-1 text-2xl font-bold text-indigo-400">
              {snapshot?.date ?? "2026-11-21"}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["ALL", "전체 자산"],
                ["STOCK", "주식 (Stocks)"],
                ["ETF", "ETF"],
                ["CRYPTO", "암호화폐 (Crypto)"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setAssetFilter(key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  assetFilter === key
                    ? "bg-white text-slate-950 border-white"
                    : "bg-[#0b1020] text-slate-300 border-slate-800 hover:border-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="종목명 또는 티커 검색..."
            className="w-full sm:w-64 px-3.5 py-1.5 rounded-lg bg-[#0b1020] border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0b1020]">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400">
                <th className="py-3 px-4 w-16">#</th>
                <th className="py-3 px-4">자산명</th>
                <th className="py-3 px-4">국가</th>
                <th className="py-3 px-4 text-right">시가총액 ({currency})</th>
                <th className="py-3 px-4 text-right">24h</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    스냅샷 데이터를 불러오는 중입니다...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400 space-y-3">
                    <div>선택한 국가/필터 조건에 해당하는 종목이 없습니다.</div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCountry("");
                        setAssetFilter("ALL");
                        setSearchQuery("");
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
                    >
                      필터 초기화
                    </button>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const chg = Number(item.change_pct || 0);
                  return (
                    <tr
                      key={`${item.asset_type || "ASSET"}-${item.ticker || idx}`}
                      className="border-b border-slate-800/60 hover:bg-slate-800/40"
                    >
                      <td className="py-3 px-4 text-slate-400 font-medium">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{item.name}</div>
                        <div className="text-xs text-slate-400">{item.ticker}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-300">
                        {item.country_code || (item.asset_type === "CRYPTO" ? "CRYPTO" : "-")}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-white">
                        {formatCompactCurrency(Number(item.market_cap_usd || 0), currency, snapshot?.fx_rates)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-medium ${
                          chg > 0 ? "text-emerald-400" : chg < 0 ? "text-rose-400" : "text-slate-400"
                        }`}
                      >
                        {chg > 0 ? `+${chg.toFixed(2)}%` : `${chg.toFixed(2)}%`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
