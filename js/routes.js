// routes.js | 주소(#/...)와 화면 파일을 연결하는 "목차"
//
// 새 화면을 추가하려면 여기에 한 줄을 추가하세요.
//   access:  'public' 누구나 / 'user' 로그인 필요 / 'guest' 로그아웃 상태만 / 'admin' 관리자만
//   load:    그 화면의 코드를 "필요할 때만" 불러옴 (처음 로딩이 빨라지고, 관리자 코드는 관리자만 받음)
//   fn:      그 파일 안에서 화면을 그리는 함수 이름
//
// ※ 'admin' 은 화면을 보여줄지 말지만 정합니다. 진짜 잠금은 서버(DB)가 합니다.
export const ROUTES = [
  { path: '/', redirect: '#/home' },
  { path: '/home', access: 'public', nav: 'home', load: () => import('./features/home/home.view.js'), fn: 'homeView' },
  { path: '/about', access: 'public', nav: 'home', load: () => import('./features/about/about.view.js'), fn: 'aboutView' },
  { path: '/guidelines', access: 'public', nav: 'home', load: () => import('./features/about/about.view.js'), fn: 'guidelinesView' },
  { path: '/explore', access: 'public', nav: 'explore', load: () => import('./features/posts/posts.view.js'), fn: 'postListView' },
  { path: '/events', access: 'public', nav: 'events', load: () => import('./features/events/events.view.js'), fn: 'eventsView' },
  { path: '/meetups', access: 'public', nav: 'meetups', load: () => import('./features/meetups/meetups.view.js'), fn: 'meetupsView' },
  { path: '/meetups/new', access: 'user', nav: 'meetups', load: () => import('./features/meetups/meetupForm.view.js'), fn: 'newMeetupView' },
  { path: '/meetups/:id/edit', access: 'user', nav: 'meetups', load: () => import('./features/meetups/meetupForm.view.js'), fn: 'editMeetupView' },
  { path: '/meetups/:id', access: 'public', nav: 'meetups', load: () => import('./features/meetups/meetupDetail.view.js'), fn: 'meetupDetailView' },
  { path: '/map', access: 'public', nav: 'map', load: () => import('./features/map/mapExplore.view.js'), fn: 'mapExploreView' },
  { path: '/posts/new', access: 'user', nav: 'explore', load: () => import('./features/posts/postForm.view.js'), fn: 'newPostView' },
  { path: '/posts/:id/edit', access: 'user', nav: 'explore', load: () => import('./features/posts/postForm.view.js'), fn: 'editPostView' },
  { path: '/posts/:id', access: 'public', nav: 'explore', load: () => import('./features/posts/postDetail.view.js'), fn: 'postDetailView' },
  { path: '/chat', access: 'public', nav: 'chat', load: () => import('./features/chat/chat.view.js'), fn: 'roomListView' },
  { path: '/chat/:slug', access: 'public', nav: 'chat', load: () => import('./features/chat/chat.view.js'), fn: 'roomView' },
  { path: '/profile', access: 'user', nav: 'profile', load: () => import('./features/profile/profile.view.js'), fn: 'myProfileView' },
  { path: '/u/:username', access: 'public', nav: 'profile', load: () => import('./features/profile/profile.view.js'), fn: 'userProfileView' },
  { path: '/login', access: 'guest', nav: 'profile', load: () => import('./features/auth/auth.view.js'), fn: 'loginView' },
  { path: '/signup', redirect: '#/login' },     // 이메일 가입/비밀번호 기능은 없음 (구글·카카오만)
  { path: '/forgot', redirect: '#/login' },
  { path: '/reset-password', redirect: '#/login' },
  { path: '/admin', access: 'admin', nav: 'admin', load: () => import('./features/admin/admin.view.js'), fn: 'adminView' },
];
