import { createHash } from 'node:crypto';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: String.fromCharCode(34), apos: String.fromCharCode(39), nbsp: ' ', hellip: '...', mdash: ' - ', ndash: ' - ', rsquo: String.fromCharCode(39), lsquo: String.fromCharCode(39), ldquo: String.fromCharCode(34), rdquo: String.fromCharCode(34), middot: ' / ', copy: '(c)', reg: '(R)' };

export function decodeEntities(input) {
  return String(input || '')
    .replace(/&#x([0-9a-f]+);/gi, (m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => {
      const hit = ENTITIES[name.toLowerCase()];
      return hit === undefined ? m : hit;
    });
}

export function stripHtml(html) {
  const decoded = decodeEntities(String(html || ''));
  const stripped = decoded
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(stripped).replace(/\s+/g, ' ').trim();
}

export function trimText(text, max) {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1).replace(/\s+\S*$/, '') + '...';
}

export function sha1(input) {
  return createHash('sha1').update(String(input)).digest('hex');
}

const TRACKING = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'ref_src', 'spm', 'from']);

export function canonicalUrl(raw) {
  try {
    const u = new URL(String(raw));
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING.has(key.toLowerCase())) u.searchParams.delete(key);
    }
    let out = u.toString();
    if (out.endsWith('/') && u.pathname !== '/') out = out.slice(0, -1);
    return out;
  } catch {
    return String(raw);
  }
}

export function toIso(value) {
  if (!value) return null;
  const d = new Date(String(value).trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function relTime(iso, nowMs) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Math.max(0, (nowMs || Date.now()) - t);
  const min = Math.round(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return min + ' 分钟前';
  const hours = Math.round(min / 60);
  if (hours < 24) return hours + ' 小时前';
  const days = Math.round(hours / 24);
  return days + ' 天前';
}

const TAGS = [
  ['论文', ['论文', 'paper', 'arxiv', 'benchmark', 'dataset', '研究', '预印本']],
  ['模型', ['model', '模型', 'gpt', 'claude', 'gemini', 'llama', 'qwen', 'deepseek', 'mistral', 'kimi', 'glm', 'opus', 'sonnet']],
  ['智能体', ['agent', '智能体', 'mcp', 'tool use', 'workflow', 'harness', 'agentic']],
  ['开源', ['open source', '开源', 'github', 'release', 'repo', '权重', 'weights']],
  ['推理', ['inference', '推理', 'vllm', 'sglang', 'quant', '量化', 'cuda', 'gpu', 'kernel']],
  ['多模态', ['multimodal', 'vision', 'image', 'video', '语音', 'voice', 'audio', 'speech', '图像']],
  ['安全', ['security', '安全', 'jailbreak', 'attack', '红队', 'vulnerab', 'prompt injection', '越狱']],
  ['产品', ['launch', '发布', 'product', 'app', 'startup', '融资', 'producthunt']],
];

export function inferTags(text) {
  const hay = String(text || '').toLowerCase();
  const out = [];
  for (const [tag, words] of TAGS) {
    if (words.some((w) => hay.includes(w))) out.push(tag);
  }
  return out.slice(0, 4);
}

export function makeItem(fields) {
  const url = canonicalUrl(fields.url);
  const title = trimText(fields.title || '(无标题)', 220);
  const summary = trimText(fields.summary || '', 420);
  return {
    id: fields.id || sha1(url),
    kind: fields.kind || 'news',
    source: fields.source || 'unknown',
    sourceLabel: fields.sourceLabel || fields.source || 'unknown',
    title,
    url,
    summary,
    lang: fields.lang || (/[\u4e00-\u9fa5]/.test(title) ? 'zh' : 'en'),
    publishedAt: fields.publishedAt || null,
    firstSeenAt: fields.firstSeenAt || new Date().toISOString(),
    score: Number.isFinite(fields.score) ? fields.score : null,
    scoreLabel: fields.scoreLabel || '',
    tags: [...new Set([...(fields.tags || []), ...inferTags(title + ' ' + summary)])].slice(0, 5),
    evidence: fields.evidence || { url: fields.url, fetchedAt: new Date().toISOString(), httpStatus: null, pointer: '' },
  };
}
