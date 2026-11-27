// avatar.editor.js | 아바타 꾸미기 화면: 부위별 선택 + 부위별 랜덤 + 전체 랜덤. 저장은 번호 문자열 한 칸만 보냅니다.
import { h, icon } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { PARTS, ACCESSORIES, SKIN, HAIR_COLOR, OUTFIT, parseCfg, cfgToString, seededCfg, randomValue, randomCfg, isUnlocked } from './avatar.parts.js';
import { avatarSvg } from './avatar.render.js';

// 색 동그라미 (CSP 때문에 style 속성 대신 스크립트로 색을 칠합니다)
function swatch(color) {
  const el = h('span', { class: 'ave-swatch' });
  el.style.background = color;
  return el;
}

export function avatarEditor({ current, seed, points = 0, cost = 10, onSave, onCancel }) {
  const free = !current;                           // 처음 만드는 아바타는 무료, 그다음부터 포인트가 듭니다
  const canPay = free || points >= cost;
  let cfg = current ? parseCfg(current) : seededCfg(seed);
  const stage = h('div', { class: 'ave-stage' });
  const rows = h('div', { class: 'ave-rows' });

  const dice = (label, fn) => h('button', { class: 'btn btn-soft btn-sm ave-dice', type: 'button', title: label, 'aria-label': label, onClick: fn }, '🎲', h('span', null, t('avatar.random')));
  const set = (key, v) => { cfg = { ...cfg, [key]: v }; paint(); };

  function optionButton(part, i) {
    const locked = !isUnlocked(part.key, i);
    const active = cfg[part.key] === i;
    const body = part.color
      ? swatch((part.key === 's' ? SKIN : HAIR_COLOR)[i])
      : avatarSvg({ ...cfg, [part.key]: i, k: 0 });
    return h('button', { class: `ave-opt${active ? ' active' : ''}${part.color ? ' is-color' : ''}`, type: 'button', disabled: locked, 'aria-pressed': active ? 'true' : 'false', 'aria-label': `${t(part.label)} ${i + 1}`, onClick: () => set(part.key, i) },
      body, locked && h('span', { class: 'ave-lock' }, '🔒'));
  }

  function partRow(part) {
    const opts = h('div', { class: 'ave-opts' });
    for (let i = 0; i < part.n(); i++) opts.append(optionButton(part, i));
    return h('section', { class: 'ave-row' },
      h('div', { class: 'ave-row-head' }, h('h3', null, t(part.label)), h('button', { class: 'btn btn-text btn-sm', type: 'button', 'aria-label': `${t(part.label)} ${t('avatar.random')}`, onClick: () => set(part.key, randomValue(part.key, cfg[part.key])) }, '🎲')),
      opts);
  }

  function accessoryRow() {
    return h('section', { class: 'ave-row' },
      h('div', { class: 'ave-row-head' }, h('h3', null, t('avatar.accessory')),
        h('button', { class: 'btn btn-text btn-sm', type: 'button', 'aria-label': `${t('avatar.accessory')} ${t('avatar.random')}`, onClick: () => set('k', Math.floor(Math.random() * 8)) }, '🎲')),
      h('div', { class: 'ave-toggles' }, ACCESSORIES.map((a) => {
        const on = (cfg.k & a.bit) !== 0;
        return h('button', { class: `chip${on ? ' active' : ''}`, type: 'button', 'aria-pressed': on ? 'true' : 'false', onClick: () => set('k', cfg.k ^ a.bit) }, t(`avatar.acc.${a.id}`));
      })));
  }

  function clothesRow() {
    return h('section', { class: 'ave-row' },
      h('div', { class: 'ave-row-head' }, h('h3', null, t('avatar.clothes'))),
      h('div', { class: 'ave-opts' },
        OUTFIT.map((o, i) => h('button', { class: `ave-opt${cfg.o === i ? ' active' : ''}`, type: 'button', 'aria-pressed': cfg.o === i ? 'true' : 'false', 'aria-label': t('avatar.clothesWhite'), onClick: () => set('o', i) }, avatarSvg({ ...cfg, o: i, k: 0 })))),
      h('p', { class: 'muted small' }, t('avatar.clothesNote')));
  }

  function paint() {
    stage.replaceChildren(avatarSvg(cfg, { full: true }));
    rows.replaceChildren(...PARTS.map(partRow), accessoryRow(), clothesRow());
  }
  paint();

  const root = h('div', { class: 'card ave' },
    h('h2', null, t('avatar.title')),
    h('p', { class: 'hint' }, t('avatar.intro')),
    h('p', { class: `points-note${canPay ? '' : ' bad'}` }, free ? t('avatar.costFree') : t('avatar.cost', { cost, n: points }), !canPay && [' ', t('avatar.notEnough')]),
    h('div', { class: 'ave-layout' },
      h('div', { class: 'ave-side' }, stage, h('button', { class: 'btn btn-primary ave-all', type: 'button', onClick: () => { cfg = randomCfg(); paint(); } }, '🎲 ', t('avatar.randomAll'))),
      rows),
    h('div', { class: 'actions wrap ave-actions' },
      h('button', { class: 'btn btn-primary', type: 'button', disabled: !canPay, onClick: () => onSave(cfgToString(cfg)) }, icon('check', 18), free ? t('common.save') : t('avatar.saveCost', { cost })),
      h('button', { class: 'btn btn-outline', type: 'button', onClick: onCancel }, t('common.cancel'))));
  return { root };
}
