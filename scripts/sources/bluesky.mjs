import { fetchJson } from '../lib/http.mjs';
import { makeItem, stripHtml, trimText } from '../lib/util.mjs';

// Bluesky（去中心化微博，AI 圈很多人从 X 搬了过去）的公开搜索接口，不需要任何密钥。
// 注意：searchPosts 只返回最近一段时间的帖子；按 likes 排序取“热度”，不是全量抓取。
const SEARCH = 'https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts';
const FEED = 'https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed';
const DEFAULT_QUERIES = ['AI agent', 'LLM', 'open source AI', 'AI safety'];
const DEFAULT_ACCOUNTS = [];
const LIMIT = 20;
const MIN_LIKES = 2;
const MIN_TEXT = 20;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function postUrl(uri, handle) {
  const rkey = String(uri || '').split('/').pop();
  return 'https://bsky.app/profile/' + handle + '/post/' + rkey;
}

function imageOf(post) {
  const embed = post.embed || {};
  const images = Array.isArray(embed.images) ? embed.images : [];
  for (const image of images) {
    const url = image.fullsize || image.thumb;
    if (url) return { url, source: 'Bluesky 帖子配图' };
  }
  if (embed.external && embed.external.thumb) return { url: embed.external.thumb, source: 'Bluesky 链接卡片' };
  return null;
}

function toItem(post, meta) {
  const record = post.record || {};
  const text = stripHtml(record.text || '');
  const author = post.author || {};
  const handle = author.handle || 'unknown';
  const who = author.displayName ? '@' + handle + '（' + author.displayName + '）' : '@' + handle;
  const likes = Number(post.likeCount || 0);
  const reposts = Number(post.repostCount || 0);
  const replies = Number(post.replyCount || 0);
  const url = postUrl(post.uri, handle);
  const image = imageOf(post);
  return makeItem({
    kind: 'discussion',
    source: 'bluesky',
    sourceLabel: 'Bluesky（推特类）',
    title: trimText(text, 140) || who + ' 的帖子',
    url,
    summary: trimText(text, 240) + ' — ' + who + ' · ' + likes + ' 赞 · ' + reposts + ' 转发 · ' + replies + ' 回复',
    publishedAt: record.createdAt || null,
    score: likes + reposts * 2,
    scoreLabel: likes + ' 赞 · ' + reposts + ' 转发',
    tags: ['社交', '推特类'],
    ...(image ? { image: image.url, imageSource: image.source } : {}),
    evidence: {
      url: meta.requestUrl,
      fetchedAt: meta.fetchedAt,
      httpStatus: meta.status,
      pointer: 'app.bsky.feed.' + meta.via + ' · uri=' + post.uri,
    },
  });
}

export const source = {
  id: 'bluesky',
  label: 'Bluesky · AI 讨论',
  kind: 'discussion',
  homepage: 'https://bsky.app/',
  async run(ctx = {}) {
    const conf = (ctx.config && ctx.config.social && ctx.config.social.bluesky) || {};
    const queries = Array.isArray(conf.queries) && conf.queries.length ? conf.queries : DEFAULT_QUERIES;
    const accounts = Array.isArray(conf.accounts) ? conf.accounts : DEFAULT_ACCOUNTS;
    const items = [];
    const seen = new Set();
    const warnings = [];
    let httpStatus = 200;
    let latencyMs = 0;
    let raw = 0;
    let okCount = 0;

    const accept = (post, meta) => {
      if (!post || !post.uri || seen.has(post.uri)) return;
      const text = stripHtml((post.record || {}).text || '');
      if (text.length < MIN_TEXT) return;
      if (Number(post.likeCount || 0) < MIN_LIKES) return;
      seen.add(post.uri);
      raw += 1;
      items.push(toItem(post, meta));
    };

    for (const q of queries) {
      const url = SEARCH + '?q=' + encodeURIComponent(q) + '&limit=' + LIMIT + '&sort=top';
      try {
        const { json, status, latencyMs: ms, fetchedAt } = await fetchJson(url, { timeoutMs: 20000, retries: 1 });
        httpStatus = status;
        latencyMs += ms;
        okCount += 1;
        for (const post of json.posts || []) accept(post, { via: 'searchPosts', requestUrl: url, fetchedAt, status });
      } catch (err) {
        warnings.push('搜索「' + q + '」失败：' + String((err && err.message) || err).slice(0, 140));
      }
      await sleep(400);
    }

    for (const actor of accounts) {
      const url = FEED + '?actor=' + encodeURIComponent(actor) + '&limit=20&filter=posts_no_replies';
      try {
        const { json, status, latencyMs: ms, fetchedAt } = await fetchJson(url, { timeoutMs: 20000, retries: 1 });
        latencyMs += ms;
        okCount += 1;
        for (const row of json.feed || []) accept(row.post, { via: 'getAuthorFeed', requestUrl: url, fetchedAt, status });
      } catch (err) {
        warnings.push('账号 ' + actor + ' 拉取失败：' + String((err && err.message) || err).slice(0, 140));
      }
      await sleep(400);
    }

    if (!okCount) throw new Error('Bluesky 接口全部失败（本机被墙时属正常，Actions 里应可访问）：' + warnings.slice(0, 2).join(' | '));
    return { items, httpStatus, latencyMs, count: raw, warnings };
  },
};
