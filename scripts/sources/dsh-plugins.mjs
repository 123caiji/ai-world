import { fetchJson } from '../lib/http.mjs';
import { makeItem } from '../lib/util.mjs';

const URL = 'https://awesome-dsh-plugin.com/index.json';

export const source = {
  id: 'dsh-plugins',
  label: 'DSH 插件索引',
  kind: 'plugin',
  homepage: 'https://awesome-dsh-plugin.com/',
  async run(ctx) {
    const { json, status, latencyMs, fetchedAt } = await fetchJson(URL, { timeoutMs: 35000 });
    const plugins = json.plugins || [];
    const prev = new Set(ctx.state.plugins || []);
    const isFirstRun = prev.size === 0;
    const names = [];
    const categories = new Map();
    const fresh = [];
    const items = [];
    for (const plugin of plugins) {
      names.push(plugin.name);
      const category = (plugin.metadata && plugin.metadata.category) || 'other';
      categories.set(category, (categories.get(category) || 0) + 1);
      const versions = Array.isArray(plugin.versions) ? plugin.versions : [];
      const latest = versions[0] || {};
      const row = {
        name: plugin.name,
        title: plugin.title || plugin.name,
        url: plugin.homepage,
        repo: plugin.repository && plugin.repository.url ? plugin.repository.url : '',
        category,
        description: (plugin.description && (plugin.description.zh || plugin.description.en)) || '',
        version: latest.version || '',
        publishedAt: latest.publishTimestamp ? new Date(latest.publishTimestamp * 1000).toISOString() : null,
      };
      fresh.push(row);
      if (!isFirstRun && !prev.has(plugin.name)) {
        items.push(makeItem({
          kind: 'plugin',
          source: 'dsh-plugins',
          sourceLabel: 'DSH 新插件',
          title: row.title,
          url: row.url,
          summary: (row.description || '（无简介）').slice(0, 260),
          publishedAt: row.publishedAt,
          score: null,
          scoreLabel: 'v' + (row.version || '?') + ' · ' + category,
          tags: ['插件', category],
          evidence: {
            url: URL,
            fetchedAt,
            httpStatus: status,
            pointer: 'plugins[] name=' + plugin.name,
          },
        }));
      }
    }
    ctx.draft.plugins = names;
    const recent = fresh
      .filter((row) => row.publishedAt)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 40);
    ctx.draft.dsh = {
      generatedAt: new Date().toISOString(),
      total: plugins.length,
      newCount: items.length,
      firstRun: isFirstRun,
      categories: [...categories.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([name, count]) => ({ name, count })),
      recent,
    };
    return { items: items.slice(0, 40), httpStatus: status, latencyMs, count: plugins.length };
  },
};
