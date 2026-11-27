// points.js | 포인트 표시 + 출석체크 버튼 + 당첨 팝업(아바타가 웃으며 포인트를 알려 줌)
//   추첨/적립은 서버(daily_checkin 함수)가 합니다. 이 파일은 결과를 보여 주기만 합니다.
import { h, icon } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { state } from '../../core/store.js';
import { toast, openDialog } from '../../core/ui.js';
import { friendlyError } from '../../core/errors.js';
import { parseCfg, seededCfg } from '../avatar/avatar.parts.js';
import { avatarSvg } from '../avatar/avatar.render.js';
import * as svc from '../profile/profile.service.js';

// 웃는 얼굴 버전의 내 아바타 (눈 웃음 + 활짝 웃는 입 + 볼터치)
function happyAvatar() {
  const p = state.profile;
  const cfg = p?.avatar_cfg ? parseCfg(p.avatar_cfg) : seededCfg(p?.id);
  return avatarSvg({ ...cfg, e: 4, m: 5, bl: 2, br: 0 }, { full: false });
}

export function showPointPopup(gained) {
  const big = gained >= 30;
  const content = h('form', { method: 'dialog', class: `dialog-body point-pop${big ? ' is-big' : ''}${gained >= 100 ? ' is-jackpot' : ''}` },
    h('div', { class: 'confetti', 'aria-hidden': 'true' }, Array.from({ length: 14 }, () => h('i'))),
    h('div', { class: 'point-avatar' }, happyAvatar()),
    h('h3', null, gained >= 100 ? t('points.jackpot') : gained >= 30 ? t('points.lucky') : t('points.popupTitle')),
    h('p', { class: 'point-gain' }, t('points.gain', { n: gained })),
    h('p', { class: 'muted' }, t('points.popupText')),
    h('div', { class: 'dialog-actions' }, h('button', { class: 'btn btn-primary', value: 'ok', autofocus: true }, t('common.confirm'))));
  openDialog(content);
}

// 프로필 위쪽 "내 포인트" 카드
export function pointsPanel({ onChange } = {}) {
  let info = { points: 0, checked_in_today: false, avatar_cost: 10 };
  const bal = h('strong', { class: 'points-num' }, '…');
  const btn = h('button', { class: 'btn btn-primary', type: 'button' });
  const note = h('p', { class: 'muted small' }, t('points.rules'));
  const el = h('div', { class: 'card points-card' },
    h('div', { class: 'points-row' },
      h('div', null, h('p', { class: 'muted small' }, t('points.label')), h('p', { class: 'points-line' }, '⭐ ', bal, ' P')),
      btn),
    note);

  function paint() {
    bal.textContent = String(info.points);
    btn.disabled = info.checked_in_today;
    btn.replaceChildren(icon('check', 18), info.checked_in_today ? t('points.checkedIn') : t('points.checkin'));
  }
  async function refresh() {
    try { info = await svc.getPoints(); } catch (e) { console.warn('[points] load failed', e); bal.textContent = '–'; return info; }
    paint();
    return info;
  }
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const res = await svc.checkIn();
      if (res.already) toast(t('points.checkedIn'));
      else showPointPopup(res.gained);
      info = { ...info, points: res.points, checked_in_today: true };
      paint();
      onChange?.(info);
    } catch (ex) { toast(friendlyError(ex), 'error'); btn.disabled = false; }
  });
  paint();
  refresh();
  return { el, refresh, info: () => info };
}
