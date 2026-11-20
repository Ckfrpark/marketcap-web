export interface RankingItem {
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
}

export interface DailySnapshot {
  date: string;
  total_assets: number;
  total_market_cap_usd: number;
  fx_rates: Record<string, number>;
  rankings: RankingItem[];
}

export type CurrencyCode = 'USD' | 'KRW' | 'EUR' | 'JPY' | 'CNY';

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  KRW: '₩',
  EUR: '€',
  JPY: '¥',
  CNY: '¥',
};

export function convertFromUsd(
  amountUsd: number,
  currency: CurrencyCode,
  fxRates: Record<string, number>
): number {
  if (currency === 'USD') return amountUsd;
  const usdPerUnit = fxRates?.[currency];
  if (!usdPerUnit || usdPerUnit <= 0) return amountUsd;
  return amountUsd / usdPerUnit;
}

export function formatMarketCap(
  amountUsd: number,
  currency: CurrencyCode,
  fxRates: Record<string, number>
): string {
  const val = convertFromUsd(amountUsd, currency, fxRates);
  const sym = CURRENCY_SYMBOLS[currency];

  if (currency === 'KRW') {
    const jo = val / 1e12;
    if (jo >= 1) return `${sym}${jo.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}조`;
    const eok = val / 1e8;
    return `${sym}${eok.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}억`;
  }

  if (val >= 1e12) return `${sym}${(val / 1e12).toFixed(3)} T`;
  if (val >= 1e9) return `${sym}${(val / 1e9).toFixed(2)} B`;
  if (val >= 1e6) return `${sym}${(val / 1e6).toFixed(2)} M`;
  return `${sym}${val.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

export function formatPrice(
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

export function getCountryFlag(countryCode: string, assetType: string): string {
  if (assetType === 'CRYPTO' || !countryCode || countryCode === 'GLOBAL') return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
