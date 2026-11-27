// utils.js | 작은 도구 모음

export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// LIKE 검색에서 %, _, \ 가 "특수문자"로 동작하지 않게 막음
export function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, '\\$&');
}

// ★ 저장 최적화 핵심: "바뀐 칸만" 골라냄.
//   예) 프로필에서 소개글만 고쳤다면 { bio: '...' } 한 칸만 서버로 보냅니다.
//   바뀐 게 없으면 {} 가 되고, 그러면 서버에 아무 요청도 보내지 않습니다.
export function diff(original, next) {
  const out = {};
  for (const key of Object.keys(next)) {
    if (!same(original?.[key], next[key])) out[key] = next[key];
  }
  return out;
}
function same(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  return (a ?? null) === (b ?? null);
}

export const isEmpty = (obj) => Object.keys(obj).length === 0;

// 사진 줄이기 + 개인정보(촬영 위치 GPS 등 EXIF) 제거 + 저장공간/데이터 절약
//   - 캔버스에 다시 그려서 새 파일로 만들기 때문에 원본의 EXIF(집 위치 등)는 사라집니다.
//   - WebP 로 저장 (같은 화질에서 JPEG 보다 25~35% 작음). WebP 를 못 만드는 구형 브라우저는 JPEG 로 대신합니다.
//   - 목표 용량(maxBytes)을 넘으면 화질 -> 크기 순서로 더 줄입니다.
async function decode(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('image_type');
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error('image_decode');
  }
}
function drawScaled(bitmap, maxDim) {
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';           // 투명 PNG 의 배경을 흰색으로
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas;
}
async function encode(canvas, quality) {
  let blob = await toBlob(canvas, 'image/webp', quality);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality);   // 구형 브라우저 대비
  if (!blob) throw new Error('image_decode');
  return blob;
}
async function shrink(bitmap, { maxDim, quality, maxBytes }) {
  let dim = maxDim;
  let canvas = drawScaled(bitmap, dim);
  let q = quality;
  let blob = await encode(canvas, q);
  for (let guard = 0; blob.size > maxBytes && guard < 8; guard += 1) {
    if (q > 0.5) q -= 0.1;                                  // 1) 화질을 조금씩 낮추고
    else { dim = Math.round(dim * 0.8); canvas = drawScaled(bitmap, dim); }   // 2) 그래도 크면 크기를 줄임
    blob = await encode(canvas, q);
  }
  return blob;
}
export const extOf = (blob) => (blob.type === 'image/webp' ? 'webp' : 'jpg');

// 프로필 사진 등 "한 장" 줄이기 (기본값: 긴 변 256px, 150KB 이하)
export async function compressImage(file, { maxDim = 256, quality = 0.8, maxBytes = 150 * 1024 } = {}) {
  const bitmap = await decode(file);
  try { return await shrink(bitmap, { maxDim, quality, maxBytes }); } finally { bitmap.close?.(); }
}

// 게시글 사진: 본 사진(긴 변 1280px, 약 600KB 이하) + 목록용 작은 사진(긴 변 480px, 약 60KB 이하)
export async function compressPostImage(file) {
  const bitmap = await decode(file);
  try {
    const main = await shrink(bitmap, { maxDim: 1280, quality: 0.78, maxBytes: 600 * 1024 });
    const thumb = await shrink(bitmap, { maxDim: 480, quality: 0.7, maxBytes: 60 * 1024 });
    return { main, thumb };
  } finally { bitmap.close?.(); }
}
function toBlob(canvas, type, q) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, q));
}

export const randomId = () => crypto.randomUUID().replace(/-/g, '');

// '#/something' 형태의 내부 주소만 허용 (다른 사이트로 보내는 주소 차단)
export function safeNext(value, fallback = '#/explore') {
  if (typeof value === 'string' && /^#\/[A-Za-z0-9_\-/?=&%.]*$/.test(value) && !value.includes('//')) return value;
  return fallback;
}
