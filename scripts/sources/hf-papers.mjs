import { fetchJson } from '../lib/http.mjs';
import { makeItem, trimText } from '../lib/util.mjs';

const URL = 'https://huggingface.co/api/daily_papers';

export const source = {
  id: 'hf-papers',
  label: 'Hugging Face 每日论文',
  kind: 'paper',
  homepage: 'https://huggingface.co/papers',
  async run() {
    const { json, status, latencyMs, fetchedAt } = await fetchJson(URL);
    const items = (json || []).slice(0, 40).map((entry) => {
      const pid = (entry.paper && entry.paper.id) || '';
      const upvotes = entry.paper && entry.paper.upvotes ? entry.paper.upvotes : null;
      return makeItem({
        kind: 'paper',
        source: 'hf-papers',
        sourceLabel: 'Hugging Face 每日论文',
        title: entry.title,
        url: 'https://huggingface.co/papers/' + pid,
        summary: entry.summary,
        publishedAt: entry.publishedAt,
        score: typeof upvotes === 'number' ? upvotes : (entry.numComments || null),
        scoreLabel: typeof upvotes === 'number' ? 'HF 赞 ' + upvotes : '',
        tags: ['论文'].concat(entry.organization && entry.organization.name ? ['机构:' + entry.organization.name] : []),
        evidence: {
          url: URL,
          fetchedAt,
          httpStatus: status,
          pointer: 'daily_papers item paper.id=' + pid,
        },
      });
    });
    return { items, httpStatus: status, latencyMs, count: items.length };
  },
};
