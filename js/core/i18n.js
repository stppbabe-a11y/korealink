// i18n.js | 다국어 처리. 기본은 영어(en), 브라우저/폰 언어에 맞춰 자동 선택.
// 문구는 js/locales/*.js 에 있습니다. 새 언어를 추가하려면 locales 파일을 하나 만들고
// 아래 DICTS 와 LANGS 에 한 줄씩 추가하면 됩니다. (없는 문구는 영어로 대체되어 보임)
import en from '../locales/en.js';
import ko from '../locales/ko.js';
import ja from '../locales/ja.js';
import zh from '../locales/zh.js';
import zhTW from '../locales/zhTW.js';
import es from '../locales/es.js';
import fr from '../locales/fr.js';
import de from '../locales/de.js';
import ru from '../locales/ru.js';
import vi from '../locales/vi.js';
import th from '../locales/th.js';
import id from '../locales/id.js';
import { emit } from './store.js';

const DICTS = { en, ko, ja, zh, 'zh-TW': zhTW, es, fr, de, ru, vi, th, id };
export const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ru', label: 'Русский' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'th', label: 'ไทย' },
  { code: 'id', label: 'Bahasa Indonesia' },
];
const HTML_LANG = { en: 'en', ko: 'ko', ja: 'ja', zh: 'zh-CN', 'zh-TW': 'zh-TW', es: 'es', fr: 'fr', de: 'de', ru: 'ru', vi: 'vi', th: 'th', id: 'id' };

let current = 'en';
export const getLang = () => current;

export function initLang() {
  let saved = null;
  try { saved = localStorage.getItem('bt_lang'); } catch { /* 저장소 사용 불가 */ }
  const nav = (navigator.language || 'en').toLowerCase();
  const guess = /^zh-(tw|hk|mo|hant)/.test(nav) ? 'zh-TW' : nav.slice(0, 2);
  const pick = DICTS[saved] ? saved : DICTS[guess] ? guess : 'en';
  apply(pick);
}

function apply(code) {
  current = code;
  document.documentElement.lang = HTML_LANG[code] ?? 'en';
  document.title = DICTS[code]['app.name'] ?? 'KoreaLink';
}

export function setLang(code, { persist = true } = {}) {
  if (!DICTS[code] || code === current) return;
  apply(code);
  if (persist) {
    try { localStorage.setItem('bt_lang', code); } catch { /* 무시 */ }
  }
  emit('lang', code);
}

// t('key', { name: 'Kim' })  ->  문구 안의 {name} 을 값으로 바꿔 줌
export function t(key, vars) {
  let s = DICTS[current][key] ?? DICTS.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
  return s;
}

// "3분 전" 같은 상대 시간 (브라우저 내장 Intl 사용)
export function timeAgo(dateLike) {
  const d = new Date(dateLike);
  const diff = (d.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(current, { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 45) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return formatDate(d);
}

export function formatDate(dateLike, opts = { year: 'numeric', month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat(current, opts).format(new Date(dateLike));
}

export function formatTime(dateLike) {
  return new Intl.DateTimeFormat(current, { hour: '2-digit', minute: '2-digit' }).format(new Date(dateLike));
}

// "토 11월 22일 오후 7:30" 같은 날짜+시간 (모임 시간 표시용)
export function formatDateTime(dateLike) {
  return new Intl.DateTimeFormat(current, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(dateLike));
}
export function formatWeekday(dateLike) {
  return new Intl.DateTimeFormat(current, { weekday: 'short' }).format(new Date(dateLike));
}
