"use client";

import React, { useEffect, useMemo, useState } from "react";

export type RankingAssetItem = {
  ticker?: string;
  name?: string;
  asset_type?: string;
  country_code?: string | null;
  market_cap_usd?: number | null;
  price_usd?: number | null;
  change_pct?: number | null;
  rank?: number | null;
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

export function CountryDropdownMenu({
  rankings,
  selectedCountry,
  onSelectCountry,
  onSelectAllCountries,
}: {
  rankings: RankingAssetItem[];
  selectedCountry: string;
  onSelectCountry: (code: string) => void;
  onSelectAllCountries?: () => void;
}) {
  const stockCountByCountry = new Map<string, number>();
  for (const row of rankings || []) {
    if (row.asset_type === "STOCK" && row.country_code) {
      const code = String(row.country_code).toUpperCase().trim();
      stockCountByCountry.set(code, (stockCountByCountry.get(code) || 0) + 1);
    }
  }

  const isCountryVisible = (code: string): boolean => {
    const upper = code.toUpperCase().trim();
    if (upper === "EU") {
      return EU_MEMBER_CODES.some((member) => (stockCountByCountry.get(member) || 0) >= 2);
    }
    return (stockCountByCountry.get(upper) || 0) >= 2;
  };

  const visibleRegions = COUNTRY_REGIONS.map((region) => ({
    ...region,
    items: region.items.filter((item) => isCountryVisible(item.code)),
  })).filter((region) => region.items.length > 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-6 rounded-xl bg-[#0b1020] border border-slate-800 shadow-2xl">
      {visibleRegions.map((region, idx) => (
        <div key={region.title} className="space-y-3">
          <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase pb-2 border-b border-slate-800">
            {region.title}
          </div>
          <div className="flex flex-col space-y-1">
            {region.items.map((item) => {
              const active = (selectedCountry || "").toUpperCase() === item.code;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => onSelectCountry(item.code)}
                  className={`flex items-center gap-3 px-2.5 py-2 rounded-lg text-left text-sm transition ${
                    active
                      ? "bg-indigo-600/25 text-indigo-300 font-semibold"
                      : "text-slate-200 hover:bg-slate-800/70"
                  }`}
                >
                  <span className="w-6 text-xs font-bold text-slate-400 shrink-0">
                    {item.code}
                  </span>
                  <span className="truncate">{item.name}</span>
                </button>
              );
            })}
          </div>
          {idx === visibleRegions.length - 1 && onSelectAllCountries && (
            <button
              type="button"
              onClick={onSelectAllCountries}
              className="pt-2 text-sm font-medium text-indigo-400 hover:text-indigo-300"
            >
              &gt;&gt; All Countries
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const [snapshot, setSnapshot] = useState<SnapshotPayload | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);

  useEffect(() => {
    const r2Base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";
    const url = r2Base
      ? `${r2Base.replace(/\/$/, "")}/snapshots/rankings/2026-11-21.json`
      : "/snapshots/rankings/2026-11-21.json";

    fetch(url, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setSnapshot(data);
      })
      .catch(() => {});
  }, []);

  const rankings = snapshot?.rankings ?? [];

  const filteredItems = useMemo(() => {
    if (!selectedCountry) return rankings;
    const target = selectedCountry.toUpperCase();
    if (target === "EU") {
      return rankings.filter(
        (r) =>
          r.asset_type === "STOCK" &&
          r.country_code &&
          EU_MEMBER_CODES.includes(r.country_code.toUpperCase())
      );
    }
    return rankings.filter(
      (r) => (r.country_code || "").toUpperCase() === target
    );
  }, [rankings, selectedCountry]);

  return (
    <main className="min-h-screen bg-[#060913] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="relative inline-block">
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold"
          >
            Ranking by countries {selectedCountry ? `(${selectedCountry})` : "▾"}
          </button>

          {dropdownOpen && (
            <div className="mt-2 z-30 relative">
              <CountryDropdownMenu
                rankings={rankings}
                selectedCountry={selectedCountry}
                onSelectCountry={(code) => {
                  setSelectedCountry(code);
                  setDropdownOpen(false);
                }}
                onSelectAllCountries={() => {
                  setSelectedCountry("");
                  setDropdownOpen(false);
                }}
              />
            </div>
          )}
        </div>

        <div className="text-sm text-slate-300">
          기준일: {snapshot?.date ?? "2026-11-21"} · 표시 종목 수:{" "}
          {filteredItems.length.toLocaleString()}개
        </div>
      </div>
    </main>
  );
}
