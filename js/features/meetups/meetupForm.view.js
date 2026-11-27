// meetupForm.view.js | 모임 만들기 / 고치기
import { regionOptions, guessRegion } from '../../core/regions.js';
import { h, icon, clear } from '../../core/dom.js';
import { t, LANGS } from '../../core/i18n.js';
import { field, formError, runBusy } from '../../core/form.js';
import { toast, errorBox } from '../../core/ui.js';
import { friendlyError } from '../../core/errors.js';
import { navigate } from '../../core/router.js';
import { userId } from '../../core/store.js';
import { imageUrl, validateImageFiles } from '../posts/posts.service.js';
import { openMapPicker, mountPlaceMap } from '../map/mapPicker.js';
import { MEETUP_CATEGORIES, MAX_LANGS } from './categories.js';
import { getMeetup, createMeetup, updateMeetup } from './meetups.service.js';

const pad = (n) => String(n).padStart(2, '0');
const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function newMeetupView(ctx) { return renderForm(ctx, null); }

export async function editMeetupView(ctx) {
  const m = await getMeetup(ctx.params.id);
  if (!m || m.host_id !== userId()) { ctx.root.replaceChildren(errorBox(t('err.forbidden'))); return; }
  return renderForm(ctx, m);
}

function renderForm({ root }, meetup) {
  const editing = !!meetup;
  const soon = new Date(Date.now() + 3600 * 1000);
  const state = {
    category: meetup?.category ?? 'food',
    languages: [...(meetup?.languages ?? [])],
    approval: meetup?.approval ?? false,
    region: meetup?.region ?? '', regionTouched: !!meetup?.region,
    place: meetup ? { place_name: meetup.place_name, lat: meetup.lat, lng: meetup.lng } : null,
    coverFile: null, removeCover: false,
  };

  const title = field({ label: t('meet.f.title'), name: 'title', required: true, minlength: 3, maxlength: 80, value: meetup?.title ?? '', placeholder: t('meet.f.titlePlaceholder') });
  const when = field({ label: t('meet.f.when'), name: 'when', type: 'datetime-local', required: true,
    value: toLocalInput(meetup ? new Date(meetup.starts_at) : new Date(soon.setMinutes(0, 0, 0))), min: toLocalInput(new Date()) });
  const capacity = field({ label: t('meet.f.capacity'), name: 'capacity', type: 'number', required: true, min: Math.max(2, meetup?.joined_count ?? 2), max: 20, step: 1, inputmode: 'numeric',
    value: meetup?.capacity ?? 6, hint: t('meet.f.capacityHint') });
  const cost = field({ label: t('meet.f.cost'), name: 'cost', maxlength: 80, value: meetup?.cost_note ?? '', placeholder: t('meet.f.costPlaceholder') });
  const desc = field({ label: t('meet.f.desc'), name: 'desc', type: 'textarea', required: true, minlength: 10, maxlength: 1500, rows: 7, value: meetup?.description ?? '', placeholder: t('meet.f.descPlaceholder') });
  const err = formError();

  // 종류
  const catBox = h('div', { class: 'cat-grid', role: 'radiogroup', 'aria-label': t('meet.category') });
  const paintCats = () => catBox.replaceChildren(...MEETUP_CATEGORIES.map((c) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(state.category === c.id), class: `cat-tile${state.category === c.id ? ' active' : ''}`,
    onClick: () => { state.category = c.id; paintCats(); },
  }, h('span', { class: 'cat-emoji', 'aria-hidden': 'true' }, c.emoji), h('span', null, t(`meet.cat.${c.id}`)))));

  // 사용 언어
  const langBox = h('div', { class: 'chips wrap', role: 'group', 'aria-label': t('meet.f.languages') });
  const paintLangs = () => langBox.replaceChildren(...LANGS.map((l) => {
    const on = state.languages.includes(l.code);
    return h('button', { type: 'button', class: `chip${on ? ' active' : ''}`, 'aria-pressed': String(on), onClick: () => {
      if (on) state.languages = state.languages.filter((x) => x !== l.code);
      else if (state.languages.length >= MAX_LANGS) return toast(t('meet.f.langMax', { n: MAX_LANGS }));
      else state.languages = [...state.languages, l.code];
      paintLangs();
    } }, l.label);
  }));

  // 승인 스위치
  const approvalCb = h('input', { type: 'checkbox', role: 'switch', checked: state.approval });
  approvalCb.addEventListener('change', () => { state.approval = approvalCb.checked; });
  const approvalRow = h('label', { class: 'switch-row' }, approvalCb,
    h('span', null, h('strong', null, t('meet.f.approval')), h('small', { class: 'muted' }, t('meet.f.approvalHint'))));

  // 장소
  let stopMap = () => {};
  const placeBox = h('div', { class: 'place-card' });
  async function paintPlace() {
    stopMap(); stopMap = () => {}; clear(placeBox);
    if (!state.place) {
      placeBox.append(h('button', { class: 'btn btn-soft place-pick', type: 'button', onClick: pick }, icon('pin', 18), t('meet.f.pickPlace')));
      return;
    }
    const mini = h('div', { class: 'map-mini' });
    placeBox.append(
      h('div', { class: 'place-head' }, icon('pin', 18), h('strong', null, state.place.place_name || t('map.unnamed')), h('span', { class: 'spacer' }),
        h('button', { class: 'btn btn-text btn-sm', type: 'button', onClick: pick }, t('map.change'))), mini);
    stopMap = await mountPlaceMap(mini, { lat: state.place.lat, lng: state.place.lng });
  }
  async function pick() {
    const c = await openMapPicker(state.place);
    if (!c) return;
    state.place = c; paintPlace();
    const g = guessRegion(c.lat, c.lng);
    if (g && !state.regionTouched) { state.region = g; regionSel.value = g; }   // 지도에서 고른 장소로 지역 추천
  }

  // 대표 사진 (한 장)
  const picker = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif', hidden: true });
  const coverBox = h('div', { class: 'cover-box' });
  let coverUrl = null;
  const paintCover = () => {
    clear(coverBox);
    if (coverUrl) { URL.revokeObjectURL(coverUrl); coverUrl = null; }
    let src = null;
    if (state.coverFile) { coverUrl = URL.createObjectURL(state.coverFile); src = coverUrl; }
    else if (meetup?.cover && !state.removeCover) src = imageUrl(meetup.cover);
    coverBox.append(src
      ? h('div', { class: 'cover-preview' }, h('img', { src, alt: '' }),
          h('button', { class: 'thumb-x', type: 'button', 'aria-label': t('common.remove'), onClick: () => { state.coverFile = null; state.removeCover = true; paintCover(); } }, icon('x', 14)))
      : h('button', { class: 'btn btn-soft', type: 'button', onClick: () => picker.click() }, icon('image', 18), t('meet.f.addCover')));
  };
  picker.addEventListener('change', () => {
    const [f] = picker.files; picker.value = '';
    if (!f) return;
    try { validateImageFiles([f], 0); state.coverFile = f; state.removeCover = false; paintCover(); } catch (ex) { err.set(friendlyError(ex)); }
  });

  const regionSel = h('select', { name: 'region', 'aria-label': t('region.label') }, regionOptions({ includeEmpty: true }));
  regionSel.value = state.region;
  regionSel.addEventListener('change', () => { state.region = regionSel.value; state.regionTouched = true; });
  const block = (label, optional, ...kids) => h('div', { class: 'field' }, h('label', null, label, optional && h('span', { class: 'optional' }, ` (${t('common.optional')})`)), ...kids);
  const form = h('form', { class: 'stack card form-card meetup-form' },
    h('h1', null, editing ? t('meet.editTitle') : t('meet.newTitle')),
    block(t('meet.category'), false, catBox),
    title.root, when.root,
    block(t('meet.f.place'), false, placeBox, h('p', { class: 'hint' }, t('meet.f.placeHint'))),
    block(t('region.label'), true, regionSel, h('p', { class: 'hint' }, t('region.hint'))),
    capacity.root, approvalRow,
    block(t('meet.f.languages'), true, langBox, h('p', { class: 'hint' }, t('meet.f.languagesHint', { n: MAX_LANGS }))),
    cost.root, desc.root,
    block(t('meet.f.cover'), true, coverBox, picker),
    h('p', { class: 'safety-note' }, icon('shield', 16), t('meet.safetyShort')),
    err.el,
    h('div', { class: 'actions' },
      h('a', { class: 'btn btn-ghost', href: editing ? `#/meetups/${meetup.id}` : '#/meetups' }, t('common.cancel')),
      h('button', { class: 'btn btn-primary', type: 'submit' }, editing ? t('common.save') : t('meet.publish'))));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.set('');
    const startsAt = new Date(when.input.value);
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) return err.set(t('meet.err.past'));
    if (startsAt.getTime() > Date.now() + 180 * 86400000) return err.set(t('meet.err.tooFar'));
    if (!state.place) return err.set(t('meet.err.place'));
    const cap = Number(capacity.input.value);
    if (!Number.isInteger(cap) || cap < 2 || cap > 20) return err.set(t('meet.err.capacity'));
    if (editing && cap < meetup.joined_count) return err.set(t('meet.err.capacityBelow', { n: meetup.joined_count }));
    const values = {
      title: title.input.value.trim(), description: desc.input.value.trim(), category: state.category,
      region: state.region, startsAt: startsAt.toISOString(), place: state.place, capacity: cap, approval: state.approval,
      languages: state.languages, costNote: cost.input.value.trim(),
    };
    if (values.title.length < 3 || values.description.length < 10) return err.set(t('meet.err.short'));
    try {
      const res = await runBusy(form, async () => {
        if (!editing) return { id: await createMeetup(values, state.coverFile), changed: true };
        return { id: meetup.id, changed: await updateMeetup(meetup, values, { coverFile: state.coverFile, removeCover: state.removeCover }) };
      });
      toast(res.changed ? (editing ? t('common.saved') : t('meet.published')) : t('common.nothingChanged'), res.changed ? 'success' : 'info');
      navigate(`#/meetups/${res.id}`);
    } catch (ex) {
      err.set(/invalid_start/.test(String(ex?.message)) ? t('meet.err.past') : friendlyError(ex));
    }
  });

  root.append(form);
  paintCats(); paintLangs(); paintPlace(); paintCover();
  return () => { stopMap(); if (coverUrl) URL.revokeObjectURL(coverUrl); };
}
