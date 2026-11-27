// events.data.js | 이벤트 메뉴에 나오는 공식 사이트 목록 (여기만 고치면 화면이 바뀝니다)
//
// ★ 새 지역/사이트를 추가하려면:
//   1) 아래 REGIONS 에 { id, links: [{ label, url }] } 를 추가
//   2) js/locales/*.js 4개 파일에 'events.region.<id>' (지역 이름), 'events.region.<id>.text' (한 줄 설명), 링크 label 문구를 추가
//   3) npm run check  (번역 빠진 곳을 알려 줍니다)
// ※ 반드시 https:// 로 시작하는 "공식" 주소만 넣으세요. (npm run check 가 형식을 검사합니다)

// 한국관광공사(KTO) 공식 여행 사이트 VISITKOREA — 언어별 주소
export const VISITKOREA = [
  { lang: 'en', label: 'English', url: 'https://english.visitkorea.or.kr' },
  { lang: 'ko', label: '한국어', url: 'https://korean.visitkorea.or.kr/main/main.do' },
  { lang: 'ja', label: '日本語', url: 'https://japanese.visitkorea.or.kr' },
  { lang: 'zh', label: '中文', url: 'https://chinese.visitkorea.or.kr' },
  { lang: 'de', label: 'Deutsch', url: 'https://german.visitkorea.or.kr' },
  { lang: 'fr', label: 'Français', url: 'https://french.visitkorea.or.kr' },
  { lang: 'es', label: 'Español', url: 'https://spanish.visitkorea.or.kr' },
  { lang: 'ru', label: 'Русский', url: 'https://russian.visitkorea.or.kr' },
];

// 한국관광공사 여행정보 전화 (24시간·다국어 통역). 국내 1330 / 해외에서 +82-2-1330
export const HOTLINE = { display: '1330', tel: 'tel:1330', intl: '+82-2-1330', intlTel: 'tel:+82-2-1330' };

export const REGIONS = [
  { id: 'busan', links: [
    { label: 'events.link.busanEvents', url: 'https://www.busan.go.kr/eng/bsevents' },
    { label: 'events.link.biff', url: 'https://www.biff.kr' },
  ] },
  { id: 'seoul', links: [{ label: 'events.link.seoul', url: 'https://english.visitseoul.net/eventsx' }] },
  { id: 'jeju', links: [{ label: 'events.link.jeju', url: 'https://www.visitjeju.net/en' }] },
  { id: 'gyeongju', links: [{ label: 'events.link.gyeongju', url: 'https://www.gyeongju.go.kr/open_content/eng/page.do?mnu_uid=1384' }] },
];
