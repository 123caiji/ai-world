import { fetchText } from '../lib/http.mjs';
import { decodeEntities, makeItem, stripHtml, toIso } from '../lib/util.mjs';

const URL = 'https://www.anthropic.com/news';

function parseNews(html) {
  const rows = [];
  const blocks = html.split('data-listing-row=').slice(1);
  for (const block of blocks) {
    const href = (block.match(/class="[^"]*title-link[^"]*"\s+href="(\/news\/[^"]+)"/) || block.match(/href="(\/news\/[a-z0-9-]+)"/) || [])[1];
    if (!href) continue;
    const title = stripHtml(decodeEntities((block.match(/<h3[^>]*>([\s\S]{0,220}?)<\/h3>/) || [])[1] || ''));
    if (!title) continue;
    const desc = stripHtml(decodeEntities((block.match(/description[\s\S]{0,600}?<p>([\s\S]{0,600}?)<\/p>/) || [])[1] || ''));
    const dateRaw = (block.match(/<div>((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4})<\/div>/) || [])[1] || '';
    rows.push({ href, title, desc, publishedAt: toIso(dateRaw) });
  }
  return rows;
}

export const source = {
  id: 'anthropic',
  label: 'Anthropic 官方新闻',
  kind: 'news',
  homepage: 'https://www.anthropic.com/news',
  async run() {
    const res = await fetchText(URL, { headers: { Accept: 'text/html' }, timeoutMs: 30000 });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = parseNews(res.text);
    const seen = new Set();
    const items = [];
    for (const row of rows) {
      if (seen.has(row.href)) continue;
      seen.add(row.href);
      items.push(makeItem({
        kind: 'news',
        source: 'anthropic',
        sourceLabel: 'Anthropic 官方',
        title: row.title,
        url: 'https://www.anthropic.com' + row.href,
        summary: row.desc,
        publishedAt: row.publishedAt,
        score: null,
        tags: ['官方', 'Anthropic'],
        evidence: {
          url: URL,
          fetchedAt: res.fetchedAt,
          httpStatus: res.status,
          pointer: 'news listing row href=' + row.href,
        },
      }));
      if (items.length >= 12) break;
    }
    return { items, httpStatus: res.status, latencyMs: res.latencyMs, count: rows.length };
  },
};
