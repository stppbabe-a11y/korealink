// reportDialog.js | "신고하기" 팝업. 글/댓글/채팅 메시지 어디서든 openReportDialog(종류, id) 로 사용
import { h } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { field, formError, runBusy } from '../../core/form.js';
import { openDialog, toast } from '../../core/ui.js';
import { friendlyError } from '../../core/errors.js';
import { isLoggedIn } from '../../core/store.js';
import { navigate } from '../../core/router.js';
import { REASONS, reportContent } from './reports.service.js';

export function openReportDialog(type, id) {
  if (!isLoggedIn()) {
    toast(t('common.loginRequired'));
    navigate(`#/login?next=${encodeURIComponent(location.hash)}`);
    return;
  }
  const reason = field({ label: t('report.reason'), name: 'reason', type: 'select', required: true,
    options: REASONS.map((r) => ({ value: r, label: t(`report.${r}`) })) });
  const note = field({ label: t('report.note'), name: 'note', type: 'textarea', rows: 3, maxlength: 200 });
  const err = formError();
  const form = h('form', { class: 'dialog-body stack', method: 'dialog' },
    h('h3', null, t('report.title')),
    h('p', { class: 'muted' }, t('report.text')),
    reason.root, note.root, err.el,
    h('div', { class: 'dialog-actions' },
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => dlg.close('cancel') }, t('common.cancel')),
      h('button', { class: 'btn btn-danger', type: 'submit' }, t('report.submit'))));
  const dlg = openDialog(form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.set('');
    try {
      await runBusy(form, () => reportContent(type, id, reason.input.value, note.input.value.trim()));
      toast(t('report.thanks'), 'success');
      dlg.close('ok');
    } catch (ex) {
      err.set(/invalid_input/.test(String(ex?.message)) ? t('report.own') : friendlyError(ex));
    }
  });
}
