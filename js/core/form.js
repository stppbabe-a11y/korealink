// form.js | 입력칸/폼 도우미
import { h } from './dom.js';
import { t } from './i18n.js';

// field({ label, name, type, value, hint, options, ...속성 })  ->  { root, input }
export function field({ label, name, type = 'text', value = '', hint, options, ...attrs }) {
  const id = `f-${name}-${Math.random().toString(36).slice(2, 7)}`;
  let input;
  if (type === 'textarea') {
    input = h('textarea', { id, name, rows: 5, ...attrs }, value);
  } else if (type === 'select') {
    input = h('select', { id, name, ...attrs },
      options.map((o) => h('option', { value: o.value, selected: o.value === value }, o.label)));
  } else {
    input = h('input', { id, name, type, value, ...attrs });
  }

  let control = input;
  if (type === 'password') {
    const toggle = h('button', { type: 'button', class: 'btn btn-text field-toggle' }, t('common.show'));
    toggle.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.textContent = show ? t('common.hide') : t('common.show');
    });
    control = h('div', { class: 'input-wrap' }, input, toggle);
  }

  const root = h('div', { class: 'field' },
    h('label', { for: id }, label, attrs.required ? '' : h('span', { class: 'optional' }, ` (${t('common.optional')})`)),
    control,
    hint && h('p', { class: 'hint' }, hint));
  return { root, input };
}

// 폼 맨 아래에 표시되는 오류 문구
export function formError() {
  const el = h('p', { class: 'form-error', role: 'alert', hidden: true });
  return {
    el,
    set(message) {
      el.textContent = message ?? '';
      el.hidden = !message;
    },
  };
}

// 요청이 끝날 때까지 폼을 잠가서 "두 번 눌러 두 번 저장되는 것"을 막음
export async function runBusy(form, fn) {
  const controls = [...form.querySelectorAll('button, input, select, textarea')];
  const was = controls.map((c) => c.disabled);
  controls.forEach((c) => { c.disabled = true; });
  form.classList.add('is-busy');
  try {
    return await fn();
  } finally {
    controls.forEach((c, i) => { c.disabled = was[i]; });
    form.classList.remove('is-busy');
  }
}
