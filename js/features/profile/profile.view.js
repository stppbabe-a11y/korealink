// profile.view.js | 내 프로필(수정/언어/로그아웃/탈퇴) 과 다른 회원의 공개 프로필
import { legalLinks } from '../legal/legalLinks.js';
import { h, icon } from '../../core/dom.js';
import { t, formatDate, LANGS, getLang, setLang } from '../../core/i18n.js';
import { state, isAdmin, userId } from '../../core/store.js';
import { field, formError, runBusy } from '../../core/form.js';
import { avatar, displayName, flagBadge, flagImg, toast, confirmDialog, errorBox } from '../../core/ui.js';
import { friendlyError } from '../../core/errors.js';
import { countryOptions, countryName } from '../../core/countries.js';
import { navigate } from '../../core/router.js';
import { signOut, USERNAME_RE } from '../auth/auth.service.js';
import { postFeed } from '../posts/postFeed.js';
import * as svc from './profile.service.js';
import { interestChips, interestPicker } from './interests.js';
import { avatarEditor } from '../avatar/avatar.editor.js';
import { pointsPanel } from '../points/points.js';
import { REGION_IDS } from '../../core/regions.js';

// ------------------------------------------------------------------ 공통 조각
const GENDERS = ['female', 'male', 'nonbinary', 'other'];
const thisYear = () => new Date().getFullYear();
const regionLabel = (id) => (id === 'abroad' ? t('profile.residence.abroad') : t(`region.${id}`));

// 프로필 한 줄: 아이콘 + 이름 + 값 (+ 비공개 표시)
function infoRow(iconName, label, value, { privateNote = false } = {}) {
  return h('div', { class: 'info-row' },
    icon(iconName, 18),
    h('span', { class: 'info-label' }, label),
    h('span', { class: 'info-value' }, value),
    privateNote && h('span', { class: 'badge badge-soft private-badge', title: t('profile.onlyYou') }, icon('lock', 12), t('profile.onlyYou')));
}

// 프로필 상세 목록 (내 프로필과 남의 프로필이 같이 사용). 값이 없는(=비공개이거나 입력 안 한) 칸은 그리지 않음.
function detailList(p, { mine = false } = {}) {
  const priv = (flag) => mine && p[flag] === false;       // 내 화면에서만 "나만 보임" 표시
  const age = p.birth_year ? thisYear() - p.birth_year : null;
  const rows = [
    p.country && infoRow('globe', t('profile.nationality'), [flagImg(p.country), countryName(p.country)]),
    p.residence_region && infoRow('pin', t('profile.residence'), regionLabel(p.residence_region)),
    p.gender && infoRow('user', t('profile.gender'), t(`gender.${p.gender}`)),
    age != null && infoRow('calendar', t('profile.age'), t('profile.ageValue', { n: age }), { privateNote: priv('show_age') }),
  ].filter(Boolean);
  return rows.length ? h('div', { class: 'info-list' }, rows) : null;
}

// 항목 + 공개/비공개 스위치
function withVisibility(fld, checked) {
  const cb = h('input', { type: 'checkbox', role: 'switch', checked: !!checked });
  const text = h('span', { class: 'vis-text' });
  const paint = () => {
    text.replaceChildren(icon(cb.checked ? 'globe' : 'lock', 14), cb.checked ? t('profile.public') : t('profile.private'));
    text.classList.toggle('is-private', !cb.checked);
  };
  cb.addEventListener('change', paint);
  paint();
  const root = h('div', { class: 'field-vis' }, fld.root, h('label', { class: 'vis-toggle' }, cb, text));
  return { root, input: fld.input, isPublic: () => cb.checked };
}

// ------------------------------------------------------------------ 내 프로필
export function myProfileView({ root }) {
  const me = state.profile;
  if (!me) { root.append(errorBox(t('err.generic'), () => location.reload())); return; }

  const header = h('div', { class: 'card profile-head' });
  const avatarSlot = h('div', { class: 'avatar-slot' });
  const editorSlot = h('div', { class: 'ave-slot' });

  function closeEditor() { editorSlot.replaceChildren(); }
  const pts = pointsPanel();
  async function openEditor() {
    const info = await pts.refresh();
    const ed = avatarEditor({
      current: state.profile.avatar_cfg, seed: state.profile.id, points: info.points, cost: info.avatar_cost,
      onCancel: closeEditor,
      onSave: async (cfgStr) => {
        try {
          await svc.saveAvatar(cfgStr);
          paintHeader(); closeEditor(); pts.refresh();
          toast(t('common.saved'), 'success');
        } catch (ex) { toast(friendlyError(ex), 'error'); }
      },
    });
    editorSlot.replaceChildren(ed.root);
    ed.root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function paintHeader() {
    const p = state.profile;
    avatarSlot.replaceChildren(avatar(p, 88));
    header.replaceChildren(
      avatarSlot,
      h('div', { class: 'profile-info' },
        h('h1', null, displayName(p), flagBadge(p.country)),
        h('p', { class: 'muted' }, `@${p.username}`),
        p.bio && h('p', { class: 'bio' }, p.bio),
        interestChips(p.interests),
        detailList(p, { mine: true }),
        h('p', { class: 'muted small' }, t('profile.joined', { date: formatDate(p.created_at) })),
        h('div', { class: 'actions wrap' },
          h('button', { class: 'btn btn-soft btn-sm', type: 'button', onClick: openEditor }, icon('user', 16), t('avatar.edit')),
          h('a', { class: 'btn btn-text btn-sm', href: `#/u/${encodeURIComponent(p.username)}` }, icon('user', 16), t('profile.viewPublic')))));
  }

  // ---- 수정 폼: 항목마다 공개/비공개 스위치 ----
  const username = field({ label: t('auth.username'), name: 'username', required: true, minlength: 3, maxlength: 20, pattern: '[A-Za-z0-9_]{3,20}', value: me.username, hint: t('profile.alwaysPublic') });
  const display = field({ label: t('auth.displayName'), name: 'display', required: true, maxlength: 40, value: me.display_name ?? '' });
  const country = field({ label: t('profile.nationality'), name: 'country', required: true, type: 'select', value: me.country ?? '', options: [{ value: '', label: '—' }, ...countryOptions()] });
  const residence = field({ label: t('profile.residence'), name: 'residence', required: true, type: 'select', value: me.residence_region ?? '', options: [{ value: '', label: '—' }, ...REGION_IDS.map((id) => ({ value: id, label: t(`region.${id}`) })), { value: 'abroad', label: t('profile.residence.abroad') }], hint: t('profile.residence.hint') });
  const gender = field({ label: t('profile.gender'), name: 'gender', required: true, type: 'select', value: me.gender ?? '', options: [{ value: '', label: '—' }, ...GENDERS.map((g) => ({ value: g, label: t(`gender.${g}`) }))] });
  const birth = withVisibility(field({ label: t('profile.birthYear'), name: 'birth', type: 'number', min: 1900, max: thisYear(), step: 1, inputmode: 'numeric', value: me.birth_year ?? '', placeholder: '1995', hint: t('profile.birthYearHint') }), me.show_age);
  const bio = field({ label: t('profile.bio'), name: 'bio', type: 'textarea', rows: 3, maxlength: 300, value: me.bio ?? '', placeholder: t('profile.bioPlaceholder') });
  const lang = field({ label: t('profile.language'), name: 'language', type: 'select', value: getLang(), options: LANGS.map((l) => ({ value: l.code, label: l.label })) });
  const interests = interestPicker(me.interests);
  const err = formError();
  const form = h('form', { class: 'card stack' },
    h('h2', null, t('profile.edit')),
    h('p', { class: 'hint' }, t('profile.privacyIntro')),
    username.root, display.root, country.root, residence.root, gender.root, bio.root, interests.root, birth.root, lang.root, err.el,
    h('button', { class: 'btn btn-primary', type: 'submit' }, t('common.save')));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.set('');
    const u = username.input.value.trim();
    if (!USERNAME_RE.test(u)) return err.set(t('auth.usernameInvalid'));
    const by = birth.input.value.trim();
    if (by && (!/^\d{4}$/.test(by) || Number(by) < 1900 || Number(by) > thisYear())) return err.set(t('profile.birthYearInvalid'));
    try {
      const changed = await runBusy(form, () => svc.updateMyProfile({
        username: u, language: lang.input.value,
        display_name: display.input.value.trim() || null,
        country: country.input.value || null,
        residence_region: residence.input.value || null,
        gender: gender.input.value || null,
        birth_year: by ? Number(by) : null, show_age: birth.isPublic(),
        bio: bio.input.value.trim() || null,
        interests: interests.value(),
      }));
      if (!changed) return toast(t('common.nothingChanged'));
      paintHeader();
      toast(t('common.saved'), 'success');
      if (lang.input.value !== getLang()) setLang(lang.input.value);       // 화면 언어도 바로 변경
    } catch (ex) {
      err.set(ex?.code === '23505' ? t('auth.usernameTaken') : friendlyError(ex));
    }
  });

  // ---- 계정 영역 ----
  const account = h('div', { class: 'card stack' },
    h('h2', null, t('profile.account')),
    h('div', { class: 'actions wrap' },
      isAdmin() && h('a', { class: 'btn btn-soft', href: '#/admin' }, icon('shield', 18), t('nav.admin')),
      h('button', { class: 'btn btn-outline', type: 'button', onClick: async () => { await signOut(); toast(t('auth.loggedOut')); navigate('#/explore'); } }, icon('logout', 18), t('auth.logout'))),
    h('hr'),
    h('p', { class: 'muted small' }, t('profile.deleteWarn')),
    h('p', { class: 'muted small' }, legalLinks()),
    h('div', null, h('button', { class: 'btn btn-danger btn-sm', type: 'button', onClick: deleteAccount }, t('profile.deleteAccount'))));

  async function deleteAccount() {
    if (!(await confirmDialog(t('profile.deleteConfirm'), { danger: true, title: t('profile.deleteAccount'), confirmText: t('profile.deleteAccount') }))) return;
    try {
      await svc.deleteMyAccount();
      toast(t('profile.deleted'), 'success');
      navigate('#/explore');
    } catch (ex) { toast(friendlyError(ex), 'error'); }
  }

  const feed = postFeed({ authorId: me.id, emptyText: t('profile.noPostsMine') });
  paintHeader();
  root.append(header, pts.el, editorSlot, form, h('h2', { class: 'section-title' }, t('profile.myPosts')), feed.el, account);
  return () => feed.destroy();
}

// ------------------------------------------------------------------ 다른 회원의 공개 프로필 (공개로 정한 항목만 보임)
export async function userProfileView({ root, params }) {
  const p = await svc.getProfileByUsername(params.username);
  if (!p) { root.append(errorBox(t('profile.notFound'))); return; }
  const feed = postFeed({ authorId: p.id, emptyText: t('profile.noPosts') });
  const mine = p.id === userId();
  const full = mine && state.profile ? { ...p, ...state.profile } : p;     // 내 공개 화면에서는 비공개 칸도 "나만 보임"으로 함께 표시
  const details = detailList(full, { mine });
  root.append(
    h('button', { class: 'back-link btn btn-text', type: 'button', onClick: () => history.back() }, icon('back', 18), t('common.back')),
    h('div', { class: 'card profile-head' },
      avatar(p, 88),
      h('div', { class: 'profile-info' },
        h('h1', null, displayName(full), flagBadge(full.country)),
        h('p', { class: 'muted' }, `@${p.username}`),
        full.bio && h('p', { class: 'bio' }, full.bio),
        interestChips(full.interests),
        details,
        h('p', { class: 'muted small' }, t('profile.joined', { date: formatDate(p.created_at) })))),
    h('h2', { class: 'section-title' }, t('profile.posts')),
    feed.el);
  return () => feed.destroy();
}
