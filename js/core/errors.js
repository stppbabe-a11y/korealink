// errors.js | 서버 오류를 "사용자가 이해할 수 있는 문장"으로 바꿔 줌
//   (서버가 준 원문 오류는 화면에 그대로 보여주지 않고 콘솔에만 남깁니다.)
import { t } from './i18n.js';

export function friendlyError(err) {
  console.error('[app error]', err);
  const msg = String(err?.message ?? err ?? '');
  const code = String(err?.code ?? '');

  if (/rate_limit|over_email_send_rate_limit|email rate limit|too many requests/i.test(msg) || err?.status === 429) return t('err.rateLimit');
  if (/Invalid login credentials/i.test(msg)) return t('err.badLogin');
  if (/Email not confirmed/i.test(msg)) return t('err.emailNotConfirmed');
  if (/already registered|already been registered/i.test(msg)) return t('err.alreadyRegistered');
  if (/password/i.test(msg) && /(at least|weak|short|characters|pwned|easy to guess)/i.test(msg)) return t('err.weakPassword');
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) return t('err.network');
  if (/image_type/.test(msg)) return t('err.imageType');
  if (/image_decode/.test(msg)) return t('err.imageDecode');
  if (/provider is not enabled|Unsupported provider/i.test(msg)) return t('auth.googleNotReady');
  if (/not_enough_points/.test(msg)) return t('avatar.notEnough');
  if (/guest_not_allowed/.test(msg)) return t('points.guestNo');
  if (/room_closed/.test(msg)) return t('err.roomClosed');
  if (code === '23505' || /duplicate key/i.test(msg)) return t('err.duplicate');
  if (code === '42501' || /row-level security|permission denied|forbidden|not allowed/i.test(msg)) return t('err.forbidden');
  return t('err.generic');
}
