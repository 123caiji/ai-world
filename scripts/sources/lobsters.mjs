import { fetchText } from '../lib/http.mjs';
import { parseFeed } from '../lib/feed.mjs';
import { makeItem } from '../lib/util.mjs';

const URL = 'https://lobste.rs/rss';
const RELEVANT = /\b(ai|llm|agent|mcp|rag|gpt|nlp|transformer|diffusion|inference|embedding|model|deepseek|qwen|llama|claude|gemini|openai|neural|machine learning|ml)\b/i;

export const source = {
  id: 'lobsters',
  label: 'Lobsters',
  kind: 'discussion',
  homepage: 'https://lobste.rs/',
  async run() {
    const res = await fetchText(URL, { timeoutMs: 25000 });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const parsed = parseFeed(res.text);
    const items = parsed.items
      .filter((entry) => RELEVANT.test(entry.title + ' ' + entry.summary))
      .slice(0, 12)
      .map((entry) => makeItem({
        kind: 'discussion',
        source: 'lobsters',
        sourceLabel: 'Lobsters',
        title: entry.title,
        url: entry.link,
        summary: entry.summary,
        publishedAt: entry.publishedAt,
        score: null,
        tags: ['技术社区'],
        evidence: {
          url: URL,
          fetchedAt: res.fetchedAt,
          httpStatus: res.status,
          pointer: 'RSS item: ' + entry.title.slice(0, 60),
        },
      }));
    return { items, httpStatus: res.status, latencyMs: res.latencyMs, count: parsed.items.length };
  },
};
