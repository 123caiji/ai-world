import { fetchJson, fetchText } from '../lib/http.mjs';
import { makeItem } from '../lib/util.mjs';

const API = 'https://api.github.com';
const STALE_HOURS = 20;
const MAX_TRACKED_REPOS = 260;

function dayOffset(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

async function ghTry(url, token) {
  const res = await fetchText(url, {
    token,
    headers: { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
    timeoutMs: 25000,
  });
  let json = null;
  try {
    json = JSON.parse(res.text);
  } catch {
    json = null;
  }
  return { json, status: res.status, latencyMs: res.latencyMs, fetchedAt: res.fetchedAt };
}

async function ghJson(url, token) {
  const { json, status, latencyMs, fetchedAt } = await fetchJson(url, {
    token,
    headers: { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
    timeoutMs: 25000,
  });
  return { json, status, latencyMs, fetchedAt };
}

const SPAM_PATTERN = /(crack|keygen|license key|activation|serial key|torrent|free download|full version|repack|pre-?activated|patcher|rpocket|resocket|\.apk\b|fps optimizer)/i;
const AI_RELEVANT = /\b(ai|a\.i\.|llm|llms|agent|agents|agentic|mcp|rag|gpt|nlp|transformer|diffusion|inference|embedding|fine-?tuning|quantization|multimodal|deepseek|qwen|llama|claude|gemini)\b/i;

function ownerAvatar(full) {
  const owner = String(full || '').split('/')[0];
  return owner ? 'https://github.com/' + owner + '.png?size=96' : '';
}

function isJunkRepo(repo, minStars) {
  if (!repo || repo.archived || repo.fork || repo.disabled) return true;
  if (!repo.description || !String(repo.description).trim()) return true;
  if (!repo.language) return true;
  if ((repo.stargazers_count || 0) < minStars) return true;
  const hay = [repo.full_name, repo.description].join(' ');
  if (SPAM_PATTERN.test(hay)) return true;
  if (!AI_RELEVANT.test(hay)) return true;
  return false;
}

function deltaSince(history, nowMs) {
  if (!Array.isArray(history) || history.length === 0) return null;
  const cutoff = nowMs - STALE_HOURS * 3600000;
  const older = history.filter((point) => new Date(point.at).getTime() <= cutoff);
  const base = older.length ? older[older.length - 1] : history[0];
  if (!base || typeof base.stars !== 'number') return null;
  return { delta: history[history.length - 1].stars - base.stars, since: base.at };
}

export const source = {
  id: 'github',
  label: 'GitHub · 新仓库 / 涨星 / Releases',
  kind: 'repo',
  homepage: 'https://github.com/trending',
  async run(ctx) {
    const token = ctx.token;
    const cfg = ctx.config;
    if (!token) throw new Error('缺少 GH_TOKEN（GitHub Actions 里用 secrets.GITHUB_TOKEN）');
    const nowMs = Date.now();
    const since = dayOffset(cfg.newRepoDays || 14);
    const stars = ctx.state.stars || {};
    const releases = ctx.state.releases || {};
    const warnings = [];
    const items = [];
    const newRepos = [];
    const risers = [];
    const releaseRows = [];
    let lastStatus = 200;
    let totalLatency = 0;

    function recordStars(full, value) {
      if (!full || typeof value !== 'number') return;
      const history = Array.isArray(stars[full]) ? stars[full] : [];
      const lastPoint = history[history.length - 1];
      const fresh = !lastPoint || nowMs - new Date(lastPoint.at).getTime() > 55 * 60000;
      if (fresh) history.push({ at: new Date(nowMs).toISOString(), stars: value });
      const kept = history.slice(-48);
      stars[full] = kept;
    }

    const minStars = cfg.minStars || 20;
    const hubTopics = (cfg.newRepoTopics || ['llm', 'ai', 'ai-agents', 'mcp', 'rag', 'agent']).slice(0, 6);
    const seenRepo = new Set();
    for (const hubTopic of hubTopics) {
      const searchUrl = API + '/search/repositories?q=' + encodeURIComponent('created:>' + since + ' stars:>=' + minStars + ' topic:' + hubTopic) + '&sort=stars&order=desc&per_page=15';
      let searched;
      try {
        searched = await ghJson(searchUrl, token);
      } catch (err) {
        warnings.push('new-repo search topic:' + hubTopic + ' 失败：' + String(err.message || err).slice(0, 100));
        continue;
      }
      lastStatus = searched.status;
      totalLatency += searched.latencyMs;
      for (const repo of searched.json.items || []) {
        if (seenRepo.has(repo.full_name)) continue;
        if (isJunkRepo(repo, minStars)) continue;
        seenRepo.add(repo.full_name);
        recordStars(repo.full_name, repo.stargazers_count);
        newRepos.push({
          full: repo.full_name,
          url: repo.html_url,
          description: repo.description || '',
          stars: repo.stargazers_count,
          language: repo.language || '',
          createdAt: repo.created_at,
          pushedAt: repo.pushed_at,
          topics: (repo.topics || []).slice(0, 6),
        });
        items.push(makeItem({
          kind: 'repo',
          source: 'github',
          sourceLabel: 'GitHub 新仓库',
          title: repo.full_name + ' · ' + (repo.stargazers_count || 0) + ' stars',
          url: repo.html_url,
          summary: (repo.description || '（无简介）') + (repo.language ? ' · ' + repo.language : '') + ' · #' + hubTopic,
          publishedAt: repo.created_at,
          score: repo.stargazers_count,
          scoreLabel: (repo.stargazers_count || 0) + ' stars',
          tags: ['开源', '新仓库'].concat((repo.topics || []).slice(0, 2)),
          image: ownerAvatar(repo.full_name),
          imageSource: 'GitHub 仓库头像',
          evidence: {
            url: searchUrl,
            fetchedAt: searched.fetchedAt,
            httpStatus: searched.status,
            pointer: 'search item full_name=' + repo.full_name + ' created=' + repo.created_at,
          },
        }));
      }
    }

    const topics = (cfg.topics || []).slice(0, 5);
    const topicRows = [];
    for (const topic of topics) {
      try {
        const url = API + '/search/repositories?q=' + encodeURIComponent('topic:' + topic + ' stars:>=' + (cfg.topicMinStars || 800)) + '&sort=stars&order=desc&per_page=6';
        const res = await ghJson(url, token);
        lastStatus = res.status;
        totalLatency += res.latencyMs;
        for (const repo of res.json.items || []) {
          recordStars(repo.full_name, repo.stargazers_count);
          topicRows.push({ topic, full: repo.full_name, stars: repo.stargazers_count, url: repo.html_url });
        }
      } catch (err) {
        warnings.push('topic ' + topic + ' 失败：' + String(err.message || err).slice(0, 120));
      }
    }

    const watch = Array.from(new Set([].concat(cfg.repos || [], cfg.ownRepos || [])));
    const ownRows = [];
    for (const full of watch) {
      try {
        const res = await ghJson(API + '/repos/' + full, token);
        lastStatus = res.status;
        totalLatency += res.latencyMs;
        const repo = res.json;
        recordStars(full, repo.stargazers_count);
        const change = deltaSince(stars[full], nowMs);
        const row = {
          full,
          url: repo.html_url,
          stars: repo.stargazers_count,
          delta: change ? change.delta : 0,
          deltaSince: change ? change.since : null,
          pushedAt: repo.pushed_at,
          description: repo.description || '',
          language: repo.language || '',
          mine: (cfg.ownRepos || []).includes(full),
        };
        if (row.mine) ownRows.push(row);
        if (change && change.delta >= (cfg.riserDelta || 120)) {
          risers.push(row);
          items.push(makeItem({
            kind: 'repo',
            source: 'github',
            sourceLabel: 'GitHub 涨星榜',
            title: full + ' 涨 ' + change.delta + ' 星',
            url: repo.html_url,
            summary: (repo.description || '（无简介）') + ' · 当前 ' + repo.stargazers_count + ' stars',
            publishedAt: new Date(nowMs).toISOString(),
            score: change.delta,
            scoreLabel: '涨 ' + change.delta + ' 星 / ' + STALE_HOURS + 'h',
            tags: ['开源', '涨星'],
            image: ownerAvatar(full),
            imageSource: 'GitHub 仓库头像',
            evidence: {
              url: API + '/repos/' + full,
              fetchedAt: res.fetchedAt,
              httpStatus: res.status,
              pointer: 'stargazers_count=' + repo.stargazers_count + ' · 对比 ' + change.since,
            },
          }));
        }
        if (cfg.ownRepos && cfg.ownRepos.includes(full)) continue;
        const rel = await ghTry(API + '/repos/' + full + '/releases/latest', token);
        totalLatency += rel.latencyMs;
        if (rel.status === 404 || !rel.json) continue;
        const release = rel.json;
        if (!release || !release.tag_name || releases[full] === release.tag_name) continue;
        releases[full] = release.tag_name;
        releaseRows.push({
          repo: full,
          tag: release.tag_name,
          name: release.name || release.tag_name,
          url: release.html_url,
          publishedAt: release.published_at,
        });
        items.push(makeItem({
          kind: 'release',
          source: 'github',
          sourceLabel: 'GitHub Release',
          title: full + ' 发布 ' + release.tag_name,
          url: release.html_url,
          summary: (release.body || '').replace(/\s+/g, ' ').slice(0, 300),
          publishedAt: release.published_at,
          score: null,
          scoreLabel: release.prerelease ? '预发布' : '正式版',
          tags: ['开源', 'Release'],
          image: ownerAvatar(full),
          imageSource: 'GitHub 仓库头像',
          evidence: {
            url: API + '/repos/' + full + '/releases/latest',
            fetchedAt: rel.fetchedAt,
            httpStatus: rel.status,
            pointer: 'release tag_name=' + release.tag_name,
          },
        }));
      } catch (err) {
        warnings.push(full + ' 失败：' + String(err.message || err).slice(0, 120));
      }
    }

    const tracked = new Map();
    for (const full of Object.keys(stars)) {
      const history = stars[full];
      const last = history[history.length - 1];
      if (last && nowMs - new Date(last.at).getTime() < 8 * 86400000) tracked.set(full, history);
    }
    if (tracked.size > MAX_TRACKED_REPOS) {
      const sorted = [...tracked.entries()].sort((a, b) => {
        const av = a[1][a[1].length - 1].stars || 0;
        const bv = b[1][b[1].length - 1].stars || 0;
        return bv - av;
      });
      const pruned = {};
      for (const [full, history] of sorted.slice(0, MAX_TRACKED_REPOS)) pruned[full] = history;
      ctx.draft.stars = pruned;
    } else {
      ctx.draft.stars = Object.fromEntries(tracked);
    }
    ctx.draft.releases = releases;
    ctx.draft.github = {
      generatedAt: new Date(nowMs).toISOString(),
      since,
      newRepos,
      risers,
      releases: releaseRows,
      topics: topicRows,
      ownRepos: ownRows,
      warnings: warnings.slice(0, 8),
    };

    return {
      items,
      httpStatus: lastStatus,
      latencyMs: totalLatency,
      count: items.length,
      warnings: warnings.slice(0, 8),
    };
  },
};
