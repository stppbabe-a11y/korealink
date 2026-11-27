-- =====================================================================
-- 004_seed.sql  |  처음 열어 둘 채팅방 3개
-- (앱에서 방 이름은 언어별로 번역되어 보입니다. 관리자 화면에서 방을 더 만들 수 있어요.)
-- =====================================================================
insert into public.chat_rooms (slug, name, description) values
  ('general', 'General Lounge',        'Say hi and chat with travelers in Busan.'),
  ('tips',    'Busan Tips & Q&A',      'Ask about transport, food, hidden spots and more.'),
  ('meetups', 'Meetups & Companions',  'Find someone to explore Busan with today.')
on conflict (slug) do nothing;
