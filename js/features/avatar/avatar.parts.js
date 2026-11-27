// avatar.parts.js | 아바타 부품 목록 (그림 데이터). 새 부품/새 그림을 넣을 때는 이 파일만 고치면 됩니다.
//
// ★ 부품 추가 방법: 해당 목록 끝에 항목을 더하면 편집 화면에 자동으로 나타납니다.
//     { svg: '<path .../>' }                 → 모두에게 무료
//     { svg: '<path .../>', free: false }    → 잠긴 부품(유료 예정). 편집 화면에 🔒로 표시되고 선택/랜덤에서 제외됩니다.
//   그림은 viewBox "0 0 200 270" 기준 좌표입니다. 머리 중심은 (100,100).
// ★ 저장되는 값은 "번호"뿐입니다 (예: f2.s3.h4.hc1.br0.e2.m1.bl2.k2.o0). 번호 순서를 바꾸지 말고 "뒤에만" 추가하세요.

export const INK = '#4a3427';                       // 윤곽선 색
const L = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;

// ---- 색 목록 -----------------------------------------------------------------
export const SKIN = ['#fde3d3', '#fbdcc8', '#f7cfb2', '#f0bd98', '#e5a97d', '#d99669', '#c28158', '#a96b44', '#8a5233', '#6a3b25'];
export const HAIR_COLOR = ['#4a3225', '#8a5a36', '#f2cd5a', '#b86a55', '#2b2b30', '#b9b9bd', '#1c1818', '#c7433a'];
export const OUTFIT = [{ top: '#ffffff', bottom: '#ffffff', shoe: '#ffffff', free: true }];     // 지금은 흰색 옷 1벌만 (새 옷은 여기에 추가)

// ---- 얼굴형 (머리 모양) ---------------------------------------------------------
export const FACES = [
  { svg: (s) => `<ellipse cx="100" cy="100" rx="52" ry="48" fill="${s}" ${L}/>` },
  { svg: (s) => `<ellipse cx="100" cy="102" rx="56" ry="45" fill="${s}" ${L}/>` },
  { svg: (s) => `<ellipse cx="100" cy="100" rx="48" ry="52" fill="${s}" ${L}/>` },
  { svg: (s) => `<rect x="46" y="54" width="108" height="96" rx="40" fill="${s}" ${L}/>` },
  { svg: (s) => `<path d="M100 52C140 52 154 84 150 108C146 134 124 150 100 150C76 150 54 134 50 108C46 84 60 52 100 52Z" fill="${s}" ${L}/>` },
];

// ---- 머리 모양: back = 얼굴 뒤, front = 얼굴 앞 --------------------------------------
const hairP = (d, c) => `<path d="${d}" fill="${c}" ${L}/>`;
export const HAIRS = [
  { front: (c) => hairP('M46 98C40 52 68 34 100 34C134 34 160 52 154 98C150 84 144 74 136 68L128 80L116 66L104 80L92 66L80 80L70 68C58 76 50 86 46 98Z', c) },
  { front: (c) => hairP('M46 100C40 50 68 34 100 34C134 34 160 50 154 100C152 90 150 80 146 74L54 74C50 80 48 90 46 100Z', c) },
  { front: (c) => hairP('M46 100C40 52 68 34 102 34C136 34 160 54 154 100C150 82 140 70 120 66C100 80 66 80 52 84C48 88 47 94 46 100Z', c) },
  { front: (c) => hairP('M46 96C36 80 44 62 58 58C56 44 76 34 90 40C98 30 118 32 122 42C138 36 154 50 150 62C162 70 162 88 154 96C148 84 140 76 130 72C112 82 88 82 70 72C60 76 50 86 46 96Z', c) },
  { front: (c) => hairP('M46 104C40 52 68 34 100 34C132 34 160 52 154 104C150 84 128 66 100 66C72 66 50 84 46 104Z', c) },
  { back: (c) => `<circle cx="100" cy="30" r="17" fill="${c}" ${L}/>`, front: (c) => hairP('M48 100C46 54 72 40 100 40C128 40 154 54 152 100C146 82 128 70 100 70C72 70 54 82 48 100Z', c) },
  { front: (c) => hairP('M48 90L44 60L66 70L72 40L90 60L100 32L112 60L130 40L134 70L156 60L152 90C146 78 130 70 100 70C70 70 54 78 48 90Z', c) },
  { back: (c) => hairP('M42 112C36 50 66 32 100 32C134 32 164 50 158 112L158 136C150 142 142 142 136 136L64 136C58 142 50 142 42 136Z', c), front: (c) => hairP('M48 100C46 54 72 40 100 40C128 40 154 54 152 100C146 80 128 70 100 68C72 70 54 80 48 100Z', c) },
  { back: (c) => hairP('M40 110C34 48 66 30 100 30C134 30 166 48 160 110L164 182L136 172L64 172L36 182Z', c), front: (c) => hairP('M46 104C40 52 68 36 100 36C132 36 160 52 154 104C150 84 134 72 104 66C84 76 60 84 46 104Z', c) },
  { back: (c) => hairP('M40 108C32 50 66 30 100 30C134 30 168 50 160 108C166 124 160 142 148 148C142 138 134 140 128 146L72 146C66 140 58 138 52 148C40 142 34 124 40 108Z', c), front: (c) => hairP('M46 104C40 52 68 34 100 34C132 34 160 52 154 104C150 84 128 66 100 66C72 66 50 84 46 104Z', c) },
  { back: (c) => `<ellipse cx="36" cy="130" rx="14" ry="28" fill="${c}" ${L}/><ellipse cx="164" cy="130" rx="14" ry="28" fill="${c}" ${L}/>`, front: (c) => hairP('M48 100C44 54 70 38 100 38C130 38 156 54 152 100C148 82 130 68 100 68C70 68 52 82 48 100Z', c) },
  { front: (c) => hairP('M50 92C48 56 72 44 100 44C128 44 152 56 150 92C140 76 124 70 100 70C76 70 60 76 50 92Z', c) },
];

// ---- 눈썹 / 눈 / 입 / 볼터치 ----------------------------------------------------
const st = `fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"`;
export const BROWS = [
  { svg: () => `<path d="M64 92Q76 85 90 91M110 91Q124 85 136 92" ${st}/>` },
  { svg: () => `<path d="M66 90H90M110 90H134" ${st}/>` },
  { svg: () => `<path d="M64 94L90 88M110 88L136 94" ${st}/>` },
  { svg: () => `<path d="M64 88L90 94M110 94L136 88" ${st}/>` },
  { svg: () => `<path d="M66 91Q78 84 90 90M110 90Q122 84 134 91" fill="none" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/>` },
  { svg: () => `<path d="M64 86Q77 76 90 86M110 86Q123 76 136 86" ${st}/>` },
  { svg: () => '' },
  { svg: () => `<path d="M64 92Q76 85 90 91M110 86L136 92" ${st}/>` },
];
export const EYES = [
  { svg: () => `<ellipse cx="78" cy="108" rx="5.5" ry="7.5" fill="${INK}"/><ellipse cx="122" cy="108" rx="5.5" ry="7.5" fill="${INK}"/>` },
  { svg: () => `<ellipse cx="78" cy="108" rx="7" ry="9" fill="${INK}"/><ellipse cx="122" cy="108" rx="7" ry="9" fill="${INK}"/><circle cx="80" cy="104" r="2.6" fill="#fff"/><circle cx="124" cy="104" r="2.6" fill="#fff"/>` },
  { svg: () => `<ellipse cx="78" cy="107" rx="5.5" ry="10" fill="${INK}"/><ellipse cx="122" cy="107" rx="5.5" ry="10" fill="${INK}"/><circle cx="79.5" cy="102" r="2" fill="#fff"/><circle cx="123.5" cy="102" r="2" fill="#fff"/>` },
  { svg: () => `<path d="M68 113Q78 100 88 113M112 113Q122 100 132 113" ${st}/>` },
  { svg: () => `<path d="M68 105Q78 115 88 105M112 105Q122 115 132 105" ${st}/>` },
  { svg: () => `<path d="M70 100L86 108L70 116M130 100L114 108L130 116" ${st}/>` },
  { svg: () => `<circle cx="78" cy="108" r="4.5" fill="${INK}"/><circle cx="122" cy="108" r="4.5" fill="${INK}"/>` },
  { svg: () => `<ellipse cx="78" cy="108" rx="5.5" ry="7.5" fill="${INK}"/><path d="M112 113Q122 100 132 113" ${st}/>` },
];
export const MOUTHS = [
  { svg: () => `<path d="M87 126Q100 146 113 126Z" fill="#f0828c" ${L}/>` },
  { svg: () => `<path d="M90 130Q100 139 110 130" ${st}/>` },
  { svg: () => `<path d="M92 132H108" ${st}/>` },
  { svg: () => `<path d="M88 132Q92 127 96 132T104 132T112 132" ${st}/>` },
  { svg: () => `<circle cx="100" cy="132" r="5.5" fill="#f0828c" ${L}/>` },
  { svg: () => `<path d="M82 124Q100 152 118 124Z" fill="#f0828c" ${L}/><path d="M88 126H112V130H88Z" fill="#fff"/>` },
];
export const BLUSH = [
  { svg: () => '' },
  { svg: () => `<ellipse cx="64" cy="122" rx="11" ry="7" fill="#f7a1a8" opacity=".6"/><ellipse cx="136" cy="122" rx="11" ry="7" fill="#f7a1a8" opacity=".6"/>` },
  { svg: () => `<ellipse cx="62" cy="122" rx="14" ry="9" fill="#f7a1a8" opacity=".5"/><ellipse cx="138" cy="122" rx="14" ry="9" fill="#f7a1a8" opacity=".5"/>` },
  { svg: () => `<g stroke="#ef6b7a" stroke-width="2.4" stroke-linecap="round" opacity=".85"><path d="M56 126L62 118M63 127L69 119M70 128L76 120"/><path d="M124 120L130 128M131 119L137 127M138 118L144 126"/></g>` },
  { svg: () => `<ellipse cx="64" cy="122" rx="11" ry="7" fill="#ffb27a" opacity=".6"/><ellipse cx="136" cy="122" rx="11" ry="7" fill="#ffb27a" opacity=".6"/>` },
  { svg: () => `<circle cx="64" cy="122" r="6" fill="#f7a1a8" opacity=".7"/><circle cx="136" cy="122" r="6" fill="#f7a1a8" opacity=".7"/>` },
];

// ---- 액세서리(켜고 끄기: 모자 1, 안경 2, 가방 4 를 더한 번호) ---------------------------
export const ACCESSORIES = [
  { id: 'cap', bit: 1 },
  { id: 'glasses', bit: 2 },
  { id: 'bag', bit: 4 },
];
export const capSvg = () => `<path d="M50 84C50 46 76 34 100 34C124 34 150 46 150 84Z" fill="#3d5fc4" ${L}/><path d="M44 84C60 98 140 98 156 84C150 77 50 77 44 84Z" fill="#5b7fe0" ${L}/><circle cx="100" cy="35" r="4" fill="#5b7fe0" ${L}/>`;
export const glassesSvg = () => `<g fill="#ffffff" fill-opacity=".25" ${L}><circle cx="78" cy="108" r="16"/><circle cx="122" cy="108" r="16"/></g><path d="M94 106H106" ${st}/>`;
export const bagBackSvg = () => `<path d="M68 162Q68 146 84 146H116Q132 146 132 162V212Q132 222 122 222H78Q68 222 68 212Z" fill="#9a7a62" ${L}/>`;
export const bagStrapsSvg = () => `<path d="M82 152L80 202M118 152L120 202" fill="none" stroke="#6d5242" stroke-width="5" stroke-linecap="round"/>`;

// ---- 몸 + 옷 (옷은 지금 흰색 위·아래 고정) -------------------------------------------
export function bodySvg(skin, outfit) {
  const o = OUTFIT[outfit] ?? OUTFIT[0];
  return `
  <path d="M86 214V244M114 214V244" stroke="${INK}" stroke-width="14" stroke-linecap="round" fill="none"/>
  <path d="M86 214V244M114 214V244" stroke="${skin}" stroke-width="8" stroke-linecap="round" fill="none"/>
  <ellipse cx="86" cy="252" rx="15" ry="8" fill="${o.shoe}" ${L}/><ellipse cx="114" cy="252" rx="15" ry="8" fill="${o.shoe}" ${L}/>
  <path d="M56 184L52 210M144 184L148 210" stroke="${INK}" stroke-width="14" stroke-linecap="round" fill="none"/>
  <path d="M56 184L52 210M144 184L148 210" stroke="${skin}" stroke-width="8" stroke-linecap="round" fill="none"/>
  <rect x="92" y="140" width="16" height="16" fill="${skin}" ${L}/>
  <path d="M74 206L126 206L130 232L104 232L100 220L96 232L70 232Z" fill="${o.bottom}" ${L}/>
  <path d="M88 150C94 157 106 157 112 150L128 154L148 170L140 188L128 178L128 206L72 206L72 178L60 188L52 170L72 154Z" fill="${o.top}" ${L}/>
  <path d="M88 150C94 160 106 160 112 150" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
}

// ---- 설정값(문자열) <-> 객체 -----------------------------------------------------
// 키: f 얼굴형, s 피부색, h 머리모양, hc 머리색, br 눈썹, e 눈, m 입, bl 볼터치, k 액세서리, o 옷
export const PARTS = [
  { key: 'f', n: () => FACES.length, label: 'avatar.face' },
  { key: 's', n: () => SKIN.length, label: 'avatar.skin', color: true },
  { key: 'h', n: () => HAIRS.length, label: 'avatar.hair' },
  { key: 'hc', n: () => HAIR_COLOR.length, label: 'avatar.hairColor', color: true },
  { key: 'br', n: () => BROWS.length, label: 'avatar.brows' },
  { key: 'e', n: () => EYES.length, label: 'avatar.eyes' },
  { key: 'm', n: () => MOUTHS.length, label: 'avatar.mouth' },
  { key: 'bl', n: () => BLUSH.length, label: 'avatar.blush' },
];
export const DEFAULT_CFG = { f: 0, s: 1, h: 0, hc: 0, br: 0, e: 0, m: 0, bl: 1, k: 0, o: 0 };
const MAX = { f: FACES.length, s: SKIN.length, h: HAIRS.length, hc: HAIR_COLOR.length, br: BROWS.length, e: EYES.length, m: MOUTHS.length, bl: BLUSH.length, k: 8, o: OUTFIT.length };

export function parseCfg(str) {
  const cfg = { ...DEFAULT_CFG };
  if (typeof str !== 'string') return cfg;
  for (const tok of str.split('.')) {
    const m = /^([a-z]{1,2})(\d{1,2})$/.exec(tok);
    if (m && m[1] in MAX && Number(m[2]) < MAX[m[1]]) cfg[m[1]] = Number(m[2]);   // 범위를 벗어난 값은 무시 (이상한 값이 와도 화면이 깨지지 않음)
  }
  return cfg;
}
export const cfgToString = (cfg) => Object.keys(DEFAULT_CFG).map((k) => `${k}${cfg[k] ?? DEFAULT_CFG[k]}`).join('.');

// 아바타를 아직 안 만든 회원은 이름/아이디로 "항상 같은" 기본 아바타를 보여 줍니다
export function seededCfg(seed) {
  let x = 0;
  for (const ch of String(seed ?? '?')) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  const next = (n) => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return (x >>> 8) % n; };
  return { f: next(FACES.length), s: next(SKIN.length), h: next(HAIRS.length), hc: next(HAIR_COLOR.length), br: next(BROWS.length - 2), e: next(EYES.length), m: next(MOUTHS.length), bl: 1 + next(BLUSH.length - 1), k: 0, o: 0 };
}

const unlocked = (list, i) => list[i]?.free !== false;
export const isUnlocked = (key, i) => ({ f: FACES, h: HAIRS, br: BROWS, e: EYES, m: MOUTHS, bl: BLUSH, o: OUTFIT }[key] ? unlocked({ f: FACES, h: HAIRS, br: BROWS, e: EYES, m: MOUTHS, bl: BLUSH, o: OUTFIT }[key], i) : true);

// 부품별 랜덤 (잠긴 부품은 제외)
export function randomValue(key, current) {
  const n = MAX[key];
  const ok = [];
  for (let i = 0; i < n; i++) if (isUnlocked(key, i)) ok.push(i);
  if (ok.length < 2) return ok[0] ?? 0;
  let v;
  do { v = ok[Math.floor(Math.random() * ok.length)]; } while (v === current);
  return v;
}
export function randomCfg() {
  const cfg = { ...DEFAULT_CFG };
  for (const p of PARTS) cfg[p.key] = randomValue(p.key, -1);
  cfg.k = Math.floor(Math.random() * 8);
  cfg.o = 0;
  return cfg;
}
