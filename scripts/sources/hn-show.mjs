import { fetchJson } from '../lib/http.mjs';
import { makeItem } from '../lib/util.mjs';

const URL = 'https://hn.algolia.com/api/v1/search?tags=show_hn&numericFilters=points>25&hitsPerPage=25';

export const source = {
  id: 'hn-show',
  label: 'Hacker News · Show HN',
  kind: 'product',
  homepage: 'https://news.ycombinator.com/show',
  async run() {
    const { json, status, latencyMs, fetchedAt } = await fetchJson(URL);
    const hits = (json && json.hits) || [];
    const items = hits
      .filter((hit) => hit.title && (hit.url || hit.objectID))
      .slice(0, 20)
      .map((hit) => makeItem({
        kind: 'product',
        source: 'hn-show',
        sourceLabel: 'Show HN',
        title: hit.title,
        url: hit.url || 'https://news.ycombinator.com/item?id=' + hit.objectID,
        summary: (hit.author ? '提交者 ' + hit.author + ' · ' : '') + (hit.num_comments || 0) + ' 条讨论 · ' + (hit.points || 0) + ' 分',
        publishedAt: hit.created_at,
        score: hit.points || null,
        scoreLabel: '▲ ' + (hit.points || 0),
        tags: ['Show HN', '作品'],
        discussionUrl: 'https://news.ycombinator.com/item?id=' + hit.objectID,
        evidence: {
          url: URL,
          fetchedAt,
          httpStatus: status,
          pointer: 'hits[] objectID=' + hit.objectID,
        },
      }));
    return { items, httpStatus: status, latencyMs, count: hits.length };
  },
};
