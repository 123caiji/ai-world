import { fetchJson } from '../lib/http.mjs';
import { makeItem, stripHtml, trimText } from '../lib/util.mjs';

// Mastodon 的公开话题时间线：不需要 token，实例只要没关公开时间线就能读。
// 这里挑的是 AI 研究者聚集的实例 + 几个大实例的 AI 相关标签。
const DEFAULT_FEEDS = [
  { instance: 'https://mastodon.social', tag: 'ai' },
  { instance: 'https://mastodon.social', tag: 'LLM' },
  { instance: 'https://mastodon.social', tag: 'MachineLearning' },
  { instance: 'https://sigmoid.social', tag: 'ai' },
  { instance: 'https://hachyderm.io', tag: 'ai' },
];
const LIMIT = 20;
const MIN_TEXT = 20;
// 话题时间线里混着大量“啥都转”的机器人账号：必须正文真的在聊 AI，且不是 bot，才收。
const AI_RE = /(\bai\b|a\.i\.|llm|gpt|claude|gemini|openai|anthropic|deepseek|qwen|kimi|agent|模型|智能体|大模型|机器学习|深度学习|对齐|神经网络|transformer)/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mediaOf(status) {
  const list = Array.isArray(status.media_attachments) ? status.media_attachments : [];
  for (const media of list) {
    if (media.type !== 'image' && media.type !== 'gifv') continue;
    const url = media.preview_url || media.url;
    if (url) return { url, source: 'Mastodon 帖子配图' };
  }
  return null;
}

function toItem(status, meta) {
  const text = stripHtml(status.content || '');
  const account = status.account || {};
  const acct = account.acct || 'unknown';
  const who = account.display_name ? '@' + acct + '（' + account.display_name + '）' : '@' + acct;
  const likes = Number(status.favourites_count || 0);
  const boosts = Number(status.reblogs_count || 0);
  const replies = Number(status.replies_count || 0);
  const image = mediaOf(status);
  return makeItem({
    kind: 'discussion',
    source: 'mastodon',
    sourceLabel: 'Mastodon（联邦宇宙）',
    title: trimText(text, 140) || who + ' 的嘟文',
    url: status.url || status.uri,
    summary: trimText(text, 240) + ' — ' + who + ' · ' + likes + ' 赞 · ' + boosts + ' 转发 · ' + replies + ' 回复',
    publishedAt: status.created_at || status.edited_at || null,
    score: likes + boosts * 2,
    scoreLabel: likes + ' 赞 · ' + boosts + ' 转发',
    tags: ['社交', '社区'],
    ...(image ? { image: image.url, imageSource: image.source } : {}),
    evidence: {
      url: meta.requestUrl,
      fetchedAt: meta.fetchedAt,
      httpStatus: meta.status,
      pointer: 'api/v1/timelines/tag/' + meta.tag + ' · status id=' + status.id,
    },
  });
}

export const source = {
  id: 'mastodon',
  label: 'Mastodon · AI 话题',
  kind: 'discussion',
  homepage: 'https://mastodon.social/explore',
  async run(ctx = {}) {
    const conf = (ctx.config && ctx.config.social && ctx.config.social.mastodon) || {};
    const feeds = Array.isArray(conf.feeds) && conf.feeds.length ? conf.feeds : DEFAULT_FEEDS;
    const items = [];
    const seen = new Set();
    const warnings = [];
    let httpStatus = 200;
    let latencyMs = 0;
    let raw = 0;
    let okCount = 0;

    for (const feed of feeds) {
      const requestUrl = feed.instance + '/api/v1/timelines/tag/' + encodeURIComponent(feed.tag) + '?limit=' + LIMIT;
      try {
        const { json, status, latencyMs: ms, fetchedAt } = await fetchJson(requestUrl, { timeoutMs: 20000, retries: 1 });
        httpStatus = status;
        latencyMs += ms;
        okCount += 1;
        for (const status_ of Array.isArray(json) ? json : []) {
          if (!status_ || !status_.uri || status_.reblog) continue; // 转嘟不重复收
          if (seen.has(status_.uri)) continue;
          const account = status_.account || {};
          if (account.bot === true) continue; // 机器人账号（大多是自动转发全网新闻）
          const text = stripHtml(status_.content || '');
          if (text.length < MIN_TEXT) continue;
          if (!AI_RE.test(text)) continue; // 话题标签被滥用的情况很多，正文必须提 AI
          const followers = Number((status_.account || {}).followers_count || 0);
          if (Number(status_.favourites_count || 0) + Number(status_.reblogs_count || 0) * 2 < 2 && followers < 1000) continue;
          seen.add(status_.uri);
          raw += 1;
          items.push(toItem(status_, { tag: feed.tag, requestUrl, fetchedAt, status }));
        }
      } catch (err) {
        warnings.push(feed.instance.replace('https://', '') + ' #' + feed.tag + ' 失败：' + String((err && err.message) || err).slice(0, 140));
      }
      await sleep(400);
    }

    if (!okCount) throw new Error('Mastodon 实例全部失败（本机被墙时属正常，Actions 里应可访问）：' + warnings.slice(0, 2).join(' | '));
    return { items, httpStatus, latencyMs, count: raw, warnings };
  },
};
