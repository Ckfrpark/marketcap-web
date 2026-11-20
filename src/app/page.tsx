"use client";

import React, { useEffect, useMemo, useState } from "react";

type AssetType = "ALL" | "STOCK" | "ETF" | "CRYPTO";
type SortMetric =
  | "market_cap_usd"
  | "revenue_usd"
  | "earnings_usd"
  | "pe_ratio"
  | "dividend_yield"
  | "operating_margin"
  | "pb_ratio"
  | "employees";

interface RankingItem {
  rank: number;
  ticker: string;
  name: string;
  asset_type: string;
  country_code?: string | null;
  logo_path?: string | null;
  market_cap_usd?: number | null;
  price_usd?: number | null;
  change_pct?: number | null;
  sparkline_30d?: number[] | null;
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

interface SnapshotPayload {
  date?: string;
  total_assets?: number;
  total_market_cap_usd?: number;
  fx_rates?: Record<string, number>;
  rankings: RankingItem[];
}

const SNAPSHOT_URL =
  process.env.NEXT_PUBLIC_LATEST_SNAPSHOT_URL ||
  "https://pub-your-r2-bucket.r2.dev/snapshots/rankings/latest.json";

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

const SORT_OPTIONS: { key: SortMetric; label: string }[] = [
  { key: "market_cap_usd", label: "Market Cap" },
  { key: "revenue_usd", label: "Revenue" },
  { key: "earnings_usd", label: "Earnings" },
  { key: "pe_ratio", label: "P/E" },
  { key: "dividend_yield", label: "Dividend %" },
  { key: "operating_margin", label: "Operating Margin" },
  { key: "pb_ratio", label: "P/B" },
  { key: "employees", label: "Employees" },
];

function formatMoney(
  usdVal: number | null | undefined,
  currency: string,
  fxRates: Record<string, number>
): string {
  if (usdVal === null || usdVal === undefined || Number.isNaN(usdVal)) return "-";
  const curr = currency.toUpperCase();
  if (curr === "KRW") {
    const rate = fxRates["KRW"] || 1 / 1400;
    const krw = usdVal / rate;
    const jo = krw / 1_0000_0000_0000; // 1조 = 10^12
    return `${jo.toLocaleString("ko-KR", {
      maximumFractionDigits: jo >= 100 ? 0 : 1,
    })}조`;
  }
  const rate = fxRates[curr] || 1;
  const converted = usdVal / rate;
  const abs = Math.abs(converted);
  const symbol = curr === "USD" ? "$" : `${curr} `;
  if (abs >= 1e12) return `${symbol}${(converted / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${symbol}${(converted / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${symbol}${(converted / 1e6).toFixed(2)}M`;
  return `${symbol}${converted.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatMetricValue(
  item: RankingItem,
  metric: SortMetric,
  currency: string,
  fxRates: Record<string, number>
): string {
  if (metric === "market_cap_usd") return formatMoney(item.market_cap_usd, currency, fxRates);
  if (metric === "revenue_usd") return formatMoney(item.revenue_usd, currency, fxRates);
  if (metric === "earnings_usd") return formatMoney(item.earnings_usd, currency, fxRates);
  if (metric === "employees") {
    return item.employees ? item.employees.toLocaleString("en-US") : "-";
  }
  if (metric === "pe_ratio") {
    return item.pe_ratio != null ? item.pe_ratio.toFixed(2) : "-";
  }
  if (metric === "dividend_yield") {
    return item.dividend_yield != null ? `${item.dividend_yield.toFixed(2)}%` : "-";
  }
  if (metric === "operating_margin") {
    return item.operating_margin != null ? `${item.operating_margin.toFixed(2)}%` : "-";
  }
  if (metric === "pb_ratio") {
    return item.pb_ratio != null ? item.pb_ratio.toFixed(2) : "-";
  }
  return "-";
}

function CountryDropdownMenu({
  rankings,
  selectedCountry,
  onSelectCountry,
  onSelectAllCountries,
}: {
  rankings: RankingItem[];
  selectedCountry: string;
  onSelectCountry: (code: string) => void;
  onSelectAllCountries: () => void;
}) {
  const stockCountByCountry = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rankings || []) {
      if (row.ticker?.toUpperCase() === "GOOG") continue;
      if (row.asset_type === "STOCK" && row.country_code) {
        const code = row.country_code.toUpperCase().trim();
        counts.set(code, (counts.get(code) || 0) + 1);
      }
    }
    return counts;
  }, [rankings]);

  const isCountryVisible = (code: string) => {
    const upper = code.toUpperCase().trim();
    if (upper === "EU") {
      return EU_MEMBER_CODES.some((c) => (stockCountByCountry.get(c) || 0) >= 2);
    }
    return (stockCountByCountry.get(upper) || 0) >= 2;
  };

  const visibleRegions = useMemo(
    () =>
      COUNTRY_REGIONS.map((region) => ({
        ...region,
        items: region.items.filter((item) => isCountryVisible(item.code)),
      })).filter((region) => region.items.length > 0),
    [stockCountByCountry]
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-6 rounded-xl bg-[#0b1020] border border-slate-800 shadow-2xl">
      {visibleRegions.map((region, idx) => (
        <div key={region.title} className="space-y-3">
          <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase pb-2 border-b border-slate-800">
            {region.title}
          </div>
          <div className="flex flex-col space-y-1">
            {region.items.map((item) => {
              const active = selectedCountry.toUpperCase() === item.code;
              const cnt =
                item.code === "EU"
                  ? EU_MEMBER_CODES.reduce(
                      (acc, c) => acc + (stockCountByCountry.get(c) || 0),
                      0
                    )
                  : stockCountByCountry.get(item.code) || 0;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => onSelectCountry(item
