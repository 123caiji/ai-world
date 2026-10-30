import { join } from 'node:path';
import { sources } from './sources/index.mjs';
import { appendJsonl, readJson, writeJson } from './lib/store.mjs';
import { sha1 } from './lib/util.mjs';
import { fetchCoverImage, isUsableImage, mapLimit } from './lib/media.mjs';
import { DEFAULT_INTERVAL_MIN, FORCE, clearSkipMarker, humanMinutes, writeSkipMarker } from './lib/window.mjs';
import { dispatchSuccessor, isActions, readKeeperConfig, waitForWindow, writeKeeperState } from './lib/keeper.mjs';

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'data');
const SNAP_DIR = join(DATA_DIR, 'snapshots');
const MAX_FEED = 900;
const MAX_AGE_HOURS = 24 * 21;
const SOURCE_TIMEOUT_MS = 180000;
const HEAVY = new Set(['github', 'dsh-plugins']);

const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length).split(',') : null;

// ---- 采集窗口 + 自愈链 ----
// cron 只当兜底：GitHub 的 schedule 会延迟甚至整段丢拍（实测 4 小时一次都没来），
// 所以节奏由脚本自己维持 —— 每轮一开始先把下一轮排进队列，本轮守候到窗口打开再采集。
const keeper = readKeeperConfig(ROOT);
const keeperOn = keeper.enabled && (isActions() || process.env.RADAR_KEEPER === '1');
const keeperMaxWait = Number(process.env.RADAR_KEEPER_MAX_WAIT_MIN || keeper.maxWaitMinutes);

const lastCollectedAt = readJson(join(DATA_DIR, 'site.json'), {}).feedGeneratedAt
  || readJson(join(DATA_DIR, 'feed.json'), {}).generatedAt
  || null;
let sinceMinutes = lastCollectedAt ? (Date.now() - new Date(lastCollectedAt).getTime()) / 60000 : Number.POSITIVE_INFINITY;
let windowOpen = FORCE || Boolean(only) || !Number.isFinite(sinceMinutes) || sinceMinutes >= DEFAULT_INTERVAL_MIN;

if (keeperOn) {
  // 先排队、后干活：本轮即使被取消/报错，链子也不会断
  const dispatched = await dispatchSuccessor({ reason: 'keeper-start' });
  const state = writeKeeperState(ROOT, {
    enabled: true,
    event: process.env.GITHUB_EVENT_NAME || 'local',
    runId: process.env.GITHUB_RUN_ID || null,
    lastDispatchOk: Boolean(dispatched.ok),
    lastDispatch: dispatched,
    intervalMinutes: DEFAULT_INTERVAL_MIN,
    maxWaitMinutes: keeperMaxWait,
  });
  console.log(
    dispatched.ok
      ? 'keeper: 第 ' + state.chainRuns + ' 环 — 下一轮已排进队列（ref=' + dispatched.ref + '）'
      : 'keeper: 排队失败（' + (dispatched.error || dispatched.skipped || dispatched.message) + '），本轮只靠 cron 兜底',
  );

  if (!windowOpen) {
    const waited = await waitForWindow({ root: ROOT, intervalMinutes: DEFAULT_INTERVAL_MIN, maxWaitMinutes: keeperMaxWait });
    windowOpen = waited.evaluated.collect;
    sinceMinutes = waited.evaluated.sinceMinutes;
    if (windowOpen) console.log('keeper: 守候 ' + waited.waitedMinutes + ' 分钟后窗口打开，开始采集');
  }
}

if (!windowOpen) {
  writeSkipMarker(ROOT, {
    skippedAt: new Date().toISOString(),
    lastCollect: lastCollectedAt,
    sinceMinutes: Math.round(sinceMinutes),
    intervalMinutes: DEFAULT_INTERVAL_MIN,
    nextDueAt: new Date(new Date(lastCollectedAt).getTime() + DEFAULT_INTERVAL_MIN * 60000).toISOString(),
  });
  console.log(
    `collect skipped: 上次采集 ${humanMinutes(sinceMinutes)}前，未到 ${humanMinutes(DEFAULT_INTERVAL_MIN)} 窗口；` +
    `下一轮尝试会自动补跑（FORCE_COLLECT=1 可强制采集）。`,
  );
  process.exit(0);
}
clearSkipMarker(ROOT);

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
// 历史条目里的图没有来源标签（旧版本抓的），统一补一个诚实的默认值：来自订阅源自身
for (const item of kept) {
  // 已知死链（如 opengraph.githubassets.com 的 429）不留在页面上，清掉好让补图重试
  if (item.image && !isUsableImage(item.image)) {
    item.image = '';
    delete item.imageSource;
  }
  if (item.image && !item.imageSource) item.imageSource = 'RSS 原文配图';
}

// ---- 素材补全：对没有缩略图的条目，去原文页取站点自己声明的封面图（og:image / twitter:image）----
// 只补"有原文页面、且本身没图"的条目；带并发/超时/失败静默，任何一条失败都不影响采集。
const ENRICH_LIMIT = Number(process.env.ENRICH_LIMIT || 400);
const missing = kept
  .filter((item) => !item.image && item.url && /^https?:\/\//i.test(item.url))
  .sort((a, b) => (b.heat || 0) - (a.heat || 0))
  .slice(0, ENRICH_LIMIT);
const coverCache = readJson(join(SNAP_DIR, 'covers.json'), {});
// 缓存里已经失效的地址（历史抓到的 429 死链）先剔掉，别一直复用
for (const key of Object.keys(coverCache)) {
  if (coverCache[key] && !isUsableImage(coverCache[key])) delete coverCache[key];
}
const coverStarted = Date.now();
let coverHit = 0;
let coverCached = 0;
if (missing.length) {
  await mapLimit(missing, 8, async (item) => {
    const before = Object.prototype.hasOwnProperty.call(coverCache, item.url);
    const image = await fetchCoverImage(item.url, { cache: coverCache });
    if (before) coverCached += 1;
    if (!image) return;
    item.image = image;
    item.imageSource = '原文 OG 封面';
    coverHit += 1;
  });
}
// 缓存只保留最近 4000 条 URL，避免快照无限膨胀
const coverKeys = Object.keys(coverCache);
if (coverKeys.length > 4000) {
  for (const key of coverKeys.slice(0, coverKeys.length - 4000)) delete coverCache[key];
}
writeJson(join(SNAP_DIR, 'covers.json'), coverCache);
const coverMs = Date.now() - coverStarted;

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
const withImage = kept.filter((item) => item.image).length;
console.log('collected ' + collected.length + ' items, ' + freshRows.length + ' new, feed=' + kept.length + ', sources ok ' + okCount + '/' + reports.length);
console.log('media: ' + withImage + '/' + kept.length + ' 条带真实缩略图 (' + Math.round((withImage / Math.max(1, kept.length)) * 100) + '%)，本次补图 ' + coverHit + '/' + missing.length + '（' + coverMs + 'ms)');
for (const row of ctx.draft.github ? ctx.draft.github.warnings || [] : []) console.log('  warn: ' + row);
