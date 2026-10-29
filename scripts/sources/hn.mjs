import { fetchJson } from '../lib/http.mjs';
import { makeItem } from '../lib/util.mjs';

const QUERIES = ['AI', 'LLM', 'agent', 'openai', 'claude'];
const MIN_POINTS = 60;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const source = {
  id: 'hn',
  label: 'Hacker News · AI 热帖',
  kind: 'discussion',
  homepage: 'https://news.ycombinator.com/',
  async run() {
    const items = [];
    const seen = new Set();
    let httpStatus = 200;
    let latencyMs = 0;
    let rawCount = 0;
    for (const q of QUERIES) {
      const url = 'https://hn.algolia.com/api/v1/search?tags=story&query=' + encodeURIComponent(q) + '&numericFilters=points%3E' + MIN_POINTS + '&hitsPerPage=12';
      const { json, status, latencyMs: ms, fetchedAt } = await fetchJson(url);
      httpStatus = status;
      latencyMs += ms;
      for (const hit of json.hits || []) {
        if (!hit.objectID || seen.has(hit.objectID)) continue;
        seen.add(hit.objectID);
        rawCount += 1;
        const discussion = 'https://news.ycombinator.com/item?id=' + hit.objectID;
        items.push(makeItem({
          kind: 'discussion',
          source: 'hn',
          sourceLabel: 'Hacker News',
          title: hit.title,
          url: hit.url || discussion,
          summary: 'HN 热帖 · ' + (hit.points || 0) + ' 分 · ' + (hit.num_comments || 0) + ' 条评论 · 作者 ' + (hit.author || '未知'),
          publishedAt: hit.created_at,
          score: hit.points || 0,
          scoreLabel: 'HN ' + (hit.points || 0) + ' 分',
          evidence: {
            url,
            fetchedAt,
            httpStatus: status,
            pointer: 'algolia hit objectID=' + hit.objectID + ' · 讨论页 ' + discussion,
          },
        }));
      }
      await sleep(400);
    }
    return { items, httpStatus, latencyMs, count: rawCount };
  },
};
