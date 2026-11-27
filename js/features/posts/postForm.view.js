// postForm.view.js | 글 쓰기 / 글 고치기 화면 (사진 최대 6장)
import { REGION_IDS, guessRegion } from '../../core/regions.js';
import { h, icon, clear } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { field, formError, runBusy } from '../../core/form.js';
import { toast, spinner, errorBox } from '../../core/ui.js';
import { friendlyError } from '../../core/errors.js';
import { navigate } from '../../core/router.js';
import { userId } from '../../core/store.js';
import { CATEGORIES } from './categories.js';
import { MAX_IMAGES, createPost, updatePost, getPost, validateImageFiles, imageUrl } from './posts.service.js';
import { ratingInput } from './rating.js';
import { openMapPicker, mountPlaceMap } from '../map/mapPicker.js';

export function newPostView(ctx) { return renderForm(ctx, null); }

export async function editPostView(ctx) {
  const post = await getPost(ctx.params.id);
  // 내 글이 아니면 수정 화면 자체를 열지 않음 (서버도 어차피 거절함)
  if (!post || post.author_id !== userId()) {
    ctx.root.replaceChildren(errorBox(t('err.forbidden')));
    return;
  }
  return renderForm(ctx, post);
}

function renderForm({ root }, post) {
  const editing = !!post;
  const title = field({ label: t('post.title'), name: 'title', required: true, minlength: 3, maxlength: 120, value: post?.title ?? '' });
  const category = field({ label: t('post.category'), name: 'category', type: 'select', value: post?.category ?? 'sightseeing',
    options: CATEGORIES.map((c) => ({ value: c, label: t(`cat.${c}`) })) });
  const region = field({ label: t('region.label'), name: 'region', type: 'select', value: post?.region ?? '', options: [{ value: '', label: t('region.select') }, ...REGION_IDS.map((r) => ({ value: r, label: t(`region.${r}`) }))] });
  let regionTouched = !!post?.region;
  region.input.addEventListener('change', () => { regionTouched = true; });
  const area = field({ label: t('post.area'), name: 'area', maxlength: 60, value: post?.area ?? '', placeholder: t('post.areaPlaceholder') });
  const body = field({ label: t('post.body'), name: 'body', type: 'textarea', required: true, minlength: 10, maxlength: 5000, rows: 8,
    value: post?.body ?? '', placeholder: t('post.bodyPlaceholder') });
  const err = formError();

  // 사진 상태: 기존 사진(유지할 것) + 새로 고른 파일
  let keep = [...(post?.images ?? [])];
  let files = [];
  const urls = new Map();                 // File -> 미리보기 주소 (나중에 반드시 해제)
  const previews = h('div', { class: 'thumbs' });
  const picker = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif', multiple: true, hidden: true });
  const addBtn = h('button', { class: 'thumb thumb-add', type: 'button', 'aria-label': t('post.addPhotos'), onClick: () => picker.click() },
    icon('image', 24), h('span', null, t('post.addPhotos')));

  function renderThumbs() {
    clear(previews);
    for (const path of keep) {
      previews.append(thumb(imageUrl(path, { thumb: true }), () => { keep = keep.filter((p) => p !== path); renderThumbs(); }));
    }
    for (const f of files) {
      if (!urls.has(f)) urls.set(f, URL.createObjectURL(f));
      previews.append(thumb(urls.get(f), () => {
        URL.revokeObjectURL(urls.get(f)); urls.delete(f);
        files = files.filter((x) => x !== f); renderThumbs();
      }));
    }
    if (keep.length + files.length < MAX_IMAGES) previews.append(addBtn);
  }
  function thumb(src, onRemove) {
    return h('div', { class: 'thumb' },
      h('img', { src, alt: '' }),
      h('button', { class: 'thumb-x', type: 'button', 'aria-label': t('common.remove'), onClick: onRemove }, icon('x', 14)));
  }
  picker.addEventListener('change', () => {
    err.set('');
    const picked = [...picker.files];
    picker.value = '';
    try {
      validateImageFiles(picked, keep.length + files.length);
      files = [...files, ...picked];
      renderThumbs();
    } catch (ex) {
      err.set(ex.message === 'image_count' ? t('post.maxPhotos', { n: MAX_IMAGES }) : friendlyError(ex));
    }
  });

  // ---- 위치 (카카오톡처럼 + 버튼 -> 위치) ----------------------------------------
  let place = post?.lat != null ? { place_name: post.place_name ?? '', lat: post.lat, lng: post.lng } : null;
  let stopPlaceMap = () => {};
  const placeBox = h('div', { class: 'place-card', hidden: true });
  async function renderPlace() {
    stopPlaceMap();
    stopPlaceMap = () => {};
    clear(placeBox);
    placeBox.hidden = !place;
    if (!place) return;
    const preview = h('div', { class: 'map-mini' });
    placeBox.append(
      h('div', { class: 'place-head' }, icon('pin', 18), h('strong', null, place.place_name || t('map.unnamed')),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn btn-text btn-sm', type: 'button', onClick: pickPlace }, t('map.change')),
        h('button', { class: 'btn btn-text btn-sm danger', type: 'button', onClick: () => { place = null; renderPlace(); } }, t('map.removePlace'))),
      preview);
    stopPlaceMap = await mountPlaceMap(preview, { lat: place.lat, lng: place.lng });
  }
  async function pickPlace() {
    closeMenu();
    const chosen = await openMapPicker(place);
    if (chosen) {
      place = chosen; renderPlace();
      const g = guessRegion(chosen.lat, chosen.lng);
      if (g && !regionTouched) region.input.value = g;       // 지도에서 고른 장소로 지역을 추천 (직접 고른 적이 없을 때만)
    }
  }

  // + 버튼 메뉴: 사진 / 위치
  const menu = h('div', { class: 'attach-menu', hidden: true, role: 'menu' },
    h('button', { class: 'attach-item', type: 'button', role: 'menuitem', onClick: () => { closeMenu(); picker.click(); } },
      icon('image', 22), h('span', null, t('post.attachPhotos'))),
    h('button', { class: 'attach-item', type: 'button', role: 'menuitem', onClick: pickPlace },
      icon('pin', 22), h('span', null, t('post.attachLocation'))));
  const plus = h('button', { class: 'plus-btn', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-label': t('post.attach') }, icon('plus', 22));
  function closeMenu() { menu.hidden = true; plus.setAttribute('aria-expanded', 'false'); }
  plus.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    plus.setAttribute('aria-expanded', String(!menu.hidden));
  });
  const mapQuick = h('button', { class: 'map-quick', type: 'button', onClick: pickPlace }, icon('pin', 16), t('post.attachMap'));   // + 옆 "지도" 바로가기
  const attachRow = h('div', { class: 'attach-row' }, plus, menu, mapQuick);

  // ---- 별점 (글쓴이가 직접 줌, 선택) ----
  const rating = ratingInput(post?.rating ?? null);
  const ratingField = h('div', { class: 'field' }, h('label', null, t('post.rating'), h('span', { class: 'optional' }, ` (${t('common.optional')})`)),
    rating.el, h('p', { class: 'hint' }, t('post.ratingHint')));

  const form = h('form', { class: 'stack card form-card' },
    h('h1', null, editing ? t('post.editTitle') : t('post.newTitle')),
    title.root, category.root, region.root, area.root, body.root,
    attachRow, placeBox, ratingField,
    h('div', { class: 'field' }, h('label', null, t('post.photos'), h('span', { class: 'optional' }, ` (${t('common.optional')})`)),
      previews, picker, h('p', { class: 'hint' }, t('post.photoHint', { n: MAX_IMAGES }))),
    err.el,
    h('div', { class: 'actions' },
      h('a', { class: 'btn btn-ghost', href: editing ? `#/posts/${post.id}` : '#/explore' }, t('common.cancel')),
      h('button', { class: 'btn btn-primary', type: 'submit' }, editing ? t('common.save') : t('post.publish'))));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.set('');
    const values = {
      title: title.input.value.trim(), body: body.input.value.trim(),
      category: category.input.value, region: region.input.value, area: area.input.value.trim(),
      place, rating: rating.get(),
    };
    if (values.title.length < 3 || values.body.length < 10) return err.set(t('post.tooShort'));
    try {
      const result = await runBusy(form, async () => {
        if (!editing) return { id: await createPost({ ...values, files }), changed: true };
        return { id: post.id, changed: await updatePost(post, { ...values, keepImages: keep, files }) };
      });
      if (!result.changed) toast(t('common.nothingChanged'));
      else toast(editing ? t('common.saved') : t('post.published'), 'success');
      navigate(`#/posts/${result.id}`);
    } catch (ex) {
      err.set(friendlyError(ex));
    }
  });

  root.append(form);
  renderThumbs();
  renderPlace();
  return () => { stopPlaceMap(); for (const u of urls.values()) URL.revokeObjectURL(u); urls.clear(); };
}
