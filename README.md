# 🌊 KoreaLink — 한국을 찾는 외국인 여행자 커뮤니티 앱

한국 전국을 여행하는 외국인 여행자들을 위한 커뮤니티입니다. **안드로이드 폰에 "앱처럼" 설치**되고(홈 화면 아이콘, 전체화면), PC 브라우저에서도 똑같이 동작합니다.

| 기능 | 설명 |
|---|---|
| 📍 **장소 게시판** | 사진 최대 6장 · 카테고리 · 검색 · 최신/좋아요순 · **댓글 + 대댓글** · **좋아요** · 신고 |
| 💬 **게스트 채팅방** | 실시간 채팅 · 방 여러 개 · 내 메시지 수정/삭제 · 남의 메시지는 신고만 |
| 👤 **내 프로필** | 사진 · 소개 · 국가 · 언어 · 내가 쓴 글 · 비밀번호 변경 · 회원 탈퇴 |
| 🔑 **회원 시스템** | 이메일 가입(인증 메일) · 로그인 · 비밀번호 찾기 · (선택) Google 로그인 · 닉네임 실시간 중복 확인 |
| 🛠️ **관리자** | 신고 처리 · 글/댓글 숨김 · 회원 차단 · 채팅방 만들기/닫기 (잠금 처리됨) |
| 🌐 **다국어** | 기본 **영어**, 폰 언어에 맞춰 **한국어 · 日本語 · 中文** 자동 전환 (직접 변경도 가능) |

> 🔒 보안은 [`SECURITY.md`](SECURITY.md)에 "코딩 모르는 사람용"으로 자세히 설명해 두었습니다.

---

## ✅ 지금 상태 (솔직한 보고)

- 데이터베이스 보안 규칙: 실제 PostgreSQL에서 **공격 시뮬레이션 73개 항목 모두 통과**.
- 화면 동작: 실제 브라우저(Chromium)로 **81개 항목 통과** (가입·로그인 화면, 글/댓글/대댓글/좋아요, 사진 업로드, 채팅, 프로필, 관리자, 모바일/PC 반응형, 4개 언어).
- ⚠️ **아직 실제 Supabase에 연결해 보지는 못했습니다.** (제 작업 환경에서 Supabase의 로그인 서버·사진 저장소·실시간 채팅 실물을 띄울 수 없었습니다.) 아래 **7번 체크리스트**로 배포 후 10분이면 확인됩니다.
- ⚠️ **안드로이드 설치 파일(.apk)은 만들지 않았습니다.** (제 환경에 안드로이드 빌드 도구가 없습니다.) 대신 **폰에서 "앱 설치"** 하는 방식(PWA)으로 만들었고, Play 스토어 출시 방법은 5번에 있습니다.

---

## 🚀 시작하기 (약 20분, 코딩 필요 없음)

필요한 것: 이메일 계정, 컴퓨터. (모두 무료로 시작 가능)

### 1단계. Supabase 프로젝트 만들기 (데이터베이스)
1. <https://supabase.com> 가입 → **New project**.
2. 이름(예: korealink), **Database Password**(길게, 비밀번호 관리자에 저장 — 이 앱에는 쓰지 않음), 지역은 **Northeast Asia (Seoul)** 선택 → Create.
3. 1~2분 기다리면 완성됩니다.

### 2단계. 데이터베이스 설치 (SQL 붙여넣기 — 001~009)
왼쪽 메뉴 **SQL Editor → New query** 에서, 아래 파일을 **순서대로** 열어 내용 전체를 붙여넣고 **Run** 을 누르세요. (각 파일 실행 후 `Success` 확인)

1. `supabase/migrations/001_schema.sql` — 데이터 보관함(테이블) 만들기
2. `supabase/migrations/002_functions.sql` — 자동 규칙(도배 방지, 좋아요 수 자동 계산 등)
3. `supabase/migrations/003_security.sql` — **보안 규칙(RLS)**
4. `supabase/migrations/004_seed.sql` — 기본 채팅방 3개
5. `supabase/migrations/005_map_rating_optimize.sql` — **지도 위치 · 별점 · 데이터/사진 절약** (이미 1~4번을 했다면 이 파일만 추가로 실행)

**보안 점검 실행 (꼭!)**: New query에 `supabase/tests/security_check.sql` 내용을 붙여넣고 Run → 결과 표 맨 윗줄이 **`PASS`** 이면 성공.
(점검용 임시 회원을 만들었다가 자동 삭제하므로 실제 데이터는 영향받지 않습니다.)
6. `supabase/migrations/006_profile_privacy_events_langs.sql` — **프로필 항목별 공개/비공개 · 12개 언어 · 실시간 이벤트 저장 칸** (이미 1~5번을 했다면 이 파일만 추가로 실행)

5번(005)을 실행한 뒤에는 `supabase/tests/security_check_005.sql`, 6번(006)을 실행한 뒤에는 `supabase/tests/security_check_006.sql` 도 같은 방식으로 실행 → 맨 윗줄 **`PASS`** (005: 10 / 10, 006: 26 / 26). `security_check.sql` 도 006 이후 다시 실행하면 73 / 73 이 나와야 합니다.

> ❗ `supabase/tests/mock_supabase.sql` 은 **내 컴퓨터 테스트용**입니다. Supabase에서 **실행하지 마세요.**

### 3단계. 로그인 설정 (대시보드에서 클릭)
**Authentication** 메뉴에서:
- **Sign In / Providers → Email**: `Confirm email` **ON**, 최소 비밀번호 길이 **8** 이상.
- **URL Configuration**: `Site URL` 에 **내 사이트 주소**(5단계 후 생김, 예: `https://korealink.netlify.app`) 입력. `Redirect URLs`에도 같은 주소 추가.
  (처음엔 비워 두고, 5단계에서 주소가 생기면 돌아와서 입력하세요.)
- (권장) **Attack Protection → CAPTCHA** 켜기. (봇 가입 방지)
- Google 로그인: 아래 **「8. Google 로그인 켜기」** 참고. (앱 쪽 버튼은 이미 켜져 있고, 구글/Supabase 설정만 하면 바로 동작)

### 4단계. 내 Supabase 정보를 앱에 연결 (딱 한 파일, 두 줄)
1. Supabase **Project Settings → API** 에서 두 가지를 복사:
   - **Project URL** (예: `https://abcd1234.supabase.co`)
   - **Publishable key** (또는 `anon` `public` 키) ← **공개용 키**
2. `js/config.js` 를 메모장으로 열어 두 값을 붙여넣고 저장:
   ```js
   export const SUPABASE_URL = 'https://abcd1234.supabase.co';
   export const SUPABASE_PUBLISHABLE_KEY = '여기에 공개용 키';
   ```
> 🚫 **`service_role` / `secret` 키는 절대 넣지 마세요.** (만능열쇠입니다.) 실수로 넣으면 `npm run check`가 잡아줍니다.

### 5단계. 인터넷에 올리기 (무료)
**`deploy` 폴더**(배포 전용 폴더. 앱 실행에 필요한 파일만 들어 있음)를 올립니다.

> `deploy` 폴더는 4단계에서 수정한 `js/config.js`가 반영되어야 합니다. Node.js가 있다면 `npm run build` 한 번이면 최신으로 다시 만들어집니다. 없다면 `deploy/js/config.js` 도 같은 방식으로 직접 수정하세요.

가장 쉬운 방법 — **Netlify Drop**:
1. <https://app.netlify.com/drop> 접속(가입 필요) → **`deploy` 폴더를 통째로 끌어다 놓기**.
2. 몇 초 뒤 `https://무작위이름.netlify.app` 주소가 생깁니다. (Site settings에서 이름 변경 가능)
3. **이 주소를 3단계의 Site URL / Redirect URLs 에 입력**하세요. ← 이걸 해야 인증 메일 링크가 정상 동작합니다.

(Cloudflare Pages, Vercel도 같은 방식으로 가능하며, 보안 헤더 파일 `_headers` / `vercel.json`이 이미 들어 있습니다.)

### 6단계. 첫 관리자 지정
1. 앱에서 **본인 계정으로 회원가입**(+ 이메일 인증)합니다.
2. Supabase **SQL Editor**에서 아래를 실행 (`내닉네임`을 바꾸세요):
   ```sql
   update public.profiles set role = 'admin' where username = '내닉네임';
   ```
3. 앱에서 로그아웃 → 로그인하면 하단/상단 메뉴에 **Admin**이 나타납니다.

> 관리자 지정은 **이 방법으로만** 가능합니다. 앱 안에서는 누구도(관리자도) 다른 사람을 관리자로 만들 수 없게 막아 두었습니다.

---

## 📱 안드로이드에 설치하기

**방법 1 — 가장 쉬움 (지금 바로)**
폰의 **Chrome**으로 사이트 주소 접속 → 오른쪽 위 **⋮ 메뉴 → "앱 설치"(또는 "홈 화면에 추가")**.
→ 홈 화면에 아이콘이 생기고, 주소창 없는 전체화면 앱처럼 열립니다.

**방법 2 — Google Play 스토어 출시 (선택)**
1. <https://www.pwabuilder.com> 에 내 사이트 주소 입력 → **Package for stores → Android**.
2. 안내대로 만들어진 `.aab` 파일을 **Google Play Console**(개발자 등록비 $25, 1회)에 업로드.
3. 필요한 것: 개인정보처리방침 페이지, 스토어 설명/스크린샷. (앱 안에 회원 탈퇴 기능이 이미 있어 도움이 됩니다. 다만 Play는 정책이 자주 바뀌고 "웹에서 탈퇴 요청하는 링크"도 요구할 수 있으니, 제출 시 Play Console 안내를 꼭 확인하세요.)

---

## ✅ 7. 배포 후 첫 점검 체크리스트 (10분)

두 개의 계정(예: 본인 + 친구/다른 이메일)으로 진행하세요.

- [ ] 회원가입 → 인증 메일 도착 → 링크 클릭 → 앱으로 돌아와 로그인된다
- [ ] 비밀번호 찾기 메일 → 링크 → 새 비밀번호 설정된다
- [ ] 글 쓰기 + **사진 2장** 업로드 → 목록/상세에 사진이 보인다
- [ ] 계정 B로 댓글·**대댓글**·좋아요 → 계정 A 화면에 숫자가 맞게 보인다
- [ ] **채팅**: 계정 A, B 두 기기에서 같은 방에 들어가 → 한쪽이 보내면 **새로고침 없이** 상대 화면에 나타난다 *(실시간 확인)*
- [ ] 계정 B로 A의 메시지에는 **수정/삭제 버튼이 없다**
- [ ] 프로필 사진 변경, 언어 변경(한국어/日本語/中文)이 바로 반영된다
- [ ] 글쓰기에서 **+ → 위치**: 검색 → 핀 선택 → 별점 4개 → 게시 → 상세에 지도·별점이 보인다
- [ ] 탐색 화면의 **지도** 버튼에서 내 글의 핀이 보이고, 누르면 글로 이동한다
- [ ] **이벤트** 메뉴에서 링크가 새 창으로 열린다 / 국가를 설정한 회원 이름 옆에 국기가 보인다 (Windows PC 포함)
- [ ] (Google 설정 후) 「Continue with Google」로 로그인된다
- [ ] 일반 계정으로 `사이트주소/#/admin` 입력 → 탐색 화면으로 되돌아간다
- [ ] 관리자 계정으로 신고 목록·회원 목록이 보인다

문제가 생기면 **그 화면의 증상과 폰 화면 캡처**를 저에게 보내 주세요. 바로 고칠 수 있습니다.

---

## 🔐 8. Google 로그인 켜기 (무료, 약 10분)

앱에는 이미 「Continue with Google」 버튼이 들어 있습니다. 구글 쪽 설정을 하기 전에는 눌러도 오류가 나므로, 아래를 해 주세요.
(원하지 않으면 `js/config.js` 의 `googleLogin` 을 `false` 로 바꾸면 버튼이 사라집니다.)

1. Supabase → **Authentication → Sign In / Providers → Google** 을 열고, 거기 표시된 **Callback URL**(`https://○○○.supabase.co/auth/v1/callback`)을 복사해 둡니다.
2. 브라우저에서 **Google Cloud Console**(console.cloud.google.com) → 프로젝트 만들기(무료) → **APIs & Services → OAuth consent screen**:
   User Type **External**, 앱 이름·내 이메일만 입력하고 저장. (민감한 권한은 요청하지 않으므로 심사 없이 사용 가능)
3. **Credentials → Create credentials → OAuth client ID** → 종류 **Web application**:
   - **Authorized JavaScript origins**: `https://gentle-swan-ecbb53.netlify.app` (내 사이트 주소)
   - **Authorized redirect URIs**: 1번에서 복사한 Callback URL
   - 만들면 나오는 **Client ID** 와 **Client secret** 을 복사.
4. Supabase 의 Google 화면에 **Client ID / Client secret** 을 붙여넣고 **Enable** → Save.
   ※ **Client secret 은 Supabase 대시보드에만** 넣으세요. 앱 파일이나 채팅에 올리지 마세요. (이 값은 서버 쪽에서만 쓰입니다)
5. 앱에서 「Continue with Google」을 눌러 로그인 → 처음이면 닉네임이 `traveler_xxxxxxxx` 로 자동 생성됩니다. **내 정보 → 프로필 수정**에서 바꾸세요.

## 💸 9. 서버 비용을 최소로 쓰는 방법 (이 앱에 적용된 것)

| 항목 | 적용한 방법 | 효과 |
|---|---|---|
| 사진 저장 | 올릴 때 **WebP 로 자동 변환**, 긴 변 **1280px**, 약 **600KB 이하** (원본 10MB 급도 가능) | 저장공간·전송량 대폭 절약 |
| 목록 사진 | 목록용 **작은 사진(긴 변 480px, 약 60KB 이하)**을 따로 저장해 목록에서는 그것만 로드 | 목록 한 화면당 전송량 약 1/10 |
| 프로필 사진 | 256px · 약 150KB 이하 | 저장공간 절약 |
| 저장소 한도 | 서버에서도 게시글 사진 1MB, 프로필 300KB 로 제한 (005 에서 적용) | 큰 파일 악용 방지 |
| 글 목록 데이터 | 글 전체 대신 **앞 140자 요약**만 받음, 10개씩 나눠서(더 보기) | 데이터 전송량 절약 |
| 지도 | **OpenFreeMap(무료, 키·가입 없음)** + MapLibre. 영문/현지 이름이 함께 나오는 지도. 지도 화면을 열 때만 코드를 내려받음 | 지도 비용 0원 |
| 장소 검색 | **Photon(무료)** 으로 글자를 치면 바로 후보가 뜸(영어 이름 검색에 강함, 한국 안만). 결과가 없으면 Nominatim 으로 보조 검색 | 외국인이 영어로 검색해도 잘 나옴 |
| 실시간 이벤트 | 한국관광공사 정보를 **서버가 6시간에 한 번만** 가져와 DB에 저장, 방문자는 DB만 읽음 | 방문자가 늘어도 공공데이터 호출 횟수는 하루 몇 번 |
| 호스팅 | Netlify 무료 플랜, Supabase 무료 플랜 | 월 0원 |

**무료 한도 참고 (변경될 수 있으니 각 사이트 요금 안내에서 확인하세요)**: Supabase 무료 플랜은 저장공간·전송량·월간 사용자 수에 한도가 있고, 일정 기간 접속이 없으면 프로젝트가 일시 중지될 수 있습니다. 사용자가 늘면 대시보드의 **Usage** 에서 사용량을 확인하세요.
**지도 타일 주의**: OpenFreeMap 과 Photon 은 무료 공개 서비스라 사용량이 아주 커지면 제한될 수 있으므로, 사용자가 크게 늘면 유료/전용 타일 서비스(예: MapTiler 무료 플랜 등)로 옮기라고 권장합니다. 옮길 때는 `js/features/map/maplib.js` 의 `STYLE_URL` 한 줄과 CSP(`_headers`, `vercel.json`, `index.html`)만 바꾸면 됩니다.

## 🎪 10. 실시간 이벤트(한국관광공사) 켜기 — 선택, 무료, 약 15분

이 단계를 건너뛰어도 앱은 정상 동작하고, 이벤트 화면에는 공식 사이트 링크 모음만 보입니다. 켜면 "지금 진행 중/곧 열리는 행사" 카드가 추가됩니다(부산·서울·제주·전국).

1. https://www.data.go.kr 가입 → **"한국관광공사_국문 관광정보 서비스_GW"** 와 **"한국관광공사_영문 관광정보서비스_GW"** 두 개를 **활용신청** (개발계정은 보통 바로 승인, 하루 1,000회; 승인 직후 1~2시간은 인증키가 아직 반영되지 않을 수 있음). **앱 언어가 한국어면 국문, 그 외 모든 언어는 영문 서비스**로 행사를 보여 줍니다.
2. 발급된 **일반 인증키(Decoding)** 를 복사.
3. Supabase 대시보드 → **Edge Functions → Secrets** → 이름 `KTO_API_KEY`, 값에 인증키 붙여넣기. (이 키는 **앱 파일/GitHub 에 절대 넣지 마세요.** 여기에만 보관합니다.)
4. **Edge Functions → Deploy a new function** → 이름 `kto-events` → `supabase/functions/kto-events/index.ts` 내용을 붙여넣고 Deploy. 함수 설정에서 **Verify JWT 는 끄세요**(OFF) — 새 방식의 publishable 키는 JWT 가 아니라서 켜져 있으면 호출이 거절됩니다. 이 함수는 키를 돌려주지 않고 정해진 일만 하므로 안전합니다.
5. 앱의 Events 화면을 열면 자동으로 첫 갱신이 일어납니다(이후 6시간마다). 안 보이면 Edge Functions → kto-events → **Logs** 를 확인하세요.

## 🔒 11. 프로필 공개 규칙

**표시 이름·국적·거주 국가·성별·소개는 항상 공개**입니다(그래서 모임에서 서로 어떤 사람인지 알 수 있어요). **태어난 해(나이)만 선택**이며, 스위치를 켜야 나이가 보입니다. 닉네임(@아이디)과 사진도 항상 공개입니다. 나이는 태어난 해만 저장하고 화면에는 계산된 나이만 보입니다. 태어난 해가 꺼져 있으면 서버의 공개 프로필에 값 자체가 비어 있어 개발자도구(F12)로도 볼 수 없습니다. 채팅의 이름을 누르면 상세 프로필로 이동합니다.

## 🤝 12-A. 모임 & 동행 (Meetups) — 새 메뉴

- 하단 메뉴 **Meetups**: 종류(식사·카페·관광·자연·밤문화·문화·쇼핑·운동·언어교환·사진·기타) 칩, 날짜(오늘/이번 주), "내 언어" 필터, **내 모임** 탭.
- 모임 만들기: 제목·종류·일시·**지도로 만나는 장소 선택**·정원(2~20)·**승인제 스위치**·사용 언어(최대 4)·비용 안내·대표 사진·설명.
- 참여: 즉시 참여 또는 승인제(소개 메모와 함께 신청 → 방장 승인/거절). 정원/승인 규칙은 서버(DB)가 강제합니다. 방장은 참여자 내보내기·수정·취소·삭제.
- **단체 채팅은 참여 확정자(와 방장)만** 읽고 쓸 수 있습니다(서버 규칙). 안전 수칙 안내, 공유, 신고(관리자 화면에서 숨김 가능)가 있습니다.
- 설치: `007_meetups_eventphoto_profilepublic.sql` 실행 → `security_check_007.sql` 실행(전부 PASS).

## 🖼️ 12-B. 행사 사진
이벤트 카드에 한국관광공사가 제공하는 대표 사진이 나옵니다(없으면 사진 없이 표시). 사진을 보려면 **007 SQL 실행 + `kto-events` 함수를 새 `index.ts` 로 교체 후 Deploy** 해야 하고, 이후 첫 갱신(최대 6시간, 또는 즉시 갱신 아래 참고) 때부터 채워집니다.

## 🔑 12-C. 카카오 로그인 켜기 + 구글 플레이 심사 준비 (선택, 무료)

**A. 카카오 로그인**
1. https://developers.kakao.com → 애플리케이션 추가 → **앱 설정 > 앱 > 플랫폼 키** 의 **REST API 키**(= Client ID)를 복사. 같은 화면에서 **카카오 로그인 Client Secret 을 활성화**하고 코드를 복사.
2. Supabase → Authentication → Providers → **Kakao**: 위 두 값을 넣고 Enabled → 화면에 보이는 **Callback URL** 을 복사.
3. 카카오 디벨로퍼스 → 플랫폼 키 → REST API 키 → **카카오 로그인 Redirect URI** 에 그 Callback URL 을 붙여넣고 저장.
4. 카카오 로그인 → **사용 설정 ON**, **동의 항목**에 `profile_nickname`, `profile_image` 추가. 이메일(`account_email`)은 **비즈 앱**으로 전환해야 받을 수 있습니다. 이메일 없이 쓰려면 Supabase Kakao 설정의 **Allow users without an email** 을 켜세요.
5. (v020부터) 카카오 버튼은 항상 보이므로 `config.js` 를 고칠 필요가 없습니다. 위 설정이 끝나면 바로 동작합니다.
6. (선택) **탈퇴 시 카카오 연결도 자동 해제**: 카카오 앱 키 화면의 **어드민 키**를 Supabase → Edge Functions → Secrets 에 `KAKAO_ADMIN_KEY` 로 저장하고, 새 함수 `unlink-social` 을 `supabase/functions/unlink-social/index.ts` 내용으로 만들어 Deploy(**Verify JWT 는 OFF**). 안 해도 탈퇴는 정상 동작합니다.

**B. 구글 플레이 심사에 필요한 것 (이 앱에 이미 들어 있음)**
| 심사 요구 | 어디에 있나 |
|---|---|
| 개인정보처리방침 URL | `https://내사이트/privacy.html` (영어+한국어, 로그인 불필요) |
| 앱 안 계정 삭제 | 내 정보 → **회원 탈퇴** (계정·모든 콘텐츠·소셜 연동 기록 즉시 삭제) |
| 웹에서 계정 삭제 안내 URL | `https://내사이트/delete-account.html` (로그인 불필요) |
| Play Console 입력 | 앱 콘텐츠 → 개인정보처리방침 URL, **데이터 보안(Data safety)**, **계정 삭제 URL** 에 위 주소 입력 |

⚠️ **꼭 바꿔야 할 3곳**: `privacy.html`, `delete-account.html` 안의 `REPLACE_OPERATOR_NAME`(운영자 이름/상호), `REPLACE_CONTACT_EMAIL`(문의 메일), `REPLACE_SUPABASE_REGION`(Supabase 대시보드 Project Settings 에서 확인한 서버 지역). `npm run build` 가 안 바꾼 게 있으면 경고해 줍니다.

**C. 이메일로 들어온 삭제 요청 처리법 (방침에 약속한 10일 이내)**: Supabase → Authentication → Users → 해당 회원 검색 → 오른쪽 `…` → **Delete user**. (프로필·글·모임 등은 자동으로 함께 삭제됩니다. 사진 파일은 Storage → `post-images`/`avatars` 안의 그 회원 폴더(회원 ID 이름)를 삭제하세요.)

**D. 설치**: SQL Editor 에서 `008_account_deletion.sql` 실행 → `security_check_008.sql` 실행(전부 PASS).

## 🗺️ 12-D. 모임 지도
모임 상세의 지도는 **누르지 않고도 마우스 휠로 바로 확대/축소**되고(휴대폰은 두 손가락으로만 움직여서 화면 스크롤을 방해하지 않음), **지도를 누르면 네이버지도 · 카카오맵 · 구글지도 선택창**이 열립니다. "Open in a map app" 버튼으로도 열 수 있습니다.

## 🇰🇷 12-E. KoreaLink: 전국 서비스 + 이름 바꾸기 (v011)

**전국 지역 선택**: 글·모임·이벤트에 17개 시·도 선택(서울, 부산, 인천, 대구, 대전, 광주, 울산, 세종, 경기, 강원, 충북, 충남, 전북, 전남, 경북, 경남, 제주)이 생겼습니다. 목록 위의 지역 칸으로 거르고, 글/모임을 쓸 때는 지도에서 장소를 고르면 지역이 **자동 추천**됩니다(바꿀 수 있음). 기존 글/모임은 모두 "부산"으로 채워집니다. 지도 기본 시작 위치와 장소 검색도 한국 전체 기준으로 바뀌었습니다.
- 설치: SQL Editor 에서 `009_regions.sql` 실행 → `security_check_009.sql` 실행(PASS 7/7).
- 이벤트(한국관광공사) 함수는 원래 전국 데이터를 가져오므로 **다시 배포할 필요 없습니다**.

**Netlify 사이트 이름 바꾸기** (주소가 `korealink.netlify.app` 으로 바뀜)
1. Netlify → 사이트(gentle-swan-ecbb53) → **Site configuration → General → Site details → Change site name**.
2. `korealink` 입력 → Save. (이미 쓰는 사람이 있으면 `korealink-app` 처럼 바꾸세요.)
3. ⚠️ **옛 주소(gentle-swan-ecbb53.netlify.app)는 더 이상 열리지 않습니다.** 그래서 바로 아래 4번을 꼭 하세요.
4. Supabase → **Authentication → URL Configuration**: **Site URL** 을 새 주소(`https://korealink.netlify.app`)로 바꾸고, **Redirect URLs** 에도 새 주소를 추가(`https://korealink.netlify.app/**`)한 뒤 Save. (안 하면 로그인/이메일 인증 후 돌아오는 주소가 틀려져요.)
5. 구글 플레이/카카오에 입력한 방침 주소가 있다면 새 주소로 갱신: `https://korealink.netlify.app/privacy.html`, `/delete-account.html`.

**Supabase 프로젝트 이름 바꾸기**: Supabase → Project Settings → General → **Project name** 을 `KoreaLink` 로 저장. 이것은 화면에 보이는 이름만 바뀌고, 프로젝트 주소(`uyfglqy…supabase.co`)와 데이터는 그대로입니다(주소는 원래 바꿀 수 없음). 앱 동작에는 영향이 없습니다.

**아이콘**: 앱 아이콘 그림에 "Busan" 글자가 들어 있지 않아 그대로 써도 됩니다. 글자가 들어간 새 로고를 쓰고 싶으면 알려 주세요.

## ⏪ 12-F. 버전 번호 & 되돌리기 (롤백)

코드를 새로 만들 때마다 **번호를 붙여 저장**합니다 (`VERSION.txt`, `CHANGELOG.md`). 저장본은 `releases/` 폴더에 쌓입니다.
- `korealink-deploy-v011.zip` = **Netlify 에 올리는 완성본** (문제가 생기면 옛 번호의 이 파일을 다시 올리면 그 버전으로 돌아감)
- `korealink-src-v011.zip` = 소스 전체 (코드 수정용 원본)
- 현재 번호: v010 = 부산 앱 마지막 상태, **v011 = KoreaLink 이름 + 전국 지역**

**되돌리는 방법 (쉬운 순서)**
1. **Netlify 에서 1초 롤백 (가장 쉬움)**: 사이트 → **Deploys** 탭 → 예전 배포를 클릭 → **Publish deploy** 버튼. 올렸던 모든 배포 기록이 Netlify 에 남아 있습니다.
2. **zip 로 되돌리기**: 원하는 번호의 `korealink-deploy-vNNN.zip` 을 풀어서 Deploys 탭에 끌어다 놓습니다.
3. **DB(Supabase)는 되돌릴 필요가 없게** 설계했습니다: SQL 변경은 전부 "칸 추가" 방식이라 옛 버전 앱도 새 DB 에서 그대로 동작합니다(예: 009 의 지역 칸은 비워둬도 됨). 그래서 앱만 되돌리면 됩니다.
4. 새 버전 만들 때 명령: `npm run release -- "이번 변경 한 줄 설명"` (번호 +1, 점검, 빌드, zip 2개 저장, 기록).

## 🗂️ 폴더 지도 — "이걸 고치고 싶을 땐 이 파일"

```
korealink/
├─ index.html                 앱 껍데기 + 보안정책(CSP)
├─ manifest.webmanifest       "앱 설치" 정보 (이름, 아이콘, 색)
├─ sw.js                      폰에 앱 파일 저장(빠른 실행). 앱 수정 후 재배포 땐 안의 VERSION 숫자만 올리기
├─ _headers / vercel.json     배포 서버 보안 헤더
├─ css/
│   ├─ base.css               🎨 색상·글자 기준값 (디자인 색을 바꾸려면 여기 맨 위 :root)
│   ├─ layout.css             상단바·하단메뉴·화면 폭
│   ├─ components.css         버튼·입력칸·팝업 등 공통 부품
│   └─ features.css           게시판·댓글·채팅·프로필·관리자 화면별 디자인
├─ js/
│   ├─ config.js              ⚙️ 내가 채우는 유일한 설정 파일 (Supabase 주소 + 공개 키)
│   ├─ app.js · shell.js      시작점 · 상단/하단 메뉴
│   ├─ routes.js              📖 주소 ↔ 화면 목차 (새 화면 추가 시 한 줄)
│   ├─ core/                  공통 도구 (서버 연결, 번역, 화면 이동, 폼, 에러 문구…)
│   ├─ locales/               🌐 번역 문구 (en · ko · ja · zh)
│   ├─ vendor/supabase.js     Supabase 연결 라이브러리 (내 폴더에 포함)
│   └─ features/              ★ 기능별 폴더 (각각 service=서버 통신 / view=화면)
│       ├─ meetups/           모임 & 동행 (목록·만들기·상세·단체 채팅)
│       ├─ legal/             개인정보처리방침·삭제 안내 링크 (페이지 본체는 privacy.html / delete-account.html)
│       ├─ auth/              회원가입·로그인·비밀번호 찾기
│       ├─ posts/             장소 게시판 (목록·상세·글쓰기·좋아요·카테고리)
│       ├─ comments/          댓글·대댓글
│       ├─ events/            이벤트 메뉴 (한국관광공사·지역별 공식 행사 사이트 링크. 링크 추가는 events.data.js 한 파일)
       ├─ map/               지도 (장소 고르기 팝업·글 상세 지도·지도로 모아 보기·장소 검색)
       ├─ chat/              채팅방
│       ├─ profile/           내 프로필·다른 회원 프로필
│       ├─ reports/           신고
│       └─ admin/             관리자
├─ icons/                     앱 아이콘
├─ supabase/
│   ├─ migrations/            001~006 SQL (DB 설치 파일)
│   ├─ functions/kto-events/  한국관광공사 행사 가져오기 (Edge Function)
│   └─ tests/                 security_check.sql (보안 자동 점검) · mock_supabase.sql (테스트용)
├─ tools/                     점검·빌드 도구 (npm run check / build / serve)
├─ deploy/                    ← 이 폴더만 인터넷에 올립니다
├─ README.md · SECURITY.md    설명서
```

**자주 하는 수정**
- **문구/번역 수정** → `js/locales/ko.js` 등에서 해당 줄만 수정
- **새 언어 추가** → `locales/`에 파일 복사 후 `js/core/i18n.js`에 두 줄 추가
- **카테고리 추가** → `js/features/posts/categories.js` + `001_schema.sql`의 `posts_category_chk` + 번역(`cat.이름`)
- **색상 변경** → `css/base.css` 맨 위의 `--primary`, `--sea` 등
- **도배 한도 조정** → `supabase/migrations/002_functions.sql`의 숫자(10, 20, 12)를 바꾼 뒤 SQL Editor에서 다시 Run

> 💡 코드를 고친 뒤에는 `npm run check`(오류·번역 누락·비밀키 노출 검사) → `npm run build` → 배포 순서로 하면 안전합니다. (Node.js 18+ 필요. 코딩을 직접 하지 않으셔도, AI에게 수정을 맡길 때 이 순서를 알려주세요.)

---

## ❓ 자주 묻는 질문

**Q. 화면에 "Almost ready!"(거의 다 됐어요)가 나와요.**
`js/config.js`에 Supabase 주소/키를 아직 안 넣었거나 오타가 있는 겁니다. (`deploy/js/config.js`도 확인)

**Q. 가입했는데 인증 메일이 안 와요.**
스팸함 확인. Supabase 기본 메일 서버는 **시간당 발송 수가 매우 적습니다.** 실제 운영 때는 Authentication → SMTP Settings에서 자체 메일 서비스(Resend, SendGrid 등)를 연결하세요.

**Q. 인증 링크를 눌렀는데 이상한 곳(localhost)으로 가요.**
3단계의 **Site URL / Redirect URLs** 를 내 사이트 주소로 바꾸세요.

**Q. 사진이 안 올라가요.**
JPG/PNG/WebP 사진만 가능하고(일부 폰의 HEIC 사진은 읽지 못할 수 있어요), 2단계 `003_security.sql`을 실행했는지 확인하세요. (사진 보관함은 이 파일이 만듭니다.)

**Q. 앱을 수정해서 다시 올렸는데 폰에 옛날 화면이 나와요.**
`sw.js` 맨 위 `VERSION = 'v1'` 을 `'v2'`로 올려서 다시 배포하세요.

**Q. 여러 사람이 접속하면 비용이 드나요?**
Supabase·Netlify 무료 플랜으로 시작 가능합니다. 사용자가 많아지면 Supabase Pro(월 $25~)를 고려하세요.

## 🎨 12. 앱 아이콘 · 시작 화면 파일 (icons 폴더)

- `icon-background-512.png` (배경 층 512×512) + `icon-foreground-512.png` (아이콘 층 512×512, 투명 배경): 안드로이드 **적응형 아이콘** 2겹 규격. 아이콘 층은 가운데 안전영역 안에 그려져 어떤 모양으로 잘려도 안 짤립니다. (Play 스토어/앱 제작 도구에 이 2개를 올리세요)
- `icon-512.png`, `icon-192.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `favicon.png`: 위 2개를 합쳐 만든 설치용 아이콘
- `splash-1080x1920.png`: 시작 화면 (1080×1920). 앱을 열면 이 화면이 잠깐 뜬 뒤 사라집니다. 화면비가 달라도 비율을 유지하며 덮습니다.
- 반응형: 폰·태블릿·PC 어느 폭에서도 맞게 동작하도록 만들어져 있고, 자동 테스트에서 폰 폭(390px)과 PC 폭에서 확인합니다.

### 12-G. 게스트 채팅 / 채팅 사진·위치 / 관심사 (v013)

**순서대로 한 번만 하면 됩니다.**
1. Supabase → **SQL Editor** → New query → `supabase/migrations/010_guest_chat_interests.sql` 내용을 붙여넣고 **Run** ("Success" 면 OK).
2. 같은 방법으로 `supabase/tests/security_check_010.sql` 실행 → 맨 아래 `SUMMARY` 가 **PASS (26/26)** 이어야 합니다.
3. **게스트 입장 켜기:** Supabase → **Authentication → Sign In / Providers**(또는 Settings) → **Allow anonymous sign-ins** 스위치를 **ON** → Save.
   - 이걸 안 켜면 "게스트로 입장"을 눌렀을 때 "지금은 게스트 채팅을 쓸 수 없어요" 라고 나옵니다. (앱은 정상)
   - 봇이 게스트 계정을 마구 만드는 것을 막으려면 **Authentication → Attack Protection → CAPTCHA** 도 켜는 것을 권장합니다. (CAPTCHA 를 켜면 게스트 입장에도 필요하므로, 켠 뒤에는 앱 쪽 연동이 추가로 필요합니다. 지금은 서버 규칙(글자만, 도배 제한)으로 막혀 있습니다.)
4. 게스트 계정이 쌓이면 가끔 SQL Editor 에서 `select public.purge_old_guests(30);` (30일 지난 게스트 삭제) 를 실행하세요.

게스트가 할 수 있는 것: 채팅 **글자 메시지 읽기/쓰기**. 못 하는 것: 글·댓글·좋아요·모임·사진 올리기·사진/위치 보내기 (서버가 거절).
로그인한 회원은 채팅 입력창 왼쪽 **+ 버튼**으로 **사진**과 **위치(지도)** 를 보낼 수 있습니다.

### 12-H. 새 디자인(보라·핑크 일러스트) / 아이콘·스플래시 교체 (v014)
- SQL 작업 없음. 앱 파일만 올리면 됩니다. (010 SQL 은 v013 때 이미 안내한 대로 실행되어 있어야 게스트 채팅/관심사가 동작)
- 사진 파일은 `icons/art/` 에 있습니다. 같은 이름(`v-hero.webp`, `v-group.webp`, `v-palace.webp`, `v-tower.webp`, `v-street.webp`, `card-*.webp`, `logo-k.webp`, `logo-mark.png`)으로 고해상도 원본을 덮어쓰면 바로 바뀝니다.
- 앱 아이콘: `icons/icon-512.png`(일반), `icon-maskable-512.png`(안드로이드 둥근 마스크용), `icon-background-512.png` + `icon-foreground-512.png`(배경/전경 2장), 스플래시 `icons/splash-1080x1920.png`.


## 12-I. v015: 거주 지역 · 아바타 · 국기 · 여행 팁 팝업 (SQL 011 필수)
1. Supabase → SQL Editor 에서 `supabase/migrations/011_residence_region_avatar.sql` 실행 → 이어서 `supabase/tests/security_check_011.sql` 실행 (마지막 줄 PASS 확인). **011 을 실행하기 전에 v015 를 올리면 프로필 불러오기가 실패하니 SQL 먼저 실행하세요.**
2. 프로필 사진은 없어지고 아바타로 바뀝니다. (옛 사진 파일은 저장소에 남아 있지만 화면에는 쓰지 않습니다.)
3. 새 아바타 부품/옷(유료 예정)은 `js/features/avatar/avatar.parts.js` 의 목록 끝에 추가합니다. `free: false` 를 붙이면 🔒 로 잠깁니다. 번호 순서는 바꾸지 마세요(저장된 값이 번호입니다).
4. 국기 그림은 `icons/flags/xx.svg` (국가코드 소문자). 스페인·멕시코는 문장 없이 단순화한 버전입니다.

## 12-J. v016/v017: 출석체크 포인트 · 로그인(구글+이메일) (SQL 012 필수)
1. Supabase SQL Editor 에서 `012_points.sql` → `security_check_012.sql` 순서로 실행 (마지막 줄 PASS 확인). 011 을 아직 안 했다면 011 먼저.
2. (v017 변경) 로그인은 **구글 + 이메일 두 가지**입니다. Supabase 에서 Email 은 켜 둔 채로(기본값), Google 은 8번 순서대로 따로 켜세요. 구글을 아직 안 켠 상태에서 구글 버튼을 누르면 "아직 준비되지 않았어요" 안내가 나옵니다.
3. 포인트 규칙은 `012_points.sql` 안에서만 정합니다: 출석체크 `roll_points()` (10P / 2% 30P / 0.2% 100P), 아바타 변경 비용 `avatar_change_cost()` (현재 10P, 첫 저장은 무료). 숫자를 바꾼 뒤 SQL 을 다시 실행하면 적용됩니다. 출석 기준일은 한국시간(자정)입니다.

## 12-K. v017: 행사 카드 → 공식 홈페이지로 바로 이동 (SQL 013 + 서버 함수 재배포)
1. SQL Editor 에서 `013_event_homepage.sql` 실행.
2. Supabase → Edge Functions → `kto-events` → 코드 전체를 새 `supabase/functions/kto-events/index.ts` 내용으로 바꾸고 **Deploy**. (KTO_API_KEY 비밀값은 그대로)
3. 앱을 열면 6시간 안에(또는 함수 갱신 시) 행사별 홈페이지 주소가 채워집니다. 한 번에 최대 50건씩 채우므로 전부 채워지는 데 하루쯤 걸릴 수 있습니다. 홈페이지가 없는 행사만 구글 검색으로 열립니다.

(v018 추가) 카드를 누르는 순간 서버 함수가 그 행사의 홈페이지를 바로 조회하므로, 함수를 새 버전으로 **Deploy** 하고 013 SQL 만 실행해 두면 기다리지 않아도 바로 이동합니다. 커뮤니티/모임/여행 팁 3개 탭은 처음 열 때 프로필의 거주 지역이 자동 선택됩니다("전국" 칩을 누르면 전국).

## 12-L. v019: 이메일 신규 가입 막기 (SQL 014)
- 화면: 로그인 화면에서 "회원가입" 링크를 없앴고 `#/signup` 주소는 로그인으로 보냅니다. 새 회원은 **구글로 가입**합니다. 기존 이메일 회원(관리자 포함)은 그대로 이메일 로그인/비밀번호 찾기가 됩니다.
- 서버: `014_block_email_signup.sql` 실행 → 이메일 신규 가입이 서버에서도 거절됩니다. (구글 가입, 게스트 채팅은 정상) 확인은 `security_check_014.sql`.
- 다시 열기: SQL Editor 에서 `drop trigger if exists block_email_signup on auth.users;` 실행 + `js/routes.js` 의 `/signup` 줄을 원래대로(README 위쪽 v017 참고) 되돌리고 로그인 화면에 가입 링크 복구.

## 12-M. v020: 로그인은 구글 + 카카오톡만 (이메일 가입/로그인 삭제)
- 로그인 화면에는 「Google」「Kakao」 두 버튼만 있습니다. 이메일 입력칸, 회원가입, 비밀번호 찾기/변경은 모두 없앴습니다. (예전 주소는 로그인 화면으로 이동)
- 서버에서도 이메일 신규 가입을 막으려면 `014_block_email_signup.sql` 을 실행하세요. (이미 했다면 그대로)
- **관리자 주의**: 관리자 계정이 이메일 계정이라면 이제 화면에서 로그인할 수 없습니다. 같은 이메일의 구글 계정으로 로그인하면 기존 계정에 자동으로 연결되는 것이 기본 동작입니다. 로그인 후 관리자 메뉴가 보이는지 꼭 확인하세요. 안 보이면 새로 생긴 계정에 관리자 지정 SQL 을 다시 실행해야 합니다.
- 카카오 로그인은 위 「소셜 로그인」 A 항목(카카오 디벨로퍼스 + Supabase Kakao Provider)을 먼저 설정해야 합니다. 설정 전에 누르면 "아직 준비되지 않았어요" 안내가 나옵니다.

## 12-N. v021: 호스팅을 Netlify → Cloudflare Pages 로 옮기기
- 앱은 "파일만 올리면 되는 정적 사이트"라 코드 수정 없이 Cloudflare Pages 에서 그대로 동작합니다. `_headers`(보안 규칙)도 같은 문법이라 자동 적용됩니다. (이번에 매니페스트 파일 형식 한 줄만 추가)
- 올리는 법은 `korealink-deploy-vNNN.zip` 파일을 Cloudflare 대시보드의 Workers & Pages → 프로젝트 → **Create a new deployment** 에 드래그. (zip 그대로 가능, 파일 1,000개 이하 / 파일 하나 25MB 이하 — 이 앱은 약 200개, 5MB)
- 주소가 바뀌면 아래 4곳도 새 주소로 바꿉니다: Supabase **URL Configuration**(Site URL, Redirect URLs `https://새주소/**`), Google Cloud **승인된 JavaScript 원본**, Kakao 개발자 **플랫폼 > Web 도메인**, privacy.html/delete-account.html 의 주소 안내 및 Play Console 의 개인정보/계정삭제 URL.
- 되돌리기: Cloudflare 프로젝트 → Deployments 목록 → 이전 배포의 `…` → **Rollback to this deployment**.
- Cloudflare 의 Web Analytics(자동 삽입) 는 켜지 마세요. 보안 규칙(CSP)이 외부 스크립트를 막아 오류 표시만 생깁니다.

## 12-O. v022: GitHub(소스) → Cloudflare Pages(배포) → Supabase(회원·글·사진) 구조
역할 분담
- **GitHub**: 앱 소스코드를 보관(비공개 저장소). 여기에 새 파일을 올리면 자동으로 배포가 시작됩니다.
- **Cloudflare Pages**: GitHub 의 코드를 가져와 `npm run build` 로 만든 `deploy` 폴더를 웹사이트로 공개. (빌드 설정: 빌드 명령 `npm run build`, 출력 폴더 `deploy`, 환경변수 `NODE_VERSION` 은 `.node-version` 파일이 대신함)
- **Supabase**: 회원(로그인), 게시글/댓글/채팅, 사진 저장. 코드(GitHub)에는 공개 가능한 주소/공개 키만 들어 있고 비밀 키는 없습니다.
새 버전 반영 순서: ① `korealink-github-vNNN.zip` 을 로컬 저장소 폴더에 풀기 → ② GitHub Desktop 에서 Commit → Push → ③ Cloudflare 가 자동 배포(1~2분) → ④ 안 되면 Cloudflare Deployments 에서 Rollback.
점검(npm run check)을 통과하지 못하면 Cloudflare 빌드가 실패하고 **기존 사이트는 그대로 유지**됩니다. (잘못된 코드가 공개되지 않는 안전장치)

### 12-P. 모임 승인 알림 (v024, 015_notifications.sql)
- 방장이 참가 신청을 **승인**하면 신청한 사람에게 알림이 생깁니다. 앱 위쪽 종 모양 🔔에 빨간 숫자가 뜨고, 앱이 켜져 있으면 작은 알림창도 뜹니다.
- 알림은 서버 함수가 만들고 본인만 볼 수 있습니다 (가짜 알림 불가). 점검: `supabase/tests/security_check_015.sql` (12/12).
- 되돌리기: SQL 편집기에서 `drop table public.notifications cascade;` 실행 후 007 파일의 meetup_decide 부분을 다시 실행.
- 폰이 잠겨 있거나 앱이 꺼져 있을 때 오는 **푸시 알림**은 아직 아닙니다 (앱을 열면 숫자가 보임). 푸시는 별도 서비스 설정이 필요합니다.
