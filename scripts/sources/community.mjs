import { fetchText } from '../lib/http.mjs';
import { parseFeed } from '../lib/feed.mjs';
import { makeItem } from '../lib/util.mjs';

const AI_MATCH = /\b(ai|llm|agent|mcp|rag|gpt|nlp|transformer|diffusion|inference|model|deepseek|qwen|llama|claude|gemini|openai|大模型|人工智能|智能体|提示词)\b/i;

const FEEDS = [
  { id: 'v2ex', label: 'V2EX · AI 讨论', url: 'https://www.v2ex.com/index.xml', limit: 6 },
  { id: 'juejin', label: '掘金', url: 'https://juejin.cn/rss', limit: 8 },
  { id: 'oschina', label: 'OSCHINA 资讯', url: 'https://www.oschina.net/news/rss', limit: 8 },
  { id: 'infoq-cn', label: 'InfoQ 中文', url: 'https://www.infoq.cn/feed', limit: 8 },
];

export const source = {
  id: 'community',
  label: '中文技术社区',
  kind: 'discussion',
  homepage: 'https://www.v2ex.com/',
  async run() {
    const items = [];
    let httpStatus = 200;
    let latencyMs = 0;
    let raw = 0;
    const results = await Promise.all(FEEDS.map(async (feed) => {
      try {
        const res = await fetchText(feed.url, { timeoutMs: 25000 });
        latencyMs += res.latencyMs;
        if (!res.ok) return { feed, ok: false, status: res.status };
        return { feed, ok: true, status: res.status, fetchedAt: res.fetchedAt, parsed: parseFeed(res.text) };
      } catch (err) {
        return { feed, ok: false, status: null, error: String(err.message || err) };
      }
    }));
    for (const r of results) {
      if (r.status) httpStatus = r.status;
      if (!r.ok) continue;
      raw += r.parsed.items.length;
      const picked = r.parsed.items.filter((entry) => AI_MATCH.test(entry.title + ' ' + entry.summary)).slice(0, r.feed.limit);
      for (const entry of picked) {
        items.push(makeItem({
          kind: 'discussion',
          source: 'community',
          sourceLabel: r.feed.label,
          title: entry.title,
          url: entry.link,
          summary: entry.summary,
          publishedAt: entry.publishedAt,
          score: null,
          tags: ['中文', '社区'],
          evidence: {
            url: r.feed.url,
            fetchedAt: r.fetchedAt,
            httpStatus: r.status,
            pointer: r.feed.id + ' RSS item: ' + entry.title.slice(0, 50),
          },
        }));
      }
    }
    return { items, httpStatus, latencyMs, count: raw };
  },
};
