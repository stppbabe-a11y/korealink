// avatar.render.js | 설정값(cfg) -> SVG 그림. 값은 모두 "번호"이고 그림 조각은 이 앱 코드 안의 고정 문자열뿐이라 안전합니다.
import { FACES, HAIRS, BROWS, EYES, MOUTHS, BLUSH, SKIN, HAIR_COLOR, ACCESSORIES, parseCfg, seededCfg, capSvg, glassesSvg, bagBackSvg, bagStrapsSvg, bodySvg } from './avatar.parts.js';

const NS = 'http://www.w3.org/2000/svg';
const cache = new Map();

function build(cfg, full) {
  const skin = SKIN[cfg.s], hair = HAIR_COLOR[cfg.hc];
  const hairDef = HAIRS[cfg.h];
  const has = (id) => (cfg.k & ACCESSORIES.find((a) => a.id === id).bit) !== 0;
  const ears = `<circle cx="47" cy="104" r="9" fill="${skin}" stroke="#4a3427" stroke-width="3"/><circle cx="153" cy="104" r="9" fill="${skin}" stroke="#4a3427" stroke-width="3"/>`;
  const inner = [
    has('bag') ? bagBackSvg() : '',
    hairDef.back ? hairDef.back(hair) : '',
    bodySvg(skin, cfg.o),
    has('bag') ? bagStrapsSvg() : '',
    ears,
    FACES[cfg.f].svg(skin),
    BLUSH[cfg.bl].svg(),
    BROWS[cfg.br].svg(),
    EYES[cfg.e].svg(),
    MOUTHS[cfg.m].svg(),
    hairDef.front(hair),
    has('glasses') ? glassesSvg() : '',
    has('cap') ? capSvg() : '',
  ].join('');
  const view = full ? '0 0 200 270' : '24 10 152 152';
  return `<svg xmlns="${NS}" viewBox="${view}" focusable="false" aria-hidden="true">${inner}</svg>`;
}

// cfg 문자열(또는 객체) -> <svg> 요소. 같은 모양은 한 번만 만들고 복제해서 씁니다 (목록이 길어도 가볍게).
export function avatarSvg(cfgOrString, { full = false, seed = '' } = {}) {
  const cfg = typeof cfgOrString === 'object' && cfgOrString ? cfgOrString : (cfgOrString ? parseCfg(cfgOrString) : seededCfg(seed));
  const key = `${full ? 'F' : 'H'}${JSON.stringify(cfg)}`;
  let tpl = cache.get(key);
  if (!tpl) {
    tpl = new DOMParser().parseFromString(build(cfg, full), 'image/svg+xml').documentElement;
    if (cache.size > 300) cache.clear();
    cache.set(key, tpl);
  }
  return document.importNode(tpl, true);
}
