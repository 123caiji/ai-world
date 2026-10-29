import { fetchText } from '../lib/http.mjs';
import { parseFeed } from '../lib/feed.mjs';
import { makeItem } from '../lib/util.mjs';

// 与 arxiv.mjs（cs.AI/cs.CL/cs.LG）互补的领域：视觉、机器人、软件工程、安全、统计学习
const CATEGORIES = ['cs.CV', 'cs.RO', 'cs.SE', 'cs.CR', 'stat.ML'];
const PER_CATEGORY = 4;

export const source = {
  id: 'arxiv-more',
  label: 'arXiv 相邻领域',
  kind: 'paper',
  homepage: 'https://arxiv.org/',
  async run() {
    const query = CATEGORIES.map((cat) => 'cat:' + cat).join('+OR+');
    const url = 'http://export.arxiv.org/api/query?search_query=' + query + '&sortBy=submittedDate&sortOrder=descending&max_results=' + (PER_CATEGORY * CATEGORIES.length);
    const res = await fetchText(url, { timeoutMs: 40000 });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const parsed = parseFeed(res.text);
    const seen = new Set();
    const items = [];
    for (const entry of parsed.items) {
      if (seen.has(entry.link)) continue;
      seen.add(entry.link);
      const idMatch = entry.link.match(/abs\/([^v]+)(v\d+)?$/);
      const catMatch = (entry.summary || '').match(/arXiv:[\d.]+v\d+\s+\[([^\]]+)\]/);
      items.push(makeItem({
        kind: 'paper',
        source: 'arxiv-more',
        sourceLabel: 'arXiv · ' + CATEGORIES.join('/'),
        title: entry.title,
        url: entry.link,
        summary: entry.summary,
        publishedAt: entry.publishedAt,
        score: null,
        tags: ['论文'].concat(catMatch ? [catMatch[1]] : []),
        evidence: {
          url,
          fetchedAt: res.fetchedAt,
          httpStatus: res.status,
          pointer: 'Atom entry id ' + (idMatch ? idMatch[1] : entry.link),
        },
      }));
    }
    return { items, httpStatus: res.status, latencyMs: res.latencyMs, count: parsed.items.length };
  },
};
