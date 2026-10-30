import { fetchJson, fetchJsonPost } from '../lib/http.mjs';
import { makeItem, stripHtml, trimText } from '../lib/util.mjs';

// Reddit 的公开 JSON 接口（不需要 OAuth，但要用浏览器 UA，否则会被 403）。
const DEFAULT_SUBS = ['MachineLearning', 'LocalLLaMA', 'artificial', 'OpenAI'];
const LIMIT = 25;
const MIN_SCORE = 40;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function imageOf(post) {
  const preview = post.preview && Array.isArray(post.preview.images) ? post.preview.images[0] : null;
  if (preview && preview.source && preview.source.url) {
    return { url: String(preview.source.url).replace(/&amp;/g, '&'), source: 'Reddit 帖子配图' };
  }
  const thumb = String(post.thumbnail || '');
  if (/^https?:\/\//i.test(thumb)) return { url: thumb, source: 'Reddit 缩略图' };
  return null;
}

function toItem(post, meta) {
  const title = stripHtml(post.title || '');
  const selfText = stripHtml(post.selftext || '');
  const discussion = 'https://www.reddit.com' + (post.permalink || '');
  const subreddit = post.subreddit_name_prefixed || ('r/' + (post.subreddit || ''));
  const summaryHead = selfText ? trimText(selfText, 180) : trimText(post.url_overridden_by_dest || post.url || '', 180);
  const image = imageOf(post);
  return makeItem({
    kind: 'discussion',
    source: 'reddit',
    sourceLabel: 'Reddit · ' + subreddit,
    title,
    url: discussion,
    summary: summaryHead + ' — ' + subreddit + ' · ' + (post.score || 0) + ' 赞 / 赞踩比 ' + Math.round((post.upvote_ratio || 0) * 100) + '% · ' + (post.num_comments || 0) + ' 条评论' + (post.link_flair_text ? ' · ' + post.link_flair_text : ''),
    publishedAt: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : null,
    score: Number(post.score || 0),
    scoreLabel: 'Reddit ' + (post.score || 0) + ' 赞',
    tags: ['社交', '社区'],
    discussionUrl: discussion,
    ...(image ? { image: image.url, imageSource: image.source } : {}),
    evidence: {
      url: meta.requestUrl,
      fetchedAt: meta.fetchedAt,
      httpStatus: meta.status,
      pointer: 'r/' + post.subreddit + '/hot.json · id=' + post.id + ' · 讨论页 ' + discussion,
    },
  });
}

export const source = {
  id: 'reddit',
  label: 'Reddit · AI 版块',
  kind: 'discussion',
  homepage: 'https://www.reddit.com/r/MachineLearning/',
  async run(ctx = {}) {
    // Reddit 会挡数据中心 IP（GitHub Actions 的出口一律 403），所以凭据同样是可选开关：
    // Secrets 配 REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET（script 类型 app）就走 OAuth。
    const clientId = String(process.env.REDDIT_CLIENT_ID || '').trim();
    const clientSecret = String(process.env.REDDIT_CLIENT_SECRET || '').trim();
    if (!clientId || !clientSecret) {
      return {
        items: [], count: 0, httpStatus: null, latencyMs: 0, skipped: true,
        reason: '未启用：需要在仓库 Secrets 里配置 REDDIT_CLIENT_ID 与 REDDIT_CLIENT_SECRET',
      };
    }
    let access = '';
    try {
      const basic = Buffer.from(clientId + ':' + clientSecret).toString('base64');
      const tok = await fetchJsonPost('https://www.reddit.com/api/v1/access_token', 'grant_type=client_credentials', {
        contentType: 'application/x-www-form-urlencoded',
        headers: { authorization: 'Basic ' + basic, 'user-agent': UA },
        timeoutMs: 20000, retries: 1,
      });
      access = tok.json.access_token || '';
      if (!access) throw new Error('access_token 为空');
    } catch (err) {
      throw new Error('Reddit 取 token 失败（检查 REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET）：' + String((err && err.message) || err).slice(0, 160));
    }

    const conf = (ctx.config && ctx.config.social && ctx.config.social.reddit) || {};
    const subs = Array.isArray(conf.subs) && conf.subs.length ? conf.subs : DEFAULT_SUBS;
    const items = [];
    const seen = new Set();
    const warnings = [];
    let httpStatus = 200;
    let latencyMs = 0;
    let raw = 0;
    let okCount = 0;

    for (const sub of subs) {
      const requestUrl = 'https://oauth.reddit.com/r/' + encodeURIComponent(sub) + '/hot?limit=' + LIMIT + '&raw_json=1';
      try {
        const { json, status, latencyMs: ms, fetchedAt } = await fetchJson(requestUrl, { timeoutMs: 20000, retries: 1, headers: { 'user-agent': UA, authorization: 'Bearer ' + access } });
        httpStatus = status;
        latencyMs += ms;
        okCount += 1;
        const children = ((json.data || {}).children) || [];
        for (const row of children) {
          const post = row && row.data;
          if (!post || !post.id || post.stickied || post.over_18) continue;
          if (seen.has(post.id)) continue;
          if (Number(post.score || 0) < MIN_SCORE) continue;
          if (!post.title) continue;
          seen.add(post.id);
          raw += 1;
          items.push(toItem(post, { requestUrl, fetchedAt, status }));
        }
      } catch (err) {
        warnings.push('r/' + sub + ' 失败：' + String((err && err.message) || err).slice(0, 140));
      }
      await sleep(400);
    }

    if (!okCount) throw new Error('Reddit 全部失败（凭据失效或被限流）：' + warnings.slice(0, 2).join(' | '));
    return { items, httpStatus, latencyMs, count: raw, warnings };
  },
};
