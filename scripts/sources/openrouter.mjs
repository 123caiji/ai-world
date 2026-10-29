import { fetchJson } from '../lib/http.mjs';
import { makeItem } from '../lib/util.mjs';

const URL = 'https://openrouter.ai/api/v1/models';
const NEW_WINDOW_DAYS = 21;

function pricePerMillion(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 1000000 * 100) / 100;
}

export const source = {
  id: 'openrouter',
  label: 'OpenRouter 模型目录',
  kind: 'model',
  homepage: 'https://openrouter.ai/models',
  async run(ctx) {
    const { json, status, latencyMs, fetchedAt } = await fetchJson(URL);
    const list = json.data || [];
    const prev = ctx.state.models || {};
    const now = Date.now();
    const next = {};
    const fresh = [];
    for (const model of list) {
      const created = Number(model.created) * 1000;
      next[model.id] = { created: model.created, name: model.name };
      const isNew = !prev[model.id] && now - created < NEW_WINDOW_DAYS * 86400000;
      if (!isNew) continue;
      const prompt = pricePerMillion(model.pricing && model.pricing.prompt);
      const completion = pricePerMillion(model.pricing && model.pricing.completion);
      fresh.push(makeItem({
        kind: 'model',
        source: 'openrouter',
        sourceLabel: 'OpenRouter 新模型',
        title: model.name || model.id,
        url: 'https://openrouter.ai/' + model.id,
        summary: '上下文 ' + (model.context_length || 0).toLocaleString('en-US') + ' tokens' + (prompt !== null ? ' · 输入 $' + prompt + '/M · 输出 $' + (completion === null ? '?' : completion) + '/M' : '') + (model.description ? ' · ' + String(model.description).slice(0, 160) : ''),
        publishedAt: new Date(created).toISOString(),
        score: null,
        scoreLabel: '新上架',
        tags: ['模型', '新上架'],
        evidence: {
          url: URL,
          fetchedAt,
          httpStatus: status,
          pointer: 'models[] id=' + model.id + ' created=' + model.created,
        },
      }));
    }
    ctx.draft.models = next;
    return { items: fresh.slice(0, 30), httpStatus: status, latencyMs, count: list.length };
  },
};
