import { fetchText } from './http.mjs';

// 有些页面注定没有封面（论坛贴、论文摘要页、API 端点），直接跳过，别浪费请求
const SKIP_HOST = /^(news\.ycombinator\.com|arxiv\.org|export\.arxiv\.org|openrouter\.ai|hn\.algolia\.com|api\.github\.com|.*\.githubusercontent\.com)$/i;
// 只解析文章自己声明的封面/分享图：og:image、twitter:image、以及 Next.js 的 `_next/image?url=` 代理图
const META_PATTERNS = [
  /<meta\b[^>]*\bproperty=(["'])og:image(:secure_url)?\1[^>]*\bcontent=(["'])([^"']+)\3/i,
  /<meta\b[^>]*\bcontent=(["'])([^"']+)\1[^>]*\bproperty=(["'])og:image(:secure_url)?\6/i,
  /<meta\b[^>]*\bname=(["'])twitter:image(:src)?\1[^>]*\bcontent=(["'])([^"']+)\3/i,
];

// opengraph.githubassets.com 实测一律 429（被限流），拿到的地址在页面上是破图，直接不用
const SKIP_IMAGE = /(logo|favicon|avatar-placeholder|sprite|pixel|1x1|blank\.|spacer\.|\.svg$|opengraph\.githubassets\.com)/i;

/** 这条图地址能不能用（过滤已知死链/装饰图） */
export function isUsableImage(url) {
  const u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) return false;
  return !SKIP_IMAGE.test(u);
}

function absolutize(url, base) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https:\/\//i.test(raw)) return raw;
  if (/^\/\//.test(raw)) return 'https:' + raw;
  try {
    const u = new URL(raw, base);
    // Next.js 图片代理：/_next/image?url=<真实地址>&w=...
    if (u.pathname === '/_next/image' || u.pathname.endsWith('/_next/image')) {
      const inner = u.searchParams.get('url');
      if (inner) return absolutize(inner, base);
      return '';
    }
    return u.toString();
  } catch {
    return '';
  }
}

function pickMeta(html, base) {
  for (const pattern of META_PATTERNS) {
    const m = html.match(pattern);
    const raw = m ? (m[4] || m[2] || '') : '';
    if (!raw) continue;
    const url = absolutize(raw.replace(/&amp;/g, '&'), base);
    if (url && isUsableImage(url)) return url;
  }
  return '';
}

/**
 * 给一条没有图片的情报，去原文页面上找它自己声明的封面图（真实站点素材，不生成）。
 * 只在"条目本身没有图"时调用，带缓存、超时与并发限制，失败静默返回 ''。
 */
export async function fetchCoverImage(pageUrl, opts = {}) {
  const key = String(pageUrl || '');
  if (!key || !/^https?:\/\//i.test(key)) return '';
  const cache = opts.cache && typeof opts.cache === 'object' ? opts.cache : null;
  if (cache && Object.prototype.hasOwnProperty.call(cache, key)) return cache[key];
  let image = '';
  let host = '';
  try {
    host = new URL(key).hostname;
  } catch {
    return '';
  }
  if (SKIP_HOST.test(host)) {
    if (cache) cache[key] = '';
    return '';
  }
  try {
    const res = await fetchText(key, {
      headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': (opts.userAgent || 'Mozilla/5.0 (compatible; ai-world-radar/1.0)') },
      timeoutMs: opts.timeoutMs || 9000,
      retries: 0,
    });
    if (res.ok && /html/i.test(res.text.slice(0, 400))) {
      image = pickMeta(res.text, key);
    }
  } catch {
    image = '';
  }
  if (cache) cache[key] = image;
  return image;
}

export async function mapLimit(list, limit, worker) {
  const out = new Array(list.length);
  let cursor = 0;
  async function run() {
    while (cursor < list.length) {
      const index = cursor++;
      out[index] = await worker(list[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, list.length)) }, run));
  return out;
}
