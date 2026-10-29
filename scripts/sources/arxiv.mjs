import { fetchText } from '../lib/http.mjs';
import { parseFeed } from '../lib/feed.mjs';
import { makeItem } from '../lib/util.mjs';

const CATEGORIES = ['cs.AI', 'cs.CL', 'cs.LG'];
const PER_CATEGORY = 12;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const source = {
  id: 'arxiv',
  label: 'arXiv 最新预印本',
  kind: 'paper',
  homepage: 'https://arxiv.org/list/cs.AI/recent',
  async run() {
    const items = [];
    const seen = new Set();
    let httpStatus = 200;
    let latencyMs = 0;
    let rawCount = 0;
    for (const cat of CATEGORIES) {
      const url = 'http://export.arxiv.org/api/query?search_query=cat:' + cat + '&sortBy=submittedDate&sortOrder=descending&max_results=' + PER_CATEGORY;
      const res = await fetchText(url, { timeoutMs: 30000 });
      httpStatus = res.status;
      latencyMs += res.latencyMs;
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + cat);
      const parsed = parseFeed(res.text);
      rawCount += parsed.items.length;
      for (const entry of parsed.items) {
        if (seen.has(entry.link)) continue;
        seen.add(entry.link);
        const idMatch = entry.link.match(/abs\/([^v]+)(v\d+)?$/);
        items.push(makeItem({
          kind: 'paper',
          source: 'arxiv',
          sourceLabel: 'arXiv · ' + cat,
          title: entry.title,
          url: entry.link,
          summary: entry.summary,
          publishedAt: entry.publishedAt,
          score: null,
          evidence: {
            url,
            fetchedAt: res.fetchedAt,
            httpStatus: res.status,
            pointer: 'Atom entry id ' + (idMatch ? idMatch[1] : entry.link),
          },
        }));
      }
      await sleep(3200);
    }
    return { items, httpStatus, latencyMs, count: rawCount };
  },
};
