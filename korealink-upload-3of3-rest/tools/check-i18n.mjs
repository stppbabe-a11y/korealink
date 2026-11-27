// check-i18n.mjs | 번역 점검: 코드에서 쓰는 문구가 모든 언어 파일에 있는지, {변수} 가 빠지지 않았는지 확인
// 실행: npm run check:i18n
import { usedKeys } from './extract-keys.mjs';

const LANGS = ['en', 'ko', 'ja', 'zh', 'zhTW', 'es', 'fr', 'de', 'ru', 'vi', 'th', 'id'];
const dicts = {};
for (const l of LANGS) dicts[l] = (await import(`../js/locales/${l}.js`)).default;

const used = usedKeys();
const problems = [];
const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

for (const k of used) {
  if (!(k in dicts.en)) problems.push(`영어(en)에 없는 문구: ${k}`);
}
for (const l of LANGS.filter((x) => x !== 'en')) {
  for (const k of Object.keys(dicts.en)) {
    if (!(k in dicts[l])) problems.push(`${l} 에 번역 없음: ${k}`);
    else if (vars(dicts[l][k]) !== vars(dicts.en[k])) problems.push(`${l} 의 {변수}가 영어와 다름: ${k}  (en: ${vars(dicts.en[k]) || '-'} / ${l}: ${vars(dicts[l][k]) || '-'})`);
    if (k in dicts[l] && String(dicts[l][k]).trim() === '') problems.push(`${l} 의 빈 문구: ${k}`);
  }
  for (const k of Object.keys(dicts[l])) if (!(k in dicts.en)) problems.push(`${l} 에만 있는 문구(오타?): ${k}`);
}
const unused = Object.keys(dicts.en).filter((k) => !used.includes(k));

if (problems.length) {
  console.error(`\n❌ 번역 점검 실패 (${problems.length}건)\n`);
  problems.forEach((p) => console.error(' - ' + p));
  process.exit(1);
}
console.log(`✅ 번역 점검 통과  (사용 문구 ${used.length}개 × 언어 ${LANGS.length}개 모두 존재, {변수} 일치)`);
if (unused.length) console.log(`   참고: 코드에서 쓰지 않는 문구 ${unused.length}개 → ${unused.join(', ')}`);
