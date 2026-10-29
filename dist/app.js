const PAGE = 24;
const KIND_LABEL = {
  news: '新闻', paper: '论文', repo: '开源', release: '发布',
  model: '模型', plugin: '插件', discussion: '热帖', product: '产品',
};
const KIND_ORDER = ['all', 'news', 'paper', 'repo', 'model', 'plugin', 'discussion', 'product', 'release'];

const state = { all: [], filtered: [], shown: PAGE, kind: 'all', query: '', source: '', byHeat: false };

const $ = (id) => document.getElementById(id);

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function relTime(isoString) {
  if (!isoString) return '';
  const then = new Date(isoString).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return minutes + ' 分钟前';
  const hours = Math.round(minutes / 60);
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

function renderStats(site) {
  const stats = (site && site.stats) || {};
  const km = stats.byKind || {};
  const rows = [
    ['条目', stats.items || 0],
    ['本轮新增', stats.fresh || 0],
    ['新闻', km.news || 0],
    ['论文', km.paper || 0],
    ['开源', (km.repo || 0) + (km.release || 0)],
    ['模型', km.model || 0],
    ['插件', km.plugin || 0],
    ['热帖', km.discussion || 0],
    ['数据源', (stats.sourcesOk || 0) + '/' + (stats.sourcesTotal || 0)],
  ];
  $('stats').innerHTML = rows
    .map(([label, value]) => '<div class="stat"><b>' + escapeHtml(value) + '</b>' + escapeHtml(label) + '</div>')
    .join('');
}

function renderTabs() {
  const counts = {};
  for (const item of state.all) counts[item.kind] = (counts[item.kind] || 0) + 1;
  const tabs = KIND_ORDER.filter((kind) => kind === 'all' || counts[kind]);
  $('tabs').innerHTML = tabs
    .map((kind) => {
      const label = kind === 'all' ? '全部' : (KIND_LABEL[kind] || kind);
      const count = kind === 'all' ? state.all.length : counts[kind];
      return '<button class="tab' + (state.kind === kind ? ' active' : '') + '" data-kind="' + kind + '" type="button">' + escapeHtml(label) + ' <span class="muted">' + count + '</span></button>';
    })
    .join('');
  for (const button of $('tabs').querySelectorAll('.tab')) {
    button.addEventListener('click', () => {
      state.kind = button.dataset.kind;
      state.shown = PAGE;
      renderTabs();
      applyFilter();
    });
  }
}

function renderSources(sources) {
  const rows = (sources && sources.sources) || [];
  $('sources-body').innerHTML = rows.length
    ? '<table class="src-table">' + rows.map((row) => {
        const ok = row.status === 'ok';
        return '<tr><td><span class="dot ' + (ok ? 'ok' : 'err') + '"></span>' + escapeHtml(row.label) + '</td><td style="text-align:right; white-space:nowrap">' +
          (ok ? escapeHtml(row.items) + ' 条' : '<span style="color:var(--bad)">失败</span>') +
          '</td><td style="text-align:right; color:var(--muted)">' + (row.latencyMs ? Math.round(row.latencyMs / 100) / 10 + 's' : '') + '</td></tr>' +
          (ok ? '' : '<tr><td colspan="3" style="color:var(--bad); font-size:11px">' + escapeHtml(String(row.error || '').slice(0, 110)) + '</td></tr>');
      }).join('') + '</table>'
    : '<p class="muted">暂无数据</p>';
}

function renderGithub(github) {
  const data = github || {};
  const parts = [];
  if (data.newRepos && data.newRepos.length) {
    parts.push('<div class="sub">最近两周新仓库</div><ul class="mini">' + data.newRepos.slice(0, 6).map((repo) =>
      '<li><a href="' + escapeHtml(repo.url) + '" target="_blank" rel="noopener">' + escapeHtml(repo.full) + '</a><span class="num">' + escapeHtml(repo.stars) + ' ★</span></li>'
    ).join('') + '</ul>');
  }
  if (data.risers && data.risers.length) {
    parts.push('<div class="sub">涨星榜</div><ul class="mini">' + data.risers.slice(0, 6).map((repo) =>
      '<li><a href="' + escapeHtml(repo.url) + '" target="_blank" rel="noopener">' + escapeHtml(repo.full) + '</a><span class="num">+' + escapeHtml(repo.delta) + ' ★</span></li>'
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
      parts.push('<div style="margin-bottom:6px"><span class="tag">#' + escapeHtml(topic) + '</span><ul class="mini" style="margin-top:5px">' +
        rows.slice(0, 3).map((row) => '<li><a href="' + escapeHtml(row.url) + '" target="_blank" rel="noopener">' + escapeHtml(row.full) + '</a><span class="num">' + escapeHtml(row.stars) + ' ★</span></li>').join('') +
        '</ul></div>');
    }
  }
  if (data.releases && data.releases.length) {
    parts.push('<div class="sub">新版本</div><ul class="mini">' + data.releases.slice(0, 6).map((rel) =>
      '<li><a href="' + escapeHtml(rel.url) + '" target="_blank" rel="noopener">' + escapeHtml(rel.repo + ' ' + rel.tag) + '</a><span class="num">' + escapeHtml(relTime(rel.publishedAt)) + '</span></li>'
    ).join('') + '</ul>');
  }
  if (data.ownRepos && data.ownRepos.length) {
    parts.push('<div class="sub">我的仓库</div><ul class="mini">' + data.ownRepos.map((repo) =>
      '<li><a href="' + escapeHtml(repo.url) + '" target="_blank" rel="noopener">' + escapeHtml(repo.full) + '</a><span class="num">' + escapeHtml(repo.stars) + ' ★' + (repo.delta ? ' · +' + escapeHtml(repo.delta) : '') + '</span></li>'
    ).join('') + '</ul>');
  }
  $('github-body').innerHTML = parts.length ? parts.join('') : '<p class="muted">本次没有抓取到 GitHub 数据（检查仓库权限或限流）。</p>';
}

function renderDsh(dsh) {
  const data = dsh || {};
  const cats = data.categories || [];
  const max = cats.reduce((m, row) => Math.max(m, row.count), 1);
  const parts = [
    '<div class="stats" style="margin-bottom:10px"><div class="stat"><b>' + escapeHtml(data.total || 0) + '</b>个插件</div><div class="stat"><b>' + escapeHtml(data.newCount || 0) + '</b>本轮新增</div></div>',
    cats.slice(0, 6).map((row) => '<div class="bar"><span class="label">' + escapeHtml(row.name) + '</span><span class="track"><span class="fill" style="width:' + Math.round(row.count / max * 100) + '%"></span></span><span class="num">' + escapeHtml(row.count) + '</span></div>').join(''),
  ];
  if (data.recent && data.recent.length) {
    parts.push('<div class="sub">最近更新</div><ul class="mini">' + data.recent.slice(0, 5).map((row) =>
      '<li><a href="' + escapeHtml(row.url) + '" target="_blank" rel="noopener">' + escapeHtml(row.title) + '</a><span class="num">v' + escapeHtml(row.version || '?') + '</span></li>'
    ).join('') + '</ul>');
  }
  $('dsh-body').innerHTML = parts.join('');
}

function cardHtml(item) {
  const kind = item.kind || 'news';
  const tags = (item.tags || []).slice(0, 4).map((tag) => '<span class="tag">' + escapeHtml(tag) + '</span>').join(' ');
  const evidence = item.evidence || {};
  const evidenceTitle = '抓取端点：' + (evidence.url || item.url) + '\n抓取时间：' + (evidence.fetchedAt || '-') + '\nHTTP 状态：' + (evidence.httpStatus || '-') + '\n定位：' + (evidence.pointer || '-');
  return [
    '<article class="card">',
    '<div class="card-head">',
    '<span class="kind kind-' + escapeHtml(kind) + '">' + escapeHtml(KIND_LABEL[kind] || kind) + '</span>',
    '<span>' + escapeHtml(item.sourceLabel || item.source) + '</span>',
    '<span>·</span>',
    '<span>' + escapeHtml(relTime(item.publishedAt || item.firstSeenAt)) + '</span>',
    '<span class="heat">热度 ' + escapeHtml(item.heat == null ? '-' : item.heat) + '</span>',
    '</div>',
    '<h2><a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener">' + escapeHtml(item.title) + '</a></h2>',
    item.summary ? '<p class="summary">' + escapeHtml(item.summary) + '</p>' : '',
    '<div class="meta">',
    tags,
    item.scoreLabel ? '<span class="heat" style="margin-left:0">' + escapeHtml(item.scoreLabel) + '</span>' : '',
    '<a class="evidence" href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener" title="' + escapeHtml(evidenceTitle) + '">证据</a>',
    '</div>',
    '</article>',
  ].join('');
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
  $('more').hidden = list.length <= state.shown;
  $('more').textContent = '加载更多（还有 ' + Math.max(0, list.length - state.shown) + ' 条）';
}

function fillSourceOptions() {
  const counts = new Map();
  for (const item of state.all) counts.set(item.source, (counts.get(item.source) || 0) + 1);
  const options = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  $('source').innerHTML = '<option value="">全部来源</option>' + options
    .map(([id, count]) => '<option value="' + escapeHtml(id) + '">' + escapeHtml(id) + ' (' + count + ')</option>')
    .join('');
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

async function main() {
  setupTheme();
  const [site, feed, github, dsh, sources] = await Promise.all([
    loadJson('./data/site.json', {}),
    loadJson('./data/feed.json', { items: [] }),
    loadJson('./data/github.json', {}),
    loadJson('./data/dsh.json', {}),
    loadJson('./data/sources.json', {}),
  ]);

  state.all = feed.items || [];
  renderStats(site);
  renderTabs();
  fillSourceOptions();
  renderGithub(github);
  renderDsh(dsh);
  renderSources(sources);
  applyFilter();

  $('q').addEventListener('input', (event) => { state.query = event.target.value; state.shown = PAGE; applyFilter(); });
  $('source').addEventListener('change', (event) => { state.source = event.target.value; state.shown = PAGE; applyFilter(); });
  $('sortByHeat').addEventListener('change', (event) => { state.byHeat = event.target.checked; applyFilter(); });
  $('more').addEventListener('click', () => { state.shown += PAGE; applyFilter(); });

  const generated = (site && site.feedGeneratedAt) || feed.generatedAt;
  $('foot-meta').textContent = 'AI 大世界 · 每小时自动采集 · 最近采集 ' + (generated ? new Date(generated).toLocaleString('zh-CN', { hour12: false }) : '未知');
}

main();
