import { fetchText } from '../lib/http.mjs';
import { makeItem } from '../lib/util.mjs';

const URL = 'https://github.com/trending?since=daily';
const AI_RELEVANT = /\b(ai|llm|agent|agents|mcp|rag|gpt|nlp|transformer|diffusion|inference|embedding|deepseek|qwen|llama|claude|gemini|model|vision|speech|openai)\b/i;

function parseTrending(html) {
  const rows = [];
  const blocks = html.split('<article class="Box-row">').slice(1);
  for (const block of blocks) {
    const repoMatch = block.match(/<h2[^>]*>\s*<a[^>]*href="\/([^"]+)"/);
    if (!repoMatch) continue;
    const full = repoMatch[1].trim();
    const descMatch = block.match(/<p class="col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/);
    const desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
    const langMatch = block.match(/itemprop="programmingLanguage">([^<]+)</);
    const starsMatch = block.match(/href="\/[^"]+\/stargazers"[^>]*>([\s\S]*?)<\/a>/);
    const todayMatch = block.match(/([\d,]+)\s+stars\s+today/);
    const stars = starsMatch ? Number(starsMatch[1].replace(/[^\d]/g, '')) : 0;
    const today = todayMatch ? Number(todayMatch[1].replace(/,/g, '')) : 0;
    rows.push({ full, desc, lang: langMatch ? langMatch[1].trim() : '', stars, today });
  }
  return rows;
}

export const source = {
  id: 'github-trending',
  label: 'GitHub 每日趋势',
  kind: 'repo',
  homepage: 'https://github.com/trending',
  async run() {
    const res = await fetchText(URL, { headers: { Accept: 'text/html' }, timeoutMs: 30000 });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = parseTrending(res.text).filter((row) => AI_RELEVANT.test(row.full + ' ' + row.desc + ' ' + row.lang)).slice(0, 25);
    const items = rows.map((row) => makeItem({
      kind: 'repo',
      source: 'github-trending',
      sourceLabel: 'GitHub 每日趋势',
      title: row.full + (row.today ? ' · 今日 +' + row.today + ' ⭐' : ''),
      url: 'https://github.com/' + row.full,
      summary: (row.desc || '（无简介）') + (row.lang ? ' · ' + row.lang : '') + (row.stars ? ' · 共 ' + row.stars.toLocaleString('en-US') + ' stars' : ''),
      publishedAt: null,
      score: row.today || row.stars,
      scoreLabel: row.today ? '今日 +' + row.today : '',
      tags: ['开源', '趋势'],
      evidence: {
        url: URL,
        fetchedAt: res.fetchedAt,
        httpStatus: res.status,
        pointer: 'trending article: ' + row.full,
      },
    }));
    return { items, httpStatus: res.status, latencyMs: res.latencyMs, count: rows.length, raw: parseTrending(res.text).length };
  },
};
