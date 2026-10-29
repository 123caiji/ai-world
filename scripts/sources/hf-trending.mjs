import { fetchJson } from '../lib/http.mjs';
import { makeItem } from '../lib/util.mjs';

const MODELS = 'https://huggingface.co/api/models?sort=trendingScore&limit=25&direction=-1';
const DATASETS = 'https://huggingface.co/api/datasets?sort=trendingScore&limit=15&direction=-1';
const SPACES = 'https://huggingface.co/api/spaces?sort=trendingScore&limit=15&direction=-1';

function fmt(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
  return String(v);
}

async function load(url, kindLabel) {
  const { json, status, latencyMs, fetchedAt } = await fetchJson(url);
  return { rows: Array.isArray(json) ? json : [], status, latencyMs, fetchedAt };
}

export const source = {
  id: 'hf-trending',
  label: 'Hugging Face 热门模型 / 数据集 / Space',
  kind: 'model',
  homepage: 'https://huggingface.co/models',
  async run() {
    const started = Date.now();
    const [models, datasets, spaces] = await Promise.all([
      load(MODELS, 'model'),
      load(DATASETS, 'dataset'),
      load(SPACES, 'space'),
    ]);
    const items = [];
    const KIND_OF = { model: 'model', dataset: 'dataset', space: 'space' };
    const push = (row, kind, label, url) => {
      const likes = row.likes || 0;
      const dl = row.downloads || 0;
      items.push(makeItem({
        kind: KIND_OF[kind] || 'model',
        source: 'hf-trending',
        sourceLabel: label,
        title: row.id,
        url,
        summary: [
          '下载 ' + fmt(dl),
          '赞 ' + fmt(likes),
          '趋势 ' + fmt(row.trendingScore),
          row.pipeline_tag ? '· ' + row.pipeline_tag : '',
          row.lastModified ? '· 更新于 ' + String(row.lastModified).slice(0, 10) : '',
        ].filter(Boolean).join(' '),
        publishedAt: row.lastModified || row.createdAt || null,
        score: row.trendingScore || likes || null,
        scoreLabel: '趋势 ' + fmt(row.trendingScore),
        tags: ['模型', kind].concat(row.pipeline_tag ? [row.pipeline_tag] : []),
        evidence: {
          url: kind === 'model' ? MODELS : kind === 'dataset' ? DATASETS : SPACES,
          fetchedAt: kind === 'model' ? models.fetchedAt : kind === 'dataset' ? datasets.fetchedAt : spaces.fetchedAt,
          httpStatus: kind === 'model' ? models.status : kind === 'dataset' ? datasets.status : spaces.status,
          pointer: 'trendingScore 排序里 id=' + row.id,
        },
      }));
    };
    for (const row of models.rows) push(row, 'model', 'HF 热门模型', 'https://huggingface.co/' + row.id);
    for (const row of datasets.rows) push(row, 'dataset', 'HF 热门数据集', 'https://huggingface.co/datasets/' + row.id);
    for (const row of spaces.rows) push(row, 'space', 'HF 热门 Space', 'https://huggingface.co/spaces/' + row.id);
    return {
      items,
      httpStatus: models.status,
      latencyMs: Date.now() - started,
      count: items.length,
    };
  },
};
