'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface RankingItem {
  rank: number;
  ticker: string;
  name: string;
  asset_type: 'STOCK' | 'ETF' | 'CRYPTO';
  country_code: string;
  logo_path: string | null;
  market_cap_usd: number;
  price_usd: number;
  change_pct: number;
  sparkline_30d: number[];
  sector?: string | null;
  industry?: string | null;
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

const RANK_METRICS: {
  id: RankMetricKey;
  label: string;
  colTitle: string;
  kind: 'money' | 'int' | 'ratio' | 'pct';
}[] = [
  { id: 'market_cap_usd', label: 'Market Cap', colTitle: '시가총액', kind: 'money' },
  { id: 'earnings_usd', label: 'Earnings', colTitle: '순이익 (Earnings)', kind: 'money' },
  { id: 'revenue_usd', label: 'Revenue', colTitle: '매출 (Revenue)', kind: 'money' },
  { id: 'employees', label: 'Employees', colTitle: '임직원 수', kind: 'int' },
  { id: 'pe_ratio', label: 'P/E ratio', colTitle: 'PER (P/E)', kind: 'ratio' },
  { id: 'dividend_yield', label: 'Dividend %', colTitle: '배당수익률', kind: 'pct' },
  { id: 'operating_margin', label: 'Operating Margin', colTitle: '영업이익률', kind: 'pct' },
  { id: 'total_assets_usd', label: 'Total assets', colTitle: '총자산', kind: 'money' },
  { id: 'net_assets_usd', label: 'Net assets', colTitle: '순자산', kind: 'money' },
  { id: 'total_liabilities_usd', label: 'Total liabilities', colTitle: '총부채', kind: 'money' },
  { id: 'total_debt_usd', label: 'Total debt', colTitle: '총차입금', kind: 'money' },
  { id: 'total_cash_usd', label: 'Cash on hand', colTitle: '현금성자산', kind: 'money' },
  { id: 'pb_ratio', label: 'Price to Book', colTitle: 'PBR (P/B)', kind: 'ratio' },
];

const EU_CODES = ['DE', 'FR', 'NL', 'ES', 'IT', 'DK', 'SE', 'PL', 'FI', 'IE', 'BE', 'AT'];

const COUNTRY_GROUPS: {
  region: string;
  items: { code: string; name: string; flag: string }[];
}[] = [
  {
    region: 'America',
    items: [
      { code: 'US', name: 'United States', flag: '🇺🇸' },
      { code: 'CA', name: 'Canada', flag: '🇨🇦' },
      { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
      { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
      { code: 'CL', name: 'Chile', flag: '🇨🇱' },
    ],
  },
  {
    region: 'Europe',
    items: [
      { code: 'EU', name: 'European Union', flag: '🇪🇺' },
      { code: 'DE', name: 'Germany', flag: '🇩🇪' },
      { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
      { code: 'FR', name: 'France', flag: '🇫🇷' },
      { code: 'ES', name: 'Spain', flag: '🇪🇸' },
      { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
      { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
      { code: 'IT', name: 'Italy', flag: '🇮🇹' },
      { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
      { code: 'PL', name: 'Poland', flag: '🇵🇱' },
      { code: 'FI', name: 'Finland', flag: '🇫🇮' },
    ],
  },
  {
    region: 'Asia',
    items: [
      { code: 'CN', name: 'China', flag: '🇨🇳' },
      { code: 'JP', name: 'Japan', flag: '🇯🇵' },
      { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
      { code: 'HK', name: 'Hong Kong', flag: '🇭🇰' },
      { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
      { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
      { code: 'IN', name: 'India', flag: '🇮🇳' },
      { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
      { code: 'TW', name: 'Taiwan', flag: '🇹🇼' },
      { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
      { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
    ],
  },
  {
    region: 'Others',
    items: [
      { code: 'AU', name: 'Australia', flag: '🇦🇺' },
      { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
      { code: 'IL', name: 'Israel', flag: '🇮🇱' },
      { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
      { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
      { code: 'RU', name: 'Russia', flag: '🇷🇺' },
      { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
    ],
  },
];

interface CategoryDef {
  id: string;
  name: string;
  icon: string;
  keywords: string[];
  tickers?: string[];
}

const CATEGORY_COLUMNS: CategoryDef[][] = [
  [
    { id: 'ALL', name: 'All assets by Market Cap', icon: '🏆', keywords: [] },
    {
      id: 'automakers',
      name: 'Automakers',
      icon: '🚗',
      keywords: ['motor', 'auto', 'tesla', 'toyota', 'hyundai', 'kia', 'byd', 'ferrari', 'ford', 'general motors', 'volkswagen', 'bmw', 'mercedes', 'honda', 'rivian', 'stellantis'],
      tickers: ['TSLA', '7203.T', '005380.KS', '000270.KS', '1211.HK', 'RACE.MI', 'F', 'GM', 'RIVN', 'LCID', '7267.T'],
    },
    {
      id: 'airlines',
      name: 'Airlines',
      icon: '✈️',
      keywords: ['airline', 'air lines', 'airways', 'delta air', 'united airlines', 'american airlines', 'southwest airlines', 'ryanair'],
      tickers: ['DAL', 'UAL', 'AAL', 'LUV', 'ALK', 'JBLU'],
    },
    {
      id: 'aircraft',
      name: 'Aircraft & Defense',
      icon: '🛩️',
      keywords: ['aerospace', 'aircraft', 'boeing', 'airbus', 'lockheed', 'northrop', 'raytheon', 'general dynamics', 'hanwha aerospace'],
      tickers: ['BA', 'AIR.PA', 'LMT', 'RTX', 'NOC', 'GD', 'GE', '012450.KS'],
    },
    {
      id: 'banks',
      name: 'Banks',
      icon: '🏦',
      keywords: ['bank', 'bancorp', 'jpmorgan', 'wells fargo', 'citigroup', 'hsbc', 'financial group', 'icbc', 'santander', 'unicredit', 'ubs'],
      tickers: ['JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', '105560.KS', '055550.KS', '086790.KS', '8306.T', '8316.T', '0939.HK', '1398.HK', 'HSBA.L', 'RY.TO', 'TD.TO', 'HDFCBANK.NS', 'CBA.AX'],
    },
    {
      id: 'hotels',
      name: 'Hotels & Resorts',
      icon: '🏨',
      keywords: ['hotel', 'marriott', 'hilton', 'hyatt', 'resort', 'mgm', 'las vegas sands', 'wynn', 'booking', 'airbnb'],
      tickers: ['MAR', 'HLT', 'H', 'MGM', 'LVS', 'WYNN', 'BKNG', 'ABNB'],
    },
    {
      id: 'pharma',
      name: 'Pharmaceuticals',
      icon: '💊',
      keywords: ['pharma', 'eli lilly', 'novo nordisk', 'johnson & johnson', 'pfizer', 'merck', 'abbvie', 'novartis', 'roche', 'astrazeneca', 'sanofi', 'amgen', 'gilead', 'bristol-myers', 'celltrion', 'biologics'],
      tickers: ['LLY', 'NOVO-B.CO', 'JNJ', 'ABBV', 'MRK', 'PFE', 'NVS', 'NOVN.SW', 'ROG.SW', 'AZN', 'AZN.L', 'SAN.PA', 'AMGN', 'GILD', 'BMY', '207940.KS', '068270.KS', '4519.T', '4568.T'],
    },
    {
      id: 'ecommerce',
      name: 'E-Commerce',
      icon: '🛒',
      keywords: ['amazon', 'alibaba', 'jd.com', 'pdd', 'mercadolibre', 'shopify', 'coupang', 'ebay', 'etsy', 'meituan'],
      tickers: ['AMZN', '9988.HK', 'BABA', 'PDD', 'MELI', 'SHOP', 'SHOP.TO', 'CPNG', 'EBAY', 'ETSY', '3690.HK', '9618.HK'],
    },
    {
      id: 'healthcare',
      name: 'Healthcare',
      icon: '⚕️',
      keywords: ['health', 'medical', 'unitedhealth', 'intuitive surgical', 'medtronic', 'stryker', 'boston scientific', 'thermo fisher', 'danaher', 'abbott', 'elevance', 'cigna', 'cvs'],
      tickers: ['UNH', 'ISRG', 'TMO', 'ABT', 'DHR', 'SYK', 'BSX', 'MDT', 'ELV', 'CI', 'CVS', 'HCA'],
    },
  ],
  [
    {
      id: 'logistics',
      name: 'Courier & Logistics',
      icon: '📦',
      keywords: ['parcel', 'fedex', 'ups', 'united parcel', 'dhl', 'expeditors', 'union pacific', 'csx', 'norfolk southern', 'railroad'],
      tickers: ['UPS', 'FDX', 'UNP', 'CSX', 'NSC', 'EXPD', 'JBHT', 'ODFL'],
    },
    {
      id: 'media',
      name: 'Media / Entertainment',
      icon: '📰',
      keywords: ['netflix', 'disney', 'comcast', 'warner', 'spotify', 'paramount', 'fox', 'sony', 'live nation'],
      tickers: ['NFLX', 'DIS', 'CMCSA', 'WBD', 'SPOT', 'FOX', 'FOXA', 'LYV', '6758.T'],
    },
    {
      id: 'beverages',
      name: 'Beverages',
      icon: '🥤',
      keywords: ['coca-cola', 'pepsico', 'monster beverage', 'keurig', 'constellation brands', 'brown-forman', 'diageo', 'anheuser', 'heineken', 'starbucks'],
      tickers: ['KO', 'PEP', 'MNST', 'KDP', 'STZ', 'BF-B', 'DEO', 'BUD', 'SBUX'],
    },
    {
      id: 'clothing',
      name: 'Clothing & Luxury',
      icon: '👕',
      keywords: ['lvmh', 'hermes', 'nike', 'inditex', 'fast retailing', 'lululemon', 'ralph lauren', 'tapestry', 'ross stores', 'tjx'],
      tickers: ['MC.PA', 'RMS.PA', 'NKE', 'ITX.MC', '9983.T', 'LULU', 'RL', 'TPR', 'TJX', 'ROST'],
    },
    {
      id: 'mining',
      name: 'Mining & Metals',
      icon: '⛏️',
      keywords: ['mining', 'rio tinto', 'bhp', 'newmont', 'freeport', 'nucor', 'posco', 'steel', 'gold', 'copper', 'vale'],
      tickers: ['RIO.L', 'RIO', 'BHP.AX', 'BHP', 'FCX', 'NEM', 'NUE', 'STLD', '005490.KS', 'VALE'],
    },
    {
      id: 'insurance',
      name: 'Insurance',
      icon: '🏛️',
      keywords: ['insurance', 'berkshire', 'progressive', 'chubb', 'allianz', 'aia group', 'ping an', 'tokio marine', 'aflac', 'metlife', 'prudential', 'travelers'],
      tickers: ['BRK-B', 'BRK-A', 'PGR', 'CB', 'ALV.DE', '1299.HK', '2318.HK', '8766.T', 'AFL', 'MET', 'PRU', 'TRV', 'AIG'],
    },
    {
      id: 'realestate',
      name: 'Real Estate & REITs',
      icon: '🏠',
      keywords: ['realty', 'prologis', 'american tower', 'equinix', 'digital realty', 'simon property', 'public storage', 'welltower', 'crown castle', 'vici'],
      tickers: ['PLD', 'AMT', 'EQIX', 'DLR', 'SPG', 'PSA', 'WELL', 'CCI', 'O', 'VICI'],
    },
  ],
  [
    {
      id: 'food',
      name: 'Food & Consumer',
      icon: '🍴',
      keywords: ['nestle', 'mondelez', 'kraft heinz', 'general mills', 'hershey', 'tyson', 'kellanova', 'hormel', 'procter & gamble', 'unilever', 'colgate', 'l\'oreal'],
      tickers: ['NESN.SW', 'PG', 'ULVR.L', 'UL', 'MDLZ', 'KHC', 'GIS', 'HSY', 'TSN', 'CL', 'OR.PA', 'KMB'],
    },
    {
      id: 'restaurants',
      name: 'Restaurant Chains',
      icon: '🍔',
      keywords: ['mcdonald', 'chipotle', 'yum!', 'domino', 'darden', 'texas roadhouse', 'wingstop', 'restaurant'],
      tickers: ['MCD', 'CMG', 'YUM', 'DPZ', 'DRI', 'TXRH', 'WING', 'QSR'],
    },
    {
      id: 'software',
      name: 'Software',
      icon: '💻',
      keywords: ['microsoft', 'oracle', 'salesforce', 'sap', 'adobe', 'servicenow', 'intuit', 'palantir', 'palo alto', 'crowdstrike', 'snowflake', 'workday', 'autodesk', 'synopsys', 'cadence', 'fortinet', 'datadog'],
      tickers: ['MSFT', 'ORCL', 'CRM', 'SAP', 'SAP.DE', 'ADBE', 'NOW', 'INTU', 'PLTR', 'PANW', 'CRWD', 'SNOW', 'WDAY', 'ADSK', 'SNPS', 'CDNS', 'FTNT', 'DDOG', 'TEAM'],
    },
    {
      id: 'semiconductors',
      name: 'Semiconductors',
      icon: '📟',
      keywords: ['nvidia', 'tsmc', 'broadcom', 'asml', 'samsung electronics', 'sk hynix', 'amd', 'qualcomm', 'texas instruments', 'applied materials', 'micron', 'intel', 'lam research', 'analog devices', 'kla', 'tokyo electron', 'mediatek', 'arm'],
      tickers: ['NVDA', '2330.TW', 'TSM', 'AVGO', 'ASML', 'ASML.AS', '005930.KS', '000660.KS', 'AMD', 'QCOM', 'TXN', 'AMAT', 'MU', 'INTC', 'LRCX', 'ADI', 'KLAC', '8035.T', '2454.TW', 'ARM', 'MRVL'],
    },
    {
      id: 'financial',
      name: 'Financial Services',
      icon: '💳',
      keywords: ['visa', 'mastercard', 'american express', 'blackrock', 's&p global', 'charles schwab', 'moody', 'paypal', 'coinbase', 'intercontinental exchange', 'cme group', 'fiserv'],
      tickers: ['V', 'MA', 'AXP', 'BLK', 'SPGI', 'SCHW', 'MCO', 'PYPL', 'COIN', 'ICE', 'CME', 'FI', 'KKR', 'BX', 'APO'],
    },
    {
      id: 'oilgas',
      name: 'Oil & Gas',
      icon: '🛢️',
      keywords: ['aramco', 'exxon', 'chevron', 'shell', 'totalenergies', 'conocophillips', 'bp', 'schlumberger', 'eog', 'marathon', 'valero', 'phillips 66', 'enbridge', 'cnooc', 'reliance'],
      tickers: ['2222.SR', 'XOM', 'CVX', 'SHEL.L', 'SHEL', 'TTE.PA', 'TTE', 'COP', 'BP', 'SLB', 'EOG', 'MPC', 'VLO', 'PSX', 'ENB.TO', '0883.HK', 'RELIANCE.NS'],
    },
    {
      id: 'utilities',
      name: 'Electricity & Utilities',
      icon: '🔋',
      keywords: ['nextera', 'southern company', 'duke energy', 'constellation energy', 'vistra', 'american electric', 'dominion', 'sempra', 'exelon', 'energy', 'power'],
      tickers: ['NEE', 'SO', 'DUK', 'CEG', 'VST', 'AEP', 'D', 'SRE', 'EXC', 'PCG', 'PEG'],
    },
  ],
  [
    {
      id: 'chemicals',
      name: 'Chemicals',
      icon: '🧪',
      keywords: ['linde', 'air products', 'sherwin-williams', 'ecolab', 'dow', 'dupont', 'shin-etsu', 'lg chem', 'basf', 'chemical'],
      tickers: ['LIN', 'APD', 'SHW', 'ECL', 'DOW', 'DD', '4063.T', '051910.KS', 'PPG', 'LYB'],
    },
    {
      id: 'telecom',
      name: 'Telecommunication',
      icon: '📡',
      keywords: ['t-mobile', 'at&t', 'verizon', 'deutsche telekom', 'china mobile', 'ntt', 'kddi', 'softbank', 'bharti airtel', 'telecom', 'communications'],
      tickers: ['TMUS', 'T', 'VZ', 'DTE.DE', '0941.HK', '9432.T', '9433.T', '9984.T', 'BHARTIARTL.NS'],
    },
    {
      id: 'retail',
      name: 'Retail',
      icon: '🛍️',
      keywords: ['walmart', 'costco', 'home depot', 'lowe\'s', 'target', 'o\'reilly', 'autozone', 'walgreens', 'dollar general', 'kroger'],
      tickers: ['WMT', 'COST', 'HD', 'LOW', 'TGT', 'ORLY', 'AZO', 'KR', 'DG', 'DLTR'],
    },
    {
      id: 'internet',
      name: 'Internet & Social',
      icon: '🖥️',
      keywords: ['alphabet', 'google', 'meta platforms', 'tencent', 'naver', 'kakao', 'baidu', 'netease', 'pinterest', 'snap', 'uber', 'doordash'],
      tickers: ['GOOGL', 'GOOG', 'META', '0700.HK', '035420.KS', '035720.KS', '9999.HK', 'UBER', 'DASH', 'PINS', 'SNAP'],
    },
    {
      id: 'construction',
      name: 'Construction & Industrial',
      icon: '🏗️',
      keywords: ['caterpillar', 'siemens', 'schneider electric', 'honeywell', 'deere', 'eaton', 'emerson', 'abb', 'hitachi', 'keyence', 'trane', 'carrier', 'otis', '3m', 'samsung c&t'],
      tickers: ['CAT', 'SIE.DE', 'SU.PA', 'HON', 'DE', 'ETN', 'EMR', 'ABBN.SW', '6501.T', '6861.T', 'TT', 'CARR', 'OTIS', 'MMM', '028260.KS', '329180.KS'],
    },
    {
      id: 'gaming',
      name: 'Video Games',
      icon: '🎮',
      keywords: ['nintendo', 'electronic arts', 'take-two', 'roblox', 'netease', 'tencent', 'sony', 'game'],
      tickers: ['7974.T', 'EA', 'TTWO', 'RBLX', '9999.HK', '0700.HK', '6758.T'],
    },
    {
      id: 'tech',
      name: 'Tech (All Technology)',
      icon: '💻',
      keywords: ['apple', 'microsoft', 'nvidia', 'alphabet', 'amazon', 'meta', 'tsmc', 'broadcom', 'oracle', 'samsung', 'asml', 'salesforce', 'cisco', 'ibm', 'accenture', 'qualcomm', 'amd', 'adobe', 'intel', 'sony', 'xiaomi'],
      tickers: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'GOOG', 'AMZN', 'META', '2330.TW', 'TSM', 'AVGO', 'ORCL', '005930.KS', '000660.KS', 'ASML', 'ASML.AS', 'CRM', 'CSCO', 'IBM', 'ACN', 'QCOM', 'AMD', 'ADBE', 'INTC', '1810.HK'],
    },
    {
      id: 'ai',
      name: 'AI (Artificial Intelligence)',
      icon: '🦾',
      keywords: ['nvidia', 'microsoft', 'alphabet', 'meta', 'palantir', 'broadcom', 'tsmc', 'amd', 'oracle', 'servicenow', 'arista', 'super micro', 'arm', 'snowflake', 'crowdstrike'],
      tickers: ['NVDA', 'MSFT', 'GOOGL', 'GOOG', 'META', 'PLTR', 'AVGO', '2330.TW', 'TSM', 'AMD', 'ORCL', 'NOW', 'ANET', 'SMCI', 'ARM', 'SNOW', 'CRWD', '000660.KS'],
    },
  ],
];

const ALL_CATEGORIES = CATEGORY_COLUMNS.flat();
const ALL_CATEGORY_MAP = Object.fromEntries(ALL_CATEGORIES.map((c) => [c.id, c]));

function matchesCategory(item: RankingItem, cat: CategoryDef): boolean {
  if (cat.id === 'ALL') return true;
  if (item.asset_type !== 'STOCK') return false;
  const tickerUpper = item.ticker.toUpperCase();
  if (cat.tickers && cat.tickers.includes(tickerUpper)) return true;

  const haystack = `${item.name} ${item.sector || ''} ${item.industry || ''}`.toLowerCase();
  return cat.keywords.some((kw) => haystack.includes(kw));
}

const ALL_COUNTRY_MAP = Object.fromEntries(
  COUNTRY_GROUPS.flatMap((g) => g.items.map((c) => [c.code, c]))
);

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  KRW: '₩',
  EUR: '€',
  JPY: '¥',
  CNY: '¥',
};

const R2_BASE =
  process.env.NEXT_PUBLIC_R2_BASE_URL ||
  'https://pub-abab619513474306a997568b43202499.r2.dev';

function getTodayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getPastDates(baseDateStr: string, days: number, step: number): string[] {
  const base = new Date(`${baseDateStr}T00:00:00Z`);
  const list: string[] = [];
  for (let d = days; d >= 0; d -= step) {
    const dt = new Date(base.getTime() - d * 86400 * 1000);
    list.push(dt.toISOString().slice(0, 10));
  }
  if (list[list.length - 1] !== baseDateStr) list.push(baseDateStr);
  return list;
}

function convertFromUsd(
  amountUsd: number,
  currency: CurrencyCode,
  fxRates: Record<string, number>
): number {
  if (currency === 'USD') return amountUsd;
  const usdPerUnit = fxRates?.[currency];
  if (!usdPerUnit || usdPerUnit <= 0) return amountUsd;
  return amountUsd / usdPerUnit;
}

function formatMarketCap(
  amountUsd: number,
  currency: CurrencyCode,
  fxRates: Record<string, number>
): string {
  const sign = amountUsd < 0 ? '-' : '';
  const val = Math.abs(convertFromUsd(amountUsd, currency, fxRates));
  const sym = CURRENCY_SYMBOLS[currency];

  if (currency === 'KRW') {
    const jo = val / 1e12;
    if (jo >= 1) return `${sign}${sym}${Math.round(jo).toLocaleString('ko-KR')}조`;
    const eok = val / 1e8;
    return `${sign}${sym}${Math.round(eok).toLocaleString('ko-KR')}억`;
  }

  if (val >= 999.5e9) return `${sign}${sym}${(val / 1e12).toFixed(3)} T`;
  if (val >= 1e9) return `${sign}${sym}${Math.round(val / 1e9).toLocaleString('en-US')} B`;
  if (val >= 1e6) return `${sign}${sym}${(val / 1e6).toFixed(2)} M`;
  return `${sign}${sym}${val.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function formatMetricCell(
  item: RankingItem,
  metricKey: RankMetricKey,
  currency: CurrencyCode,
  fxRates: Record<string, number>
): string {
  const raw = item[metricKey];
  if (raw === null || raw === undefined || Number.isNaN(raw)) return '-';
  const meta = RANK_METRICS.find((m) => m.id === metricKey)!;
  if (meta.kind === 'money') return formatMarketCap(raw, currency, fxRates);
  if (meta.kind === 'int') return `${Math.round(raw).toLocaleString('en-US')}명`;
  if (meta.kind === 'pct') return `${raw.toFixed(2)}%`;
  return `${raw.toFixed(2)}x`;
}

function formatPrice(
  priceUsd: number,
  currency: CurrencyCode,
  fxRates: Record<string, number>
): string {
  const val = convertFromUsd(priceUsd, currency, fxRates);
  const sym = CURRENCY_SYMBOLS[currency];

  if (currency === 'KRW' || currency === 'JPY') {
    return `${sym}${Math.round(val).toLocaleString('en-US')}`;
  }
  return `${sym}${val.toLocaleString('en-US', {
    minimumFractionDigits: val < 1 ? 4 : 2,
    maximumFractionDigits: val < 1 ? 4 : 2,
  })}`;
}

function getCountryFlag(countryCode: string, assetType: string): string {
  if (assetType === 'CRYPTO' || !countryCode || countryCode.toUpperCase() === 'GLOBAL') return '🌐';
  const codePoints = countryCode
    .trim()
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) {
    return <span className="text-xs text-slate-400">-</span>;
  }

  const width = 108;
  const height = 32;
  const padding = 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, idx) => {
      const x = padding + (idx / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((val - min) / range) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const strokeColor = positive ? '#10b981' : '#ef4444';

  return (
    <svg width={width} height={height} className="overflow-visible inline-block">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function DetailedAreaChart({
  points,
  metric,
  currency,
  fxRates,
}: {
  points: HistoryPoint[];
  metric: 'market_cap_usd' | 'price_usd' | 'rank';
  currency: CurrencyCode;
  fxRates: Record<string, number>;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-400">
        차트를 그릴 과거 스냅샷 데이터가 부족합니다.
      </div>
    );
  }

  const width = 680;
  const height = 240;
  const padX = 16;
  const padY = 20;

  const values = points.map((p) => p[metric]);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const coords = points.map((p, idx) => {
    const x = padX + (idx / (points.length - 1)) * (width - padX * 2);
    const ratio =
      metric === 'rank'
        ? (maxVal - p[metric]) / range
        : (p[metric] - minVal) / range;
    const y = height - padY - ratio * (height - padY * 2);
    return { x, y, point: p };
  });

  const linePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPoints = `${coords[0].x.toFixed(1)},${height - padY} ${linePoints} ${coords[
    coords.length - 1
  ].x.toFixed(1)},${height - padY}`;

  const isUp =
    metric === 'rank'
      ? points[points.length - 1].rank <= points[0].rank
      : points[points.length - 1][metric] >= points[0][metric];
  const stroke = isUp ? '#10b981' : '#f43f5e';

  const active = hoverIdx !== null ? coords[hoverIdx] : coords[coords.length - 1];

  const formatMetric = (p: HistoryPoint) => {
    if (metric === 'market_cap_usd') return formatMarketCap(p.market_cap_usd, currency, fxRates);
    if (metric === 'price_usd') return formatPrice(p.price_usd, currency, fxRates);
    return `#${p.rank}위`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between bg-slate-950/60 border border-slate-800 rounded-lg px-4 py-2.5">
        <div>
          <span className="text-xs text-slate-400 mr-2">{active.point.date}</span>
          <span className="text-lg font-bold text-white">{formatMetric(active.point)}</span>
        </div>
        <div className="text-xs text-slate-400">
          순위 <span className="text-slate-200 font-semibold">#{active.point.rank}</span> · 주가{' '}
          <span className="text-slate-200 font-semibold">
            {formatPrice(active.point.price_usd, currency, fxRates)}
          </span>
        </div>
      </div>

      <div className="relative w-full overflow-hidden rounded-xl bg-slate-950/50 border border-slate-800 p-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-60 select-none cursor-crosshair"
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <polygon points={areaPoints} fill="url(#chartGrad)" />
          <polyline
            fill="none"
            stroke={stroke}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={linePoints}
          />
          {active && (
            <>
              <line
                x1={active.x}
                y1={padY}
                x2={active.x}
                y2={height - padY}
                stroke="#475569"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <circle cx={active.x} cy={active.y} r="4.5" fill={stroke} stroke="#0f172a" strokeWidth="2" />
            </>
          )}
          {coords.map((c, idx) => {
            const sliceW = (width - padX * 2) / coords.length;
            return (
              <rect
                key={c.point.date}
                x={c.x - sliceW / 2}
                y={0}
                width={Math.max(sliceW, 4)}
                height={height}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(idx)}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayUtcDate());
  const [snapshot, setSnapshot] = useState<DailySnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [rankBy, setRankBy] = useState<RankMetricKey>('market_cap_usd');

  const [selectedCountry, setSelectedCountry] = useState<string>('ALL');
  const [countryMenuOpen, setCountryMenuOpen] = useState<boolean>(false);
  const [showAllCountriesModal, setShowAllCountriesModal] = useState<boolean>(false);

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [categoryMenuOpen, setCategoryMenuOpen] = useState<boolean>(false);
  const [showAllCategoriesModal, setShowAllCategoriesModal] = useState<boolean>(false);

  const navRef = useRef<HTMLDivElement | null>(null);

  const [assetFilter, setAssetFilter] = useState<'ALL' | 'STOCK' | 'ETF' | 'CRYPTO'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string
