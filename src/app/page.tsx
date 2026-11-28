'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import HistoryChart2000 from '@/components/HistoryChart2000';

type AssetType = 'STOCK' | 'ETF' | 'CRYPTO';
type CurrencyCode = 'USD' | 'KRW' | 'EUR' | 'JPY' | 'CNY';

type RankMetricKey =
  | 'market_cap_usd'
  | 'earnings_usd'
  | 'revenue_usd'
  | 'employees'
  | 'pe_ratio'
  | 'dividend_yield'
  | 'operating_margin'
  | 'total_assets_usd'
  | 'net_assets_usd'
  | 'total_liabilities_usd'
  | 'total_debt_usd'
  | 'total_cash_usd'
  | 'pb_ratio';

interface MetricOption {
  key: RankMetricKey;
  label: string;
  columnTitle: string;
  kind: 'money' | 'integer' | 'ratio' | 'percent';
}

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

interface CategoryRule {
  label: string;
  keywords: string[];
  tickers?: string[];
  assetTypes?: AssetType[];
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

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  UK: 'United Kingdom',
  JP: 'Japan',
  CN: 'China',
  DE: 'Germany',
  FR: 'France',
  CA: 'Canada',
  KR: 'South Korea',
  IN: 'India',
  AU: 'Australia',
  CH: 'Switzerland',
  NL: 'Netherlands',
  SE: 'Sweden',
  DK: 'Denmark',
  NO: 'Norway',
  IL: 'Israel',
  SG: 'Singapore',
  BM: 'Bermuda',
  IE: 'Ireland',
  MY: 'Malaysia',
  ZA: 'South Africa',
  CL: 'Chile',
  TR: 'Turkey',
  BR: 'Brazil',
  TW: 'Taiwan',
  HK: 'Hong Kong',
  SA: 'Saudi Arabia',
  ID: 'Indonesia',
  MX: 'Mexico',
  ES: 'Spain',
  IT: 'Italy',
};

function formatCountryLabel(countryCode?: string | null): string {
  const code = String(countryCode || '').trim().toUpperCase();
  if (!code) return '-';
  return COUNTRY_NAMES[code] || code;
}

const RANK_METRICS: MetricOption[] = [
  { key: 'market_cap_usd', label: 'Market Cap', columnTitle: '시가총액', kind: 'money' },
  { key: 'earnings_usd', label: 'Earnings', columnTitle: '순이익 (TTM)', kind: 'money' },
  { key: 'revenue_usd', label: 'Revenue', columnTitle: '매출 (TTM)', kind: 'money' },
  { key: 'employees', label: 'Employees', columnTitle: '직원 수', kind: 'integer' },
  { key: 'pe_ratio', label: 'P/E ratio', columnTitle: 'P/E ratio', kind: 'ratio' },
  { key: 'dividend_yield', label: 'Dividend %', columnTitle: '배당수익률', kind: 'percent' },
  { key: 'operating_margin', label: 'Operating Margin', columnTitle: '영업이익률', kind: 'percent' },
  { key: 'total_assets_usd', label: 'Total assets', columnTitle: '총자산', kind: 'money' },
  { key: 'net_assets_usd', label: 'Net assets', columnTitle: '순자산', kind: 'money' },
  { key: 'total_liabilities_usd', label: 'Total liabilities', columnTitle: '총부채(부채총계)', kind: 'money' },
  { key: 'total_debt_usd', label: 'Total debt', columnTitle: '총차입부채', kind: 'money' },
  { key: 'total_cash_usd', label: 'Cash on hand', columnTitle: '현금성자산', kind: 'money' },
  { key: 'pb_ratio', label: 'Price to Book', columnTitle: 'PBR', kind: 'ratio' },
];

const CATEGORY_RULES: CategoryRule[] = [
  {
    label: 'AI',
    keywords: [
      'artificial intelligence', 'ai ', ' ai', 'generative ai', 'machine learning',
      'neural', 'openai', 'anthropic', 'palantir', 'super micro', 'smci',
    ],
    tickers: ['NVDA', 'MSFT', 'GOOGL', 'META', 'AVGO', 'TSM', 'AMD', 'PLTR', 'ARM', 'SMCI', 'ORCL'],
  },
  {
    label: 'Semiconductors',
    keywords: [
      'semiconductor', 'chip', 'wafer', 'foundry', 'lithography', 'memory',
      'dram', 'nand', 'microchip', 'integrated circuit',
    ],
    tickers: ['NVDA', 'TSM', 'AVGO', 'ASML', 'AMD', 'QCOM', 'TXN', 'INTC', 'MU', 'AMAT', 'LRCX', 'KLAC', 'ARM', '005930.KS', '000660.KS'],
  },
  {
    label: 'Software',
    keywords: [
      'software', 'saas', 'cloud', 'enterprise software', 'application software',
      'infrastructure software', 'cybersecurity', 'operating system', 'database',
    ],
    tickers: ['MSFT', 'ORCL', 'CRM', 'SAP', 'ADBE', 'NOW', 'INTU', 'PLTR', 'SNOW', 'PANW', 'CRWD'],
  },
  {
    label: 'Tech',
    keywords: [
      'technology', 'hardware', 'consumer electronics', 'computer', 'server',
      'electronics', 'information technology',
    ],
    tickers: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AVGO', 'TSM', '005930.KS'],
  },
  {
    label: 'Internet',
    keywords: [
      'internet', 'search engine', 'social media', 'digital media', 'streaming',
      'online media', 'advertising', 'alphabet', 'meta platforms',
    ],
    tickers: ['GOOGL', 'META', 'NFLX', 'SPOT', 'UBER', 'ABNB', 'BKNG'],
  },
  {
    label: 'E-Commerce',
    keywords: [
      'e-commerce', 'ecommerce', 'online retail', 'marketplace', 'amazon',
      'alibaba', 'pinduoduo', 'mercadolibre', 'shopify', 'coupang',
    ],
    tickers: ['AMZN', 'BABA', 'PDD', 'MELI', 'SHOP', 'JD'],
  },
  {
    label: 'Retail',
    keywords: [
      'retail', 'department store', 'hypermarket', 'supermarket', 'discount store',
      'warehouse club', 'home improvement', 'apparel retail', 'specialty retail',
    ],
    tickers: ['WMT', 'COST', 'HD', 'LOW', 'TJX', 'TGT', 'AMZN'],
  },
  {
    label: 'Automakers',
    keywords: [
      'auto manufacturers', 'automaker', 'automobile', 'electric vehicle', 'ev ',
      'motor vehicle', 'car ', 'vehicles', 'ferrari', 'toyota', 'tesla', 'byd',
    ],
    tickers: ['TSLA', '7203.T', 'RACE', 'BYDDY', 'TM', 'HMC', '005380.KS'],
  },
  {
    label: 'Banks',
    keywords: [
      'banks—diversified', 'banks—regional', 'bank', 'banking', 'commercial bank',
      'jpmorgan', 'bank of america', 'wells fargo', 'citigroup', 'hsbc',
    ],
    tickers: ['JPM', 'BAC', 'WFC', 'C', 'HSBC', 'RY', 'TD', 'UBS', '105560.KS', '055550.KS'],
  },
  {
    label: 'Investment',
    keywords: [
      'asset management', 'investment banking', 'capital markets', 'private equity',
      'wealth management', 'brokerage', 'blackrock', 'goldman sachs', 'morgan stanley',
    ],
    tickers: ['BRK-B', 'BLK', 'GS', 'MS', 'BX', 'SCHW', 'KKR'],
  },
  {
    label: 'Financial services',
    keywords: [
      'financial services', 'credit services', 'payment', 'fintech',
      'financial data', 'stock exchanges',
    ],
    tickers: ['V', 'MA', 'BRK-B', 'AXP', 'PYPL', 'FISV'],
  },
  {
    label: 'Insurance',
    keywords: [
      'insurance', 'life insurance', 'property & casualty', 'reinsurance',
      'insurer', 'allianz', 'aia', 'progressive', 'chubb',
    ],
    tickers: ['BRK-B', 'PGR', 'CB', 'MMC', 'UNH', 'AIAGY', 'ALV.DE'],
  },
  {
    label: 'Pharmaceuticals',
    keywords: [
      'drug manufacturers', 'pharmaceutical', 'pharma', 'biotechnology', 'biotech',
      'eli lilly', 'novo nordisk', 'johnson & johnson', 'abbvie', 'merck', 'astrazeneca',
    ],
    tickers: ['LLY', 'NVO', 'JNJ', 'ABBV', 'MRK', 'AZN', 'NVS', 'SNY', '207940.KS'],
  },
  {
    label: 'Healthcare',
    keywords: [
      'healthcare', 'health care', 'medical devices', 'diagnostics', 'hospitals',
      'health plan', 'medical instruments', 'unitedhealth',
    ],
    tickers: ['UNH', 'JNJ', 'LLY', 'ABT', 'TMO', 'ISRG', 'SYK', 'MDT'],
  },
  {
    label: 'Oil&Gas',
    keywords: [
      'oil & gas', 'integrated oil', 'oil and gas', 'petroleum', 'energy',
      'refining', 'lng', 'exxon', 'chevron', 'aramco', 'shell',
    ],
    tickers: ['2222.SR', 'XOM', 'CVX', 'SHEL', 'TTE', 'COP'],
  },
  {
    label: 'Electricity',
    keywords: [
      'utilities—regulated electric', 'utilities—renewable', 'electric utilities',
      'power', 'electricity', 'grid', 'nextera', 'duke energy',
    ],
    tickers: ['NEE', 'DUK', 'SO', 'CEG', 'AEP'],
  },
  {
    label: 'Chemicals',
    keywords: [
      'chemicals', 'specialty chemicals', 'agricultural inputs', 'industrial gases',
      'linde', 'sherwin-
