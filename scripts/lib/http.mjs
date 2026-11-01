const UA = 'ai-world-radar/1.0 (+https://github.com/123caiji/ai-world)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 同一 host 的进程内最小请求间隔。
// arXiv API 使用条款：同一客户端请求不得密集到每 3 秒一次以上；并发采集时 arxiv 与 arxiv-more
// 两个源会同时打 export.arxiv.org，互相踩出 HTTP 429。这里按 host 串行排队，跨源共享。
const HOST_MIN_GAP_MS = { 'export.arxiv.org': 3200, 'arxiv.org': 3200 };
const lastHitAt = new Map();
let paceChain = Promise.resolve();

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

async function pace(url) {
  const gap = HOST_MIN_GAP_MS[hostOf(url)];
  if (!gap) return;
  const turn = paceChain.then(async () => {
    const last = lastHitAt.get(hostOf(url)) || 0;
    const wait = gap - (Date.now() - last);
    if (wait > 0) await sleep(wait);
    lastHitAt.set(hostOf(url), Date.now());
  });
  paceChain = turn.catch(() => {});
  await turn;
}

// 429/5xx 属于"喘口气再试"；4xx 的参数类错误重试没意义。
const RETRY_STATUSES = [408, 425, 429, 500, 502, 503, 504];
const MAX_WAIT_MS = 30000;

function backoffMs(attempt) {
  return Math.min(MAX_WAIT_MS, 800 * 2 ** attempt + Math.floor(Math.random() * 250));
}

function retryAfterMs(headers) {
  const raw = headers && typeof headers.get === 'function' ? headers.get('retry-after') : null;
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.min(MAX_WAIT_MS, Math.max(0, seconds * 1000));
  const at = Date.parse(raw);
  if (Number.isFinite(at)) return Math.min(MAX_WAIT_MS, Math.max(0, at - Date.now()));
  return null;
}

export async function fetchText(url, opts = {}) {
  const { headers = {}, timeoutMs = 25000, retries = 2, token, retryStatuses = RETRY_STATUSES } = opts;
  const h = { 'user-agent': UA, accept: '*/*', ...headers };
  if (token) h.authorization = 'Bearer ' + token;
  const started = Date.now();
  let lastErr = null;
  let lastRes = null;
  for (let i = 0; i <= retries; i++) {
    await pace(url);
    try {
      const res = await fetch(url, { headers: h, signal: AbortSignal.timeout(timeoutMs) });
      const text = await res.text();
      const out = {
        ok: res.ok,
        status: res.status,
        text,
        latencyMs: Date.now() - started,
        fetchedAt: new Date().toISOString(),
        url,
        attempts: i + 1,
      };
      if (res.ok || !retryStatuses.includes(res.status) || i === retries) return out;
      lastRes = out;
      await sleep(retryAfterMs(res.headers) ?? backoffMs(i));
    } catch (err) {
      lastErr = err;
      if (i < retries) await sleep(backoffMs(i));
    }
  }
  if (lastRes) return lastRes;
  throw new Error('fetch failed: ' + url + ' :: ' + (lastErr && lastErr.message ? lastErr.message : String(lastErr)));
}

export async function fetchJsonPost(url, body, opts = {}) {
  const { headers = {}, timeoutMs = 25000, retries = 1, contentType = 'application/json' } = opts;
  const h = { 'user-agent': UA, accept: 'application/json', 'content-type': contentType, ...headers };
  const payload = contentType === 'application/json' ? JSON.stringify(body) : String(body);
  const started = Date.now();
  let lastErr = null;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { method: 'POST', headers: h, body: payload, signal: AbortSignal.timeout(timeoutMs) });
      const text = await res.text();
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url + ' :: ' + text.slice(0, 180));
      let json;
      try { json = JSON.parse(text); } catch (err) { throw new Error('bad JSON from ' + url + ' :: ' + String(err).slice(0, 120)); }
      return { json, status: res.status, latencyMs: Date.now() - started, fetchedAt: new Date().toISOString() };
    } catch (err) {
      lastErr = err;
      if (i < retries) await sleep(700 * (i + 1));
    }
  }
  throw lastErr;
}

export async function fetchJson(url, opts = {}) {
  const res = await fetchText(url, { ...opts, headers: { accept: 'application/json', ...(opts.headers || {}) } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url + ' :: ' + res.text.slice(0, 180));
  let json;
  try {
    json = JSON.parse(res.text);
  } catch (err) {
    throw new Error('bad JSON from ' + url + ' :: ' + String(err).slice(0, 120));
  }
  return { json, status: res.status, latencyMs: res.latencyMs, fetchedAt: res.fetchedAt };
}
