// maplib.js | 지도 라이브러리(MapLibre GL) + 무료 지도 데이터(OpenFreeMap) 불러오기
//   - OpenFreeMap: 무료 · API 키 없음 · 사용량 제한 없음. 지도 글자는 영문(라틴 문자)+현지 글자를 함께 보여 줘서
//     한글을 못 읽는 외국인 여행자도 읽을 수 있습니다.
//   - 지도를 처음 쓸 때만 라이브러리(약 1MB, 압축 전송 시 약 1/4)를 내려받습니다 -> 지도를 안 보는 사람은 데이터 0.
//   - 지도 서비스를 바꾸고 싶으면 STYLE_URL 한 줄(+ 보안정책 CSP 의 connect-src)만 바꾸면 됩니다.
export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const BUSAN = { lat: 35.1796, lng: 129.0756 };
export const KOREA = { lat: 36.35, lng: 127.8 };      // 한국 전체가 한눈에 보이는 기본 시작 위치 (zoom 6~7)

let loading = null;
function addScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('map_script'));
    document.head.append(s);
  });
}

export function loadMapLib() {
  if (!loading) {
    loading = (async () => {
      if (!document.getElementById('maplibre-css')) {
        const link = document.createElement('link');
        link.id = 'maplibre-css';
        link.rel = 'stylesheet';
        link.href = 'css/vendor/maplibre-gl.css';
        document.head.append(link);
      }
      if (!window.maplibregl) await addScript('js/vendor/maplibre-gl-csp.js');
      window.maplibregl.setWorkerUrl(new URL('js/vendor/maplibre-gl-csp-worker.js', document.baseURI).href);   // 보안정책(CSP) 대응 버전
      return window.maplibregl;
    })().catch((e) => { loading = null; throw e; });
  }
  return loading;
}

// 공통 지도 만들기
//   wheel: true = 마우스 휠로 확대/축소(PC)  /  'click' = 지도를 한 번 눌러야 휠 확대 (페이지 스크롤이 필요한 글 상세)  /  false = 끔
export function createMap(ml, el, { center = KOREA, zoom = 7, interactive = true, wheel = interactive, style = STYLE_URL } = {}) {
  // wheel === 'smart': PC 는 누르지 않아도 휠로 바로 확대/축소, 터치 기기는 두 손가락으로만 움직여서 화면 스크롤을 방해하지 않음
  const smart = wheel === 'smart';
  const touch = smart && window.matchMedia?.('(pointer: coarse)').matches;
  const map = new ml.Map({
    container: el, style, center: [center.lng, center.lat], zoom,
    interactive, scrollZoom: wheel === true || (smart && !touch), cooperativeGestures: touch, attributionControl: { compact: true },
    dragRotate: false, pitchWithRotate: false, touchPitch: false, fadeDuration: 0,
  });
  map.touchZoomRotate?.disableRotation?.();
  if (interactive) map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
  if (wheel === 'click') {                       // 지도를 누르면 휠 확대 켜짐, 마우스가 벗어나면 꺼짐 (페이지 스크롤을 뺏지 않음)
    map.on('click', () => map.scrollZoom.enable());
    el.addEventListener('mouseleave', () => map.scrollZoom.disable());
  }
  const mark = () => { el.dataset.zoom = map.getZoom().toFixed(2); };   // (점검용) 현재 확대 단계 기록
  map.on('load', mark);
  map.on('zoomend', mark);
  mark();
  return map;
}

// 핀 모양 마커 (이미지 파일 없이 CSS 로만 그림)
export function addPin(ml, map, { lat, lng }, { draggable = false, popup = null } = {}) {
  const el = document.createElement('div');
  el.className = 'pin-marker';
  const marker = new ml.Marker({ element: el, anchor: 'bottom', draggable }).setLngLat([lng, lat]).addTo(map);
  if (popup) marker.setPopup(new ml.Popup({ offset: [0, -34], maxWidth: '240px' }).setDOMContent(popup));
  return marker;
}

// 바깥 지도 앱으로 열기 링크 (좌표는 숫자라서 안전)
export const googleMapsUrl = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${Number(lat)},${Number(lng)}`;
// 한국에서 많이 쓰는 지도 앱 링크 (모두 무료 웹 지도, 로그인 불필요). 이름 검색 + 좌표로 열립니다.
export function mapAppLinks(lat, lng, name = '') {
  const la = Number(lat), ln = Number(lng), q = encodeURIComponent(String(name || '').slice(0, 80));
  return [
    { id: 'naver', label: 'Naver Map', url: `https://map.naver.com/v5/search/${q || `${la},${ln}`}?c=${ln},${la},16,0,0,0,dh` },
    { id: 'kakao', label: 'Kakao Map', url: `https://map.kakao.com/link/map/${q || 'Place'},${la},${ln}` },
    { id: 'google', label: 'Google Maps', url: googleMapsUrl(la, ln) },
  ];
}
export const osmUrl = (lat, lng) => `https://www.openstreetmap.org/?mlat=${Number(lat)}&mlon=${Number(lng)}#map=17/${Number(lat)}/${Number(lng)}`;
