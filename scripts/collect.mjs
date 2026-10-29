import { join } from 'node:path';
import { sources } from './sources/index.mjs';
import { appendJsonl, readJson, writeJson } from './lib/store.mjs';
import { sha1 } from './lib/util.mjs';

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'data');
const SNAP_DIR = join(DATA_DIR, 'snapshots');
const MAX_FEED = 900;
const MAX_AGE_HOURS = 24 * 21;
const SOURCE_TIMEOUT_MS = 180000;
const HEAVY = new Set(['github', 'dsh-plugins']);

const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length).split(',') : null;

const config = readJson(join(ROOT, 'config', 'watchlist.json'), {});
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const previousSources = readJson(join(DATA_DIR, 'sources.json'), {});
const state = {
  stars: readJson(join(SNAP_DIR, 'stars.json'), {}),
  releases: readJson(join(SNAP_DIR, 'releases.json'), {}),
  models: readJson(join(SNAP_DIR, 'models.json'), {}),
  plugins: readJson(join(SNAP_DIR, 'plugins.json'), []),
  lastRun: previousSources.generatedAt || null,
};
const ctx = { config, token, state, draft: {} };

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout after ' + ms + 'ms: ' + label)), ms)),
  ]);
}

async function runSource(source) {
  const started = Date.now();
  try {
    const result = await withTimeout(source.run(ctx), SOURCE_TIMEOUT_MS, source.id);
    const items = (result.items || []).filter((item) => item && item.url && item.title);
    console.log('[ok]   ' + source.id.padEnd(16) + String(items.length).padStart(4) + ' new items  (' + (result.count || items.length) + ' raw, ' + (Date.now() - started) + 'ms)');
    return {
      id: source.id,
      label: source.label,
      kind: source.kind,
      status: 'ok',
      httpStatus: result.httpStatus || 200,
      items: items.length,
      raw: result.count || items.length,
      latencyMs: Date.now() - started,
      lastOk: new Date().toISOString(),
      error: '',
      warnings: result.warnings || [],
      _items: items,
    };
  } catch (err) {
    const message = String((err && err.message) || err).slice(0, 300);
    console.log('[fail] ' + source.id.padEnd(16) + ' ' + message);
    return {
      id: source.id,
      label: source.label,
      kind: source.kind,
      status: 'error',
      httpStatus: null,
      items: 0,
      raw: 0,
      latencyMs: Date.now() - started,
      lastOk: null,
      error: message,
      warnings: [],
      _items: [],
    };
  }
}

async function runPool(list, size) {
  const out = new Array(list.length);
  let cursor = 0;
  async function worker() {
    while (cursor < list.length) {
      const index = cursor++;
      out[index] = await runSource(list[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, list.length) }, worker));
  return out;
}

const selected = only ? sources.filter((s) => only.includes(s.id)) : sources;
const heavy = selected.filter((s) => HEAVY.has(s.id));
const light = selected.filter((s) => !HEAVY.has(s.id));

const heavyReports = [];
for (const source of heavy) heavyReports.push(await runSource(source));
const lightReports = await runPool(light, 5);
const reports = selected.map((s) => [...heavyReports, ...lightReports].find((r) => r.id === s.id)).filter(Boolean);
const collected = reports.flatMap((report) => report._items);

function heatOf(item, isNew) {
  const nowMs = Date.now();
  const publishedMs = item.publishedAt ? new Date(item.publishedAt).getTime() : nowMs;
  const ageHours = Math.max(0, (nowMs - publishedMs) / 3600000);
  const recency = Math.max(0, 100 - ageHours * 1.7);
  const scoreBoost = typeof item.score === 'number' && item.score > 0 ? Math.min(60, Math.log10(1 + item.score) * 22) : 0;
  const hay = (item.title + ' ' + item.summary).toLowerCase();
  const boostWords = (config.keywords && config.keywords.list) || [];
  const hits = boostWords.filter((word) => hay.includes(String(word).toLowerCase())).length;
  const keywordBoost = Math.min(45, hits * ((config.keywords && config.keywords.boost) || 15));
  const freshness = isNew ? 12 : 0;
  return Math.round(recency + scoreBoost + keywordBoost + freshness);
}

const previousFeed = readJson(join(DATA_DIR, 'feed.json'), { items: [] });
const previousById = new Map((previousFeed.items || []).map((item) => [item.id, item]));
const merged = new Map();
const freshRows = [];

for (const item of collected) {
  const prior = previousById.get(item.id);
  const isNew = !prior;
  const record = {
    ...item,
    firstSeenAt: prior ? prior.firstSeenAt : item.firstSeenAt,
    lastSeenAt: new Date().toISOString(),
    seenCount: prior ? (prior.seenCount || 1) + 1 : 1,
    heat: heatOf(item, isNew),
  };
  merged.set(item.id, record);
  if (isNew) freshRows.push(record);
}

for (const [id, item] of previousById) {
  if (merged.has(id)) continue;
  const publishedMs = item.publishedAt ? new Date(item.publishedAt).getTime() : new Date(item.firstSeenAt).getTime();
  if (Date.now() - publishedMs > MAX_AGE_HOURS * 3600000) continue;
  merged.set(id, item);
}

const allItems = [...merged.values()].sort((a, b) => {
  const at = new Date(a.publishedAt || a.firstSeenAt).getTime() || 0;
  const bt = new Date(b.publishedAt || b.firstSeenAt).getTime() || 0;
  return bt - at;
});
const kept = allItems.slice(0, MAX_FEED);

const month = new Date().toISOString().slice(0, 7);
appendJsonl(join(DATA_DIR, 'archive', month + '.jsonl'), freshRows.map((row) => ({
  id: row.id,
  kind: row.kind,
  source: row.source,
  title: row.title,
  url: row.url,
  publishedAt: row.publishedAt,
  firstSeenAt: row.firstSeenAt,
  heat: row.heat,
})));

writeJson(join(DATA_DIR, 'feed.json'), {
  generatedAt: new Date().toISOString(),
  count: kept.length,
  freshCount: freshRows.length,
  items: kept,
});

const okCount = reports.filter((r) => r.status === 'ok').length;
const sourceRows = reports.map(({ _items, ...rest }) => rest);
const priorMap = new Map((previousSources.sources || []).map((row) => [row.id, row]));
const sourcesPayload = {
  generatedAt: new Date().toISOString(),
  totals: {
    sources: reports.length,
    ok: okCount,
    error: reports.length - okCount,
    items: kept.length,
    fresh: freshRows.length,
    latencyMs: reports.reduce((sum, r) => sum + r.latencyMs, 0),
  },
  sources: sourceRows.map((row) => ({
    ...row,
    previousLastOk: row.status === 'error' ? ((priorMap.get(row.id) || {}).lastOk || null) : null,
  })),
};
writeJson(join(DATA_DIR, 'sources.json'), sourcesPayload);

if (ctx.draft.stars) writeJson(join(SNAP_DIR, 'stars.json'), ctx.draft.stars);
if (ctx.draft.releases) writeJson(join(SNAP_DIR, 'releases.json'), ctx.draft.releases);
if (ctx.draft.models) writeJson(join(SNAP_DIR, 'models.json'), ctx.draft.models);
if (ctx.draft.plugins) writeJson(join(SNAP_DIR, 'plugins.json'), ctx.draft.plugins);
if (ctx.draft.github) writeJson(join(DATA_DIR, 'github.json'), ctx.draft.github);
if (ctx.draft.dsh) writeJson(join(DATA_DIR, 'dsh.json'), ctx.draft.dsh);

console.log('');
console.log('collected ' + collected.length + ' items, ' + freshRows.length + ' new, feed=' + kept.length + ', sources ok ' + okCount + '/' + reports.length);
for (const row of ctx.draft.github ? ctx.draft.github.warnings || [] : []) console.log('  warn: ' + row);
