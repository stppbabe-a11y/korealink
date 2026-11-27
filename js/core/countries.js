// countries.js | 프로필의 국가 선택 (국가 이름은 브라우저가 사용자 언어로 자동 번역)
import { getLang } from './i18n.js';

export const COUNTRY_CODES = [
  'KR', 'JP', 'CN', 'TW', 'HK', 'MO', 'SG', 'TH', 'VN', 'PH', 'ID', 'MY', 'KH', 'LA', 'MM', 'IN', 'NP',
  'MN', 'KZ', 'UZ', 'RU', 'US', 'CA', 'MX', 'BR', 'AR', 'GB', 'IE', 'FR', 'DE', 'ES', 'IT', 'NL', 'BE',
  'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'PT', 'GR', 'TR', 'IL', 'AE', 'SA', 'EG', 'ZA', 'NG',
  'KE', 'AU', 'NZ',
];

export function countryName(code) {
  try {
    return new Intl.DisplayNames([getLang()], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function flag(code) {
  if (!/^[A-Z]{2}$/.test(code ?? '')) return '';
  return String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)));
}

export function countryLabel(code) {
  return code ? `${flag(code)} ${countryName(code)}` : '';
}

export function countryOptions() {
  const list = COUNTRY_CODES.map((code) => ({ value: code, label: countryLabel(code) }));
  list.sort((a, b) => a.label.localeCompare(b.label, getLang()));
  return list;
}
