import { fetchText } from './http.mjs';
import { parseFeed } from './feed.mjs';
import { makeItem, trimText } from './util.mjs';

export function makeFeedSource(spec) {
  const limit = spec.limit || 20;
  return {
    id: spec.id,
    label: spec.label,
    kind: spec.kind || 'news',
    homepage: spec.homepage || spec.url,
    async run() {
      const res = await fetchText(spec.url, { headers: spec.headers || {}, timeoutMs: 30000 });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const parsed = parseFeed(res.text);
      const matcher = spec.match ? new RegExp(spec.match, 'i') : null;
      const picked = parsed.items
        .filter((entry) => !matcher || matcher.test(entry.title + ' ' + entry.summary))
        .slice(0, limit);
      const items = picked.map((entry) => makeItem({
        kind: spec.kind || 'news',
        source: spec.id,
        sourceLabel: spec.label,
        title: entry.title,
        url: entry.link,
        summary: entry.summary,
        publishedAt: entry.publishedAt,
        score: null,
        scoreLabel: spec.badge || '',
        tags: spec.tags || [],
        image: entry.image || '',
        imageSource: entry.image ? 'RSS 原文配图' : '',
        evidence: {
          url: spec.url,
          fetchedAt: res.fetchedAt,
          httpStatus: res.status,
          pointer: 'feed item: ' + trimText(entry.title, 80),
        },
      }));
      return { items, httpStatus: res.status, latencyMs: res.latencyMs, count: parsed.items.length };
    },
  };
}
