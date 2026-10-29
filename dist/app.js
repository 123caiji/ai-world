/* AI 大世界 · 前端（无构建、无依赖） */
const PAGE = 24;

const KIND = {
  news:       { label: '新闻', color: '#60a5fa' },
  paper:      { label: '论文', color: '#a78bfa' },
  repo:       { label: '开源', color: '#34d399' },
  release:    { label: '发布', color: '#2dd4bf' },
  model:      { label: '模型', color: '#fbbf24' },
  dataset:    { label: '数据集', color: '#f59e0b' },
  space:      { label: 'Space', color: '#fb923c' },
  plugin:     { label: '插件', color: '#22d3ee' },
  discussion: { label: '热帖', color: '#94a3b8' },
  product:    { label: '产品', color: '#f472b6' },
  video:      { label: '视频', color: '#fb7185' },
  security:   { label: '安全', color: '#facc15' },
};
const KIND_ORDER = ['all', 'news', 'paper', 'repo', 'model', 'dataset', 'video', 'security', 'plugin', 'discussion', 'product', 'release', 'space'];

const state = { all: [], filtered: [], shown: PAGE, kind: 'all', query: '', source: '', byHeat: false };
const $ = (id) => document.getElementById(id);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function esc(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function relTime(isoString) {
  if (!isoString) return '';
  const then = new Date(isoString).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const min = Math.round(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return min + ' 分钟前';
  const hours = Math.round(min / 60);
  if (hours < 24) return hours + ' 小时前';
  const days = Math.round(hours / 24);
  if (days < 30) return days + ' 天前';
  return Math.round(days / 30) + ' 个月前';
}

async function loadJson(path, fallback) {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (err) {
    console.warn('load failed', path, err);
    return fallback;
  }
}

/* ---------- 顶部：时钟 ---------- */
function startClock() {
  const node = $('clock');
  const tick = () => {
    const now = new Date();
    node.textContent = [now.getHours(), now.getMinutes(), now.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
  };
  tick();
  setInterval(tick, 1000);
}

/* ---------- KPI 数字滚动 ---------- */
function countUp(node, target) {
  if (reduced || !target) { node.textContent = String(target || 0); return; }
  const start = performance.now();
  const duration = 900;
  const step = (t) => {
    const p = Math.min(1, (t - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    node.textContent = String(Math.round(target * eased));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderKpis(site, feedItems) {
  const stats = (site && site.stats) || {};
  const km = stats.byKind || {};
  const now = Date.now();
  const last1h = feedItems.filter((item) => {
    const t = new Date(item.firstSeenAt || item.publishedAt || 0).getTime();
    return Number.isFinite(t) && now - t < 3600000;
  }).length;
  const rows = [
    ['库内情报', stats.items || feedItems.length, '条'],
    ['本轮新增', stats.fresh || 0, '条'],
    ['近 1 小时入库', last1h, '条'],
    ['数据源在线', stats.sourcesOk || 0, '/' + (stats.sourcesTotal || 0)],
  ];
  $('kpis').innerHTML = rows.map(([label, value, suffix]) => (
    '<div class="kpi"><div class="v" data-target="' + (Number(value) || 0) + '">0</div>' +
    '<span class="k">' + esc(label) + (suffix ? ' · ' + esc(suffix) : '') + '</span></div>'
  )).join('');
  for (const node of $('kpis').querySelectorAll('.v')) countUp(node, Number(node.dataset.target));
}

/* ---------- 24 小时节奏 sparkline ---------- */
function renderSpark(trend) {
  const svg = $('spark');
  const hours = (trend && trend.hours) || [];
  if (!hours.length) { svg.innerHTML = ''; return; }
  const W = 720, H = 96, pad = 6;
  const max = Math.max(1, ...hours.map((h) => h.n));
  const pts = hours.map((h, i) => {
    const x = pad + (i * (W - pad * 2)) / Math.max(1, hours.length - 1);
    const y = H - pad - (h.n / max) * (H - pad * 2);
    return [x, y];
  });
  const line = pts.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
  const area = line + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (H - pad) + ' L' + pts[0][0].toFixed(1) + ' ' + (H - pad) + ' Z';
  svg.innerHTML =
    '<defs>' +
    '<linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#22d3ee" stop-opacity=".55"/><stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="sparkLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#22d3ee"/><stop offset="60%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#a78bfa"/></linearGradient>' +
    '</defs>' +
    '<path class="area" d="' + area + '"/>' +
    '<path class="line" d="' + line + '"/>' +
    pts.filter((_, i) => i % 6 === 0 || i === pts.length - 1).map(([x, y]) => '<circle class="dot" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.2"/>').join('');
  $('spark-total').textContent = '共 ' + hours.reduce((s, h) => s + h.n, 0) + ' 条 · 峰值 ' + max + ' 条/小时';
}

/* ---------- 滚屏播报 ---------- */
function renderTicker(items) {
  const top = [...items]
    .sort((a, b) => (b.heat || 0) - (a.heat || 0))
    .slice(0, 18);
  const one = top.map((item) => (
    '<span class="sep">◆</span><a href="' + esc(item.url) + '" target="_blank" rel="noopener">[' + esc(KIND[item.kind] ? KIND[item.kind].label : item.kind) + '] ' + esc(item.title) + '</a>'
  )).join('');
  $('ticker-track').innerHTML = one + one;
}

/* ---------- 分类 ---------- */
function renderTabs() {
  const counts = {};
  for (const item of state.all) counts[item.kind] = (counts[item.kind] || 0) + 1;
  const kinds = KIND_ORDER.filter((kind) => kind === 'all' || counts[kind]);
  const rows = kinds.map((kind) => {
    const label = kind === 'all' ? '全部' : (KIND[kind] ? KIND[kind].label : kind);
    const count = kind === 'all' ? state.all.length : counts[kind];
    const dot = kind === 'all' ? '' : '<i class="ch-dot" style="background:' + (KIND[kind] ? KIND[kind].color : '#94a3b8') + '"></i>';
    return '<button class="ch' + (state.kind === kind ? ' active' : '') + '" data-kind="' + kind + '" type="button">' +
      '<span class="ch-left">' + dot + esc(label) + '</span><span class="n">' + count + '</span></button>';
  });
  $('tabs').innerHTML = rows.join('');
  for (const btn of $('tabs').querySelectorAll('.ch')) {
    btn.addEventListener('click', () => {
      state.kind = btn.dataset.kind;
      state.shown = PAGE;
      $('feed-title').textContent = state.kind === 'all' ? '全部情报' : (KIND[state.kind] ? KIND[state.kind].label : state.kind) + '情报';
      renderTabs();
      applyFilter();
    });
  }
}

/* ---------- 情报构成环形图 ---------- */
function renderDonut(byKind) {
  const entries = Object.entries(byKind || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, n]) => s + n, 0) || 1;
  const R = 46, C = 2 * Math.PI * R;
  let offset = 0;
  $('donut').innerHTML = entries.map(([kind, n]) => {
    const len = (n / total) * C;
    const seg = '<circle r="' + R + '" cx="60" cy="60" stroke="' + (KIND[kind] ? KIND[kind].color : '#94a3b8') +
      '" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-offset).toFixed(2) + '"><title>' +
      esc((KIND[kind] ? KIND[kind].label : kind) + ' ' + n + ' 条') + '</title></circle>';
    offset += len;
    return seg;
  }).join('');
  $('donut-legend').innerHTML = entries.slice(0, 8).map(([kind, n]) => (
    '<li><i class="sw" style="background:' + (KIND[kind] ? KIND[kind].color : '#94a3b8') + '"></i>' +
    esc(KIND[kind] ? KIND[kind].label : kind) + '<span class="n">' + n + '</span></li>'
  )).join('');
}

/* ---------- 热词云 ---------- */
function renderCloud(topics) {
  const words = (topics && topics.words) || [];
  if (!words.length) { $('cloud').innerHTML = '<p class="muted">暂无热词</p>'; return; }
  const max = Math.max(...words.map((w) => w.n));
  $('cloud').innerHTML = words.slice(0, 30).map((w) => {
    const size = 11.5 + (w.n / max) * 10.5;
    const alpha = 0.55 + (w.n / max) * 0.45;
    return '<button type="button" data-word="' + esc(w.w) + '" style="font-size:' + size.toFixed(1) + 'px;opacity:' + alpha.toFixed(2) + '">' + esc(w.w) + '</button>';
  }).join('');
  for (const btn of $('cloud').querySelectorAll('button')) {
    btn.addEventListener('click', () => {
      state.query = btn.dataset.word;
      $('q').value = btn.dataset.word;
      state.shown = PAGE;
      applyFilter();
      window.scrollTo({ top: $('tabs').offsetTop - 80, behavior: reduced ? 'auto' : 'smooth' });
    });
  }
}

/* ---------- 数据源健康度 ---------- */
function renderSources(sources) {
  const rows = (sources && sources.sources) || [];
  if (!rows.length) { $('sources-body').innerHTML = '<p class="muted">暂无数据</p>'; return; }
  const cells = rows.map((row) => {
    const ok = row.status === 'ok';
    return '<div class="s" title="' + esc(row.label + ' · ' + (ok ? row.items + ' 条 · ' + Math.round((row.latencyMs || 0) / 100) / 10 + 's' : '失败: ' + (row.error || ''))) + '">' +
      '<i class="dot' + (ok ? '' : ' err') + '"></i><span class="t">' + esc(row.label) + '</span>' +
      '<span class="n">' + (ok ? row.items : '×') + '</span></div>';
  }).join('');
  const failed = rows.filter((row) => row.status !== 'ok');
  $('sources-body').innerHTML = '<div class="src-grid">' + cells + '</div>' +
    (failed.length ? failed.map((row) => '<div class="src-err">× ' + esc(row.label) + '：' + esc(String(row.error || '').slice(0, 90)) + '</div>').join('') : '');
  const okCount = rows.filter((row) => row.status === 'ok').length;
  $('radar-caption').textContent = '数据源 ' + okCount + '/' + rows.length + ' 在线 · 每小时扫描';
  $('pulseText').textContent = okCount === rows.length ? '采集在线' : '部分源异常';
}

/* ---------- GitHub 面板 ---------- */
function renderGithub(github) {
  const data = github || {};
  const parts = [];
  if (data.newRepos && data.newRepos.length) {
    parts.push('<div class="sub">最近两周新仓库</div><ul class="mini">' + data.newRepos.slice(0, 6).map((repo) =>
      '<li><a href="' + esc(repo.url) + '" target="_blank" rel="noopener">' + esc(repo.full) + '</a><span class="num">' + esc(repo.stars) + ' ★</span></li>'
    ).join('') + '</ul>');
  }
  if (data.risers && data.risers.length) {
    parts.push('<div class="sub">涨星榜</div><ul class="mini">' + data.risers.slice(0, 6).map((repo) =>
      '<li><a href="' + esc(repo.url) + '" target="_blank" rel="noopener">' + esc(repo.full) + '</a><span class="num" style="color:var(--green)">+' + esc(repo.delta) + ' ★</span></li>'
    ).join('') + '</ul>');
  }
  if (data.topics && data.topics.length) {
    const byTopic = new Map();
    for (const row of data.topics) {
      if (!byTopic.has(row.topic)) byTopic.set(row.topic, []);
      byTopic.get(row.topic).push(row);
    }
    parts.push('<div class="sub">话题榜</div>');
    for (const [topic, rows] of byTopic) {
      parts.push('<div style="margin-bottom:6px"><span class="tag">#' + esc(topic) + '</span><ul class="mini" style="margin-top:5px">' +
        rows.slice(0, 3).map((row) => '<li><a href="' + esc(row.url) + '" target="_blank" rel="noopener">' + esc(row.full) + '</a><span class="num">' + esc(row.stars) + ' ★</span></li>').join('') +
        '</ul></div>');
    }
  }
  if (data.releases && data.releases.length) {
    parts.push('<div class="sub">新版本</div><ul class="mini">' + data.releases.slice(0, 6).map((rel) =>
      '<li><a href="' + esc(rel.url) + '" target="_blank" rel="noopener">' + esc(rel.repo + ' ' + rel.tag) + '</a><span class="num">' + esc(relTime(rel.publishedAt)) + '</span></li>'
    ).join('') + '</ul>');
  }
  if (data.ownRepos && data.ownRepos.length) {
    parts.push('<div class="sub">我的仓库</div><ul class="mini">' + data.ownRepos.map((repo) =>
      '<li><a href="' + esc(repo.url) + '" target="_blank" rel="noopener">' + esc(repo.full) + '</a><span class="num">' + esc(repo.stars) + ' ★' + (repo.delta ? ' · +' + esc(repo.delta) : '') + '</span></li>'
    ).join('') + '</ul>');
  }
  $('github-body').innerHTML = parts.length ? parts.join('') : '<p class="muted">本次没有抓取到 GitHub 数据（检查仓库权限或限流）。</p>';
}

/* ---------- DSH 面板 ---------- */
function renderDsh(dsh) {
  const data = dsh || {};
  const cats = data.categories || [];
  const max = cats.reduce((m, row) => Math.max(m, row.count), 1);
  const parts = [
    '<div class="kpis" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:10px">' +
    '<div class="kpi"><div class="v" style="font-size:20px">' + esc(data.total || 0) + '</div><span class="k">个插件</span></div>' +
    '<div class="kpi"><div class="v" style="font-size:20px">' + esc(data.newCount || 0) + '</div><span class="k">本轮新增</span></div></div>',
    cats.slice(0, 6).map((row) => '<div class="bar"><span class="label">' + esc(row.name) + '</span><span class="track"><span class="fill" style="width:' + Math.round(row.count / max * 100) + '%"></span></span><span class="num">' + esc(row.count) + '</span></div>').join(''),
  ];
  if (data.recent && data.recent.length) {
    parts.push('<div class="sub">最近更新</div><ul class="mini">' + data.recent.slice(0, 5).map((row) =>
      '<li><a href="' + esc(row.url) + '" target="_blank" rel="noopener">' + esc(row.title) + '</a><span class="num">v' + esc(row.version || '?') + '</span></li>'
    ).join('') + '</ul>');
  }
  $('dsh-body').innerHTML = parts.join('');
}

/* ---------- 卡片 ---------- */
function cardHtml(item, index) {
  const kind = item.kind || 'news';
  const color = KIND[kind] ? KIND[kind].color : '#60a5fa';
  const tags = (item.tags || []).slice(0, 4).map((tag) => '<span class="tag">' + esc(tag) + '</span>').join('');
  const ev = item.evidence || {};
  const title = '抓取端点：' + (ev.url || item.url) + '\n抓取时间：' + (ev.fetchedAt || '-') + '\nHTTP 状态：' + (ev.httpStatus || '-') + '\n定位：' + (ev.pointer || '-');
  const heat = Math.max(0, Math.min(100, Number(item.heat) || 0));
  const media = mediaHtml(item, kind, color);
  return '<article class="card" style="--i:' + Math.min(index, 12) + ';--kc:' + color + '">' +
    '<div class="card-top">' +
    '<span class="kind kind-' + esc(kind) + '">' + esc(KIND[kind] ? KIND[kind].label : kind) + '</span>' +
    '<span>' + esc(item.sourceLabel || item.source) + '</span>' +
    '<span>·</span>' +
    '<span>' + esc(relTime(item.publishedAt || item.firstSeenAt)) + '</span>' +
    (item.scoreLabel ? '<span class="tag">' + esc(item.scoreLabel) + '</span>' : '') +
    '<span class="heat-ring" style="--p:' + heat + ';margin-left:auto" title="热度 ' + esc(item.heat) + '"><i>' + Math.round(heat / 10) + '</i></span>' +
    '</div>' +
    '<div class="card-body">' +
    '<div class="grow">' +
    '<h2><a href="' + esc(item.url) + '" target="_blank" rel="noopener">' + esc(item.title) + '</a></h2>' +
    (item.summary ? '<p class="summary">' + esc(item.summary) + '</p>' : '') +
    '<div class="meta">' + tags +
    (item.discussionUrl ? '<a class="tag" href="' + esc(item.discussionUrl) + '" target="_blank" rel="noopener">讨论</a>' : '') +
    '<a class="evidence" href="' + esc(ev.url || item.url) + '" target="_blank" rel="noopener" title="' + esc(title) + '">证据 ↗</a>' +
    '</div></div>' + media + '</div></article>';
}

/* ---------- 素材（只展示来源站点真实给出的图，不生成假图） ---------- */
const AVATAR_SOURCES = new Set(['github', 'github-trending']);
function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function mediaHtml(item, kind, color) {
  const img = item.image;
  if (!img) {
    return '<div class="thumb noimg" style="--kc:' + color + '" title="该来源没有提供封面图（不使用 AI 生成图）">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 5h16v14H4z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M4 15l4.5-4.5 3.5 3.5 3-2.5L20 15" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="9" cy="9" r="1.4" fill="currentColor"/></svg>' +
      '<span>无素材</span></div>';
  }
  const isAvatar = AVATAR_SOURCES.has(item.source);
  const label = item.imageSource || (isAvatar ? '仓库头像' : '站点封面');
  const tip = label + ' · 来源：' + (domainOf(img) || '原站') + '\n图片地址：' + img;
  return '<figure class="media">' +
    '<img class="thumb' + (isAvatar ? ' avatar' : ' src-thumb') + '" src="' + esc(img) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" title="' + esc(tip) + '" onerror="this.classList.add(&quot;broken&quot;);this.parentNode.classList.add(&quot;broken&quot;)" />' +
    '<figcaption class="media-tag' + (item.imageSource ? '' : ' derived') + '"><b>' + esc(label) + '</b></figcaption>' +
    '</figure>';
}

function applyFilter() {
  const q = state.query.trim().toLowerCase();
  let list = state.all.filter((item) => {
    if (state.kind !== 'all' && item.kind !== state.kind) return false;
    if (state.source && item.source !== state.source) return false;
    if (!q) return true;
    const hay = (item.title + ' ' + (item.summary || '') + ' ' + (item.sourceLabel || '') + ' ' + (item.tags || []).join(' ')).toLowerCase();
    return hay.includes(q);
  });
  if (state.byHeat) list = [...list].sort((a, b) => (b.heat || 0) - (a.heat || 0));
  state.filtered = list;
  const slice = list.slice(0, state.shown);
  $('list').innerHTML = slice.length
    ? slice.map(cardHtml).join('')
    : '<div class="empty">没有匹配的条目，换个关键词试试。</div>';
  $('count').textContent = list.length + ' 条' + (list.length > slice.length ? ' · 显示 ' + slice.length : '');
  $('more').hidden = list.length <= state.shown;
  $('more').textContent = '加载更多（还有 ' + Math.max(0, list.length - state.shown) + ' 条）';
}

function fillSourceOptions() {
  const counts = new Map();
  const labels = new Map();
  for (const item of state.all) {
    counts.set(item.source, (counts.get(item.source) || 0) + 1);
    if (!labels.has(item.source)) labels.set(item.source, item.sourceLabel || item.source);
  }
  const options = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  $('source').innerHTML = '<option value="">全部来源</option>' + options
    .map(([id, count]) => '<option value="' + esc(id) + '">' + esc(labels.get(id)) + ' (' + count + ')</option>')
    .join('');
}

/* ---------- 素材来源面板 ---------- */
function renderMedia(items) {
  const total = items.length;
  const withImg = items.filter((item) => item.image).length;
  const bySource = new Map();
  const byDomain = new Map();
  for (const item of items) {
    if (!item.image) continue;
    const key = item.imageSource || '站点封面';
    bySource.set(key, (bySource.get(key) || 0) + 1);
    const d = domainOf(item.image);
    if (d) byDomain.set(d, (byDomain.get(d) || 0) + 1);
  }
  const rows = [...bySource.entries()].sort((a, b) => b[1] - a[1]);
  const max = rows.reduce((m, row) => Math.max(m, row[1]), 1);
  const pct = total ? Math.round((withImg / total) * 100) : 0;
  const parts = [];
  parts.push('<div class="media-kpi"><b>' + withImg + '</b><span> / ' + total + ' 条带真实缩略图（' + pct + '%）</span></div>');
  parts.push('<div class="bar"><span class="label">真实图</span><span class="track"><span class="fill" style="width:' + pct + '%"></span></span><span class="num">' + pct + '%</span></div>');
  parts.push(rows.slice(0, 6).map((row) => '<div class="bar"><span class="label">' + esc(row[0]) + '</span><span class="track"><span class="fill" style="width:' + Math.round((row[1] / max) * 100) + '%"></span></span><span class="num">' + row[1] + '</span></div>').join(''));
  const doms = [...byDomain.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  parts.push('<div class="sub">图片来源域名</div><div class="domain-cloud">' + doms.map((row) =>
    '<span class="dc" title="' + esc(row[0]) + ' · ' + row[1] + ' 张">' + esc(row[0]) + '<i>' + row[1] + '</i></span>').join('') + '</div>');
  parts.push('<p class="muted" style="margin:10px 0 0;font-size:11px;line-height:1.6">缩略图全部来自来源站点自己提供的图片（RSS 媒体字段 / 官方卡片 / 视频封面 / 仓库头像），<b>没有一张是 AI 生成的</b>；取不到图的条目显示「无素材」，不拿占位图充数。</p>');
  $('media-body').innerHTML = parts.join('');
}

function setupTheme() {
  const saved = localStorage.getItem('ai-world-theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  $('theme').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ai-world-theme', next);
  });
}

function setupShortcuts() {
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== $('q')) {
      event.preventDefault();
      $('q').focus();
    } else if (event.key === 'Escape') {
      if ($('q').value) {
        $('q').value = '';
        state.query = '';
        applyFilter();
      }
      $('q').blur();
    }
  });
  window.addEventListener('scroll', () => {
    document.querySelector('.topbar').classList.toggle('scrolled', window.scrollY > 8);
  }, { passive: true });
}

async function main() {
  setupTheme();
  setupShortcuts();
  startClock();

  const [site, feed, github, dsh, sources, trend, topics] = await Promise.all([
    loadJson('./data/site.json', {}),
    loadJson('./data/feed.json', { items: [] }),
    loadJson('./data/github.json', {}),
    loadJson('./data/dsh.json', {}),
    loadJson('./data/sources.json', {}),
    loadJson('./data/trend.json', { hours: [] }),
    loadJson('./data/topics.json', { words: [] }),
  ]);

  state.all = feed.items || [];
  renderKpis(site, state.all);
  renderSpark(trend);
  renderTicker(state.all);
  renderTabs();
  renderDonut((site && site.stats && site.stats.byKind) || {});
  renderCloud(topics);
  fillSourceOptions();
  renderGithub(github);
  renderDsh(dsh);
  renderSources(sources);
  renderMedia(state.all);
  applyFilter();

  $('q').addEventListener('input', (event) => { state.query = event.target.value; state.shown = PAGE; applyFilter(); });
  $('source').addEventListener('change', (event) => { state.source = event.target.value; state.shown = PAGE; applyFilter(); });
  $('sortByHeat').addEventListener('change', (event) => { state.byHeat = event.target.checked; applyFilter(); });
  $('more').addEventListener('click', () => { state.shown += PAGE; applyFilter(); });

  const generated = (site && site.feedGeneratedAt) || feed.generatedAt;
  $('foot-meta').textContent = 'AI 大世界 · 每小时自动采集 · 最近采集 ' +
    (generated ? new Date(generated).toLocaleString('zh-CN', { hour12: false }) : '未知') +
    ' · 库内 ' + state.all.length + ' 条';
}

main();
