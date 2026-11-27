// mapChooser.js | "지도 앱으로 열기" 선택창: 네이버지도 / 카카오맵 / 구글지도 (모두 무료, 새 창)
import { h, icon } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { openDialog } from '../../core/ui.js';
import { mapAppLinks } from './maplib.js';

export function openMapChooser({ lat, lng, name }) {
  const dlg = openDialog(h('div', { class: 'dialog-body stack map-chooser' },
    h('h3', null, t('map.openIn')),
    name && h('p', { class: 'muted' }, icon('pin', 14), ' ', name),
    h('div', { class: 'stack' }, mapAppLinks(lat, lng, name).map((l) =>
      h('a', { class: `btn btn-outline btn-block map-app map-app-${l.id}`, href: l.url, target: '_blank', rel: 'noopener noreferrer', onClick: () => setTimeout(() => dlg.close('ok'), 50) },
        l.label, ' ', icon('external', 14)))),
    h('button', { class: 'btn btn-ghost btn-block', type: 'button', onClick: () => dlg.close('cancel') }, t('common.cancel'))));
  return dlg;
}
