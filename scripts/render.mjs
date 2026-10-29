import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJson } from './lib/store.mjs';

const ROOT = process.cwd();
const DATA = join(ROOT, 'data');
const DIST = join(ROOT, 'dist');
const WEB = join(ROOT, 'web');

const feed = readJson(join(DATA, 'feed.json'), { items: [], generatedAt: null });
const github = readJson(join(DATA, 'github.json'), { newRepos: [], risers: [], releases: [], ownRepos: [], topics: [] });
const dsh = readJson(join(DATA, 'dsh.json'), { total: 0, newCount: 0, categories: [], recent: [] });
const sources = readJson(join(DATA, 'sources.json'), { sources: [], totals: {} });
const config = readJson(join(ROOT, 'config', 'watchlist.json'), {});
const items = feed.items || [];
const now = new Date();
const iso = now.toISOString();

const byKind = {};
const bySource = {};
for (const item of items) {
  byKind[item.kind] = (byKind[item.kind] || 0) + 1;
  bySource[item.source] = (bySource[item.source] || 0) + 1;
}
const sourceRows = sources.sources || [];
const okCount = sourceRows.filter((row) => row.status === 'ok').length;

function zhTime(isoString) {
  try {
    return new Date(isoString).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  } catch {
    return isoString;
  }
}

function cell(text) {
  return String(text || '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

const topByHeat = [...items].sort((a, b) => (b.heat || 0) - (a.heat || 0)).slice(0, 10);
const fresh = items.filter((item) => item.lastSeenAt && item.seenCount === 1).slice(0, 24);

const digest = [];
digest.push('# AI 大世界 · 采集快照');
digest.push('');
digest.push('- 生成时间：' + zhTime(feed.generatedAt || iso) + '（Asia/Shanghai）');
digest.push('- 库内条目：' + items.length + ' 条；最近一次新增：' + (feed.freshCount || 0) + ' 条');
digest.push('- 数据源：' + okCount + '/' + sourceRows.length + ' 正常');
digest.push('');
digest.push('## 本次新增');
digest.push('');
if (!fresh.length) digest.push('（无新增，上一轮采集后没有新内容）');
for (const item of fresh) {
  digest.push('- [' + cell(item.title) + '](' + item.url + ') · ' + (item.sourceLabel || item.source) + ' · ' + (item.publishedAt ? zhTime(item.publishedAt) : '时间未知'));
}
digest.push('');
digest.push('## 热度榜');
digest.push('');
digest.push('| 热度 | 标题 | 来源 | 时间 |');
digest.push('| ---: | --- | --- | --- |');
for (const item of topByHeat) {
  digest.push('| ' + (item.heat || 0) + ' | [' + cell(item.title) + '](' + item.url + ') | ' + cell(item.sourceLabel || item.source) + ' | ' + (item.publishedAt ? zhTime(item.publishedAt) : '-') + ' |');
}
digest.push('');
digest.push('## 数据源健康度');
digest.push('');
digest.push('| 数据源 | 状态 | HTTP | 抓取条数 | 耗时 | 证据端点 |');
digest.push('| --- | --- | ---: | ---: | ---: | --- |');
for (const row of sourceRows) {
  digest.push('| ' + cell(row.label) + ' | ' + (row.status === 'ok' ? '正常' : '失败') + ' | ' + (row.httpStatus || '-') + ' | ' + (row.items || 0) + ' | ' + Math.round((row.latencyMs || 0) / 100) / 10 + 's | ' + (row.status === 'ok' ? '见每条 item 的 evidence.url' : cell(row.error)) + ' |');
}
digest.push('');
digest.push('> 每条条目都带 `evidence` 字段（抓取端点、抓取时间、HTTP 状态、在响应里的定位），机器可读版本见 `data/feed.json`。');
mkdirSync(DATA, { recursive: true });
writeFileSync(join(DATA, 'digest.md'), digest.join('\n') + '\n', 'utf8');

const site = {
  generatedAt: iso,
  feedGeneratedAt: feed.generatedAt,
  title: 'AI 大世界',
  stats: {
    items: items.length,
    fresh: feed.freshCount || 0,
    byKind,
    bySource,
    sourcesOk: okCount,
    sourcesTotal: sourceRows.length,
    newRepos: (github.newRepos || []).length,
    risers: (github.risers || []).length,
    releases: (github.releases || []).length,
    dshTotal: dsh.total || 0,
    dshNew: dsh.newCount || 0,
  },
  watchlist: {
    repos: config.repos || [],
    ownRepos: config.ownRepos || [],
    topics: config.topics || [],
  },
};
writeJson(join(DATA, 'site.json'), site);

function updateReadme() {
  const readmePath = join(ROOT, 'README.md');
  if (!existsSync(readmePath)) return;
  const raw = readFileSync(readmePath, 'utf8');
  const start = raw.indexOf('<!-- RADAR:START -->');
  const end = raw.indexOf('<!-- RADAR:END -->');
  if (start === -1 || end === -1) return;
  const block = [];
  block.push('<!-- RADAR:START -->');
  block.push('**最近一次采集**：' + zhTime(feed.generatedAt || iso) + ' · 库内 ' + items.length + ' 条 · 本轮新增 ' + (feed.freshCount || 0) + ' 条 · 数据源 ' + okCount + '/' + sourceRows.length + ' 正常');
  block.push('');
  block.push('| 热度 | 条目 | 来源 |');
  block.push('| ---: | --- | --- |');
  for (const item of topByHeat.slice(0, 6)) {
    block.push('| ' + (item.heat || 0) + ' | [' + cell(item.title) + '](' + item.url + ') | ' + cell(item.sourceLabel || item.source) + ' |');
  }
  block.push('<!-- RADAR:END -->');
  const next = raw.slice(0, start) + block.join('\n') + raw.slice(end + '<!-- RADAR:END -->'.length);
  if (next !== raw) writeFileSync(readmePath, next, 'utf8');
}
updateReadme();

if (existsSync(WEB)) {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  cpSync(WEB, DIST, { recursive: true });
  mkdirSync(join(DIST, 'data'), { recursive: true });
  for (const name of ['feed.json', 'github.json', 'dsh.json', 'sources.json', 'site.json']) {
    const src = join(DATA, name);
    if (existsSync(src)) cpSync(src, join(DIST, 'data', name));
  }
  writeFileSync(join(DIST, '.nojekyll'), '', 'utf8');

  // RSS 2.0：让情报流可以被订阅（网页 / 阅读器 / 其它服务消费）
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const rss = [];
  rss.push('<?xml version="1.0" encoding="UTF-8"?>');
  rss.push('<rss version="2.0"><channel>');
  rss.push('<title>AI 大世界 · 实时 AI 情报站</title>');
  rss.push('<link>https://123caiji.github.io/ai-world/</link>');
  rss.push('<description>每小时自动采集的 AI 新闻、论文、新模型、GitHub 新仓库与 DSH 插件，每条都带可核验证据。</description>');
  rss.push('<language>zh-CN</language>');
  rss.push('<lastBuildDate>' + new Date(feed.generatedAt || iso).toUTCString() + '</lastBuildDate>');
  for (const item of topByHeat.slice(0, 80)) {
    rss.push('<item>');
    rss.push('<title>' + esc(item.title) + '</title>');
    rss.push('<link>' + esc(item.url) + '</link>');
    rss.push('<guid isPermaLink="false">' + esc(item.id) + '</guid>');
    rss.push('<pubDate>' + new Date(item.publishedAt || item.firstSeenAt || iso).toUTCString() + '</pubDate>');
    rss.push('<category>' + esc(item.kind) + '</category>');
    rss.push('<description>' + esc((item.summary || '') + ' — 来源 ' + (item.sourceLabel || item.source) + '，抓取于 ' + (item.evidence ? item.evidence.fetchedAt : '') + '，HTTP ' + (item.evidence ? item.evidence.httpStatus : '')) + '</description>');
    rss.push('</item>');
  }
  rss.push('</channel></rss>');
  writeFileSync(join(DIST, 'feed.xml'), rss.join('\n'), 'utf8');

  console.log('dist rebuilt -> ' + DIST);
}

console.log('render done: items=' + items.length + ' sources=' + okCount + '/' + sourceRows.length + ' readme=' + (existsSync(join(ROOT, 'README.md')) ? 'yes' : 'no'));
