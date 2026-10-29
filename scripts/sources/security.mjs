import { fetchText } from '../lib/http.mjs';
import { parseFeed } from '../lib/feed.mjs';
import { makeItem } from '../lib/util.mjs';

// AI 安全相关：模型/Agent 被滥用、提示注入、供应链投毒、越狱事件
const AI_SEC = /\b(ai|a\.i\.|llm|agent|chatgpt|claude|gemini|copilot|openai|anthropic|deepseek|qwen|model|prompt inject|jailbreak|llm|mcp|vibe cod|agentic)\b/i;

const FEEDS = [
  { id: 'thehackernews', label: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews' },
  { id: 'bleepingcomputer', label: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/' },
];

export const source = {
  id: 'security',
  label: 'AI 安全情报',
  kind: 'security',
  homepage: 'https://thehackernews.com/',
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
      for (const entry of r.parsed.items) {
        if (!AI_SEC.test(entry.title + ' ' + entry.summary)) continue;
        items.push(makeItem({
          kind: 'security',
          source: 'security',
          sourceLabel: r.feed.label,
          title: entry.title,
          url: entry.link,
          summary: entry.summary,
          publishedAt: entry.publishedAt,
          score: null,
          tags: ['安全', 'AI 滥用'],
          evidence: {
            url: r.feed.url,
            fetchedAt: r.fetchedAt,
            httpStatus: r.status,
            pointer: 'RSS item: ' + entry.title.slice(0, 60),
          },
        }));
      }
    }
    return { items: items.slice(0, 14), httpStatus, latencyMs, count: raw };
  },
};
