// mapPicker.js | 글쓰기에서 "위치" 를 고르는 팝업 (카카오톡 위치 첨부처럼)
//   1) 장소 이름으로 검색(입력하면 미리보기 목록) 2) 지도를 눌러 핀 꽂기 / 핀 끌기 3) "내 위치" 버튼 4) 이름 고치고 "이 장소 사용"
//   결과: { place_name, lat, lng }  (취소하면 null)
import { h, icon, clear } from '../../core/dom.js';
import { t, getLang } from '../../core/i18n.js';
import { openDialog, toast, spinner } from '../../core/ui.js';
import { loadMapLib, createMap, addPin, KOREA } from './maplib.js';
import { suggestPlaces, searchPlaces, reversePlace } from './geocode.js';

const round = (n) => Math.round(n * 1e6) / 1e6;     // 좌표는 소수 6자리(약 10cm)면 충분

export async function openMapPicker(initial = null) {
  let ml;
  try { ml = await loadMapLib(); } catch { toast(t('map.loadFail'), 'error'); return null; }

  return new Promise((resolve) => {
    let picked = initial ? { lat: initial.lat, lng: initial.lng } : null;
    let nameTouched = !!initial?.place_name;
    let map = null;
    let marker = null;
    let result = null;
    let lookupId = 0;
    let typeTimer = null;
    let searchId = 0;

    const mapEl = h('div', { class: 'map-box', role: 'application', 'aria-label': t('map.title') });
    const search = h('input', { type: 'search', class: 'search-input', maxlength: 80, placeholder: t('map.search'), 'aria-label': t('map.search'), autocomplete: 'off' });
    const results = h('div', { class: 'map-results' });
    const nameInput = h('input', { type: 'text', maxlength: 100, value: initial?.place_name ?? '', placeholder: t('map.placeName'), 'aria-label': t('map.placeName') });
    const useBtn = h('button', { class: 'btn btn-primary', type: 'button', disabled: !picked }, t('map.use'));
    const hint = h('p', { class: 'hint' }, t('map.tapHint'));

    function setPoint(lat, lng, { zoom, name, lookup = true } = {}) {
      picked = { lat: round(lat), lng: round(lng) };
      if (!marker) {
        marker = addPin(ml, map, { lat, lng }, { draggable: true });
        marker.on('dragend', () => { const p = marker.getLngLat(); setPoint(p.lat, p.lng); });
      } else marker.setLngLat([lng, lat]);
      if (zoom) map.flyTo({ center: [lng, lat], zoom, duration: 600 }); else map.panTo([lng, lat]);
      useBtn.disabled = false;
      if (name != null) { nameInput.value = name; nameTouched = true; }
      else if (lookup && !nameTouched) fillName(lat, lng);
    }

    // 핀 위치의 이름을 자동으로 채움 (사용자가 직접 이름을 쓰기 시작하면 더 이상 덮어쓰지 않음)
    async function fillName(lat, lng) {
      const my = ++lookupId;
      try {
        const name = await reversePlace(lat, lng, getLang());
        if (my === lookupId && !nameTouched) nameInput.value = name || t('map.unnamed');
      } catch { if (my === lookupId && !nameTouched && !nameInput.value) nameInput.value = t('map.unnamed'); }
    }

    function showResults(found) {
      clear(results);
      if (!found.length) { results.append(h('p', { class: 'hint' }, t('map.noResults'))); return; }
      for (const r of found) {
        results.append(h('button', { class: 'map-result', type: 'button',
          onClick: () => { clear(results); setPoint(r.lat, r.lng, { zoom: 16, name: r.name }); } },
          icon('pin', 16), h('span', null, h('strong', null, r.name), r.address && h('small', null, r.address))));
      }
    }

    // 입력 중: 잠깐 멈추면 미리보기 목록 (Photon)
    search.addEventListener('input', () => {
      clearTimeout(typeTimer);
      const q = search.value.trim();
      if (q.length < 2) { clear(results); return; }
      typeTimer = setTimeout(async () => {
        const my = ++searchId;
        try { const found = await suggestPlaces(q, getLang()); if (my === searchId) showResults(found); }
        catch (ex) { if (ex?.name !== 'AbortError' && my === searchId) { /* 미리보기 실패는 조용히 (엔터로 다시 검색 가능) */ } }
      }, 450);
    });

    // 검색 버튼/엔터: 확실한 검색 (결과 없으면 보조 서버까지)
    async function runSearch() {
      clearTimeout(typeTimer);
      const q = search.value.trim();
      if (q.length < 2) return;
      const my = ++searchId;
      clear(results);
      results.append(h('p', { class: 'hint' }, t('map.searching')));
      try {
        const found = await searchPlaces(q, getLang());
        if (my === searchId) showResults(found);
      } catch {
        if (my !== searchId) return;
        clear(results);
        results.append(h('p', { class: 'hint bad' }, t('map.searchFail')));
      }
    }

    const locateBtn = h('button', { class: 'btn btn-soft btn-sm', type: 'button' }, icon('locate', 16), t('map.useMyLocation'));
    locateBtn.addEventListener('click', () => {
      if (!navigator.geolocation) return toast(t('map.locationDenied'), 'error');
      locateBtn.disabled = true;
      hint.textContent = t('map.locating');
      navigator.geolocation.getCurrentPosition(
        (pos) => { locateBtn.disabled = false; hint.textContent = t('map.tapHint'); setPoint(pos.coords.latitude, pos.coords.longitude, { zoom: 17 }); },
        () => { locateBtn.disabled = false; hint.textContent = t('map.tapHint'); toast(t('map.locationDenied'), 'error'); },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
    });

    const searchForm = h('form', { class: 'map-search', role: 'search' }, h('div', { class: 'search-wrap' }, icon('search', 18), search),
      h('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, t('map.searchBtn')));
    searchForm.addEventListener('submit', (e) => { e.preventDefault(); runSearch(); });
    nameInput.addEventListener('input', () => { nameTouched = true; });

    const body = h('div', { class: 'dialog-body map-dialog' },
      h('h3', null, t('map.title')),
      searchForm, results, mapEl,
      h('div', { class: 'map-tools' }, locateBtn, hint),
      h('div', { class: 'field' }, h('label', null, t('map.placeName')), nameInput),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: (e) => e.target.closest('dialog').close('cancel') }, t('common.cancel')),
        useBtn));

    const dlg = openDialog(body, {
      onClose: () => { clearTimeout(typeTimer); lookupId += 1; searchId += 1; map?.remove(); resolve(result); },
    });
    useBtn.addEventListener('click', () => {
      if (!picked) return;
      const name = nameInput.value.trim().slice(0, 100) || t('map.unnamed');
      result = { place_name: name, lat: picked.lat, lng: picked.lng };
      dlg.close('ok');
    });

    try {
      map = createMap(ml, mapEl, { center: picked ?? KOREA, zoom: picked ? 16 : 7 });
    } catch {                                               // WebGL 을 쓸 수 없는 아주 오래된 기기
      toast(t('map.loadFail'), 'error');
      dlg.close('cancel');
      return;
    }
    map.on('load', () => { if (picked) setPoint(picked.lat, picked.lng, { lookup: false }); });
    map.on('click', (e) => setPoint(e.lngLat.lat, e.lngLat.lng));
    setTimeout(() => map?.resize(), 80);                    // 팝업이 열린 뒤 지도 크기를 다시 계산
    search.focus({ preventScroll: true });
  });
}

// 작은 "미리보기 지도" (글쓰기 화면의 선택한 장소 / 글 상세).
//   interactive 면 한 번 눌러야 휠 확대가 켜져서, 글을 스크롤하다 지도에 걸리지 않음.
export async function mountPlaceMap(el, { lat, lng, interactive = false, zoom = 15, wheel, onClick } = {}) {
  el.replaceChildren(spinner());
  try {
    const ml = await loadMapLib();
    el.replaceChildren();
    const map = createMap(ml, el, { center: { lat, lng }, zoom, interactive, wheel: wheel ?? (interactive ? 'click' : false) });
    addPin(ml, map, { lat, lng });
    if (onClick) { map.on('click', onClick); map.getCanvas().style.cursor = 'pointer'; }
    setTimeout(() => map.resize(), 50);
    return () => map.remove();
  } catch {
    el.replaceChildren(h('p', { class: 'hint pad' }, t('map.loadFail')));
    return () => {};
  }
}
