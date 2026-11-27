-- =====================================================================
-- 014_block_email_signup.sql | "이메일로 새로 가입"을 서버(DB)에서 막습니다. (구글 로그인 가입 / 게스트 채팅 / 기존 회원 로그인은 그대로)
--   앱 화면에서 가입 버튼을 없애는 것만으로는 부족해서(기술을 아는 사람이 직접 요청을 보낼 수 있음) 서버에서도 막습니다.
--   다시 이메일 가입을 열려면 맨 아래 "되돌리기" 한 줄을 실행하세요.
-- 여러 번 실행해도 안전합니다.
-- =====================================================================
create or replace function public.block_email_signup()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(new.is_anonymous, false) = false
     and coalesce(new.raw_app_meta_data ->> 'provider', '') = 'email' then
    raise exception 'email_signup_closed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists block_email_signup on auth.users;
create trigger block_email_signup before insert on auth.users
  for each row execute function public.block_email_signup();

-- 되돌리기(이메일 가입 다시 열기):  drop trigger if exists block_email_signup on auth.users;
