const UA = 'ai-world-radar/1.0 (+https://github.com/123caiji/ai-world)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchText(url, opts = {}) {
  const { headers = {}, timeoutMs = 25000, retries = 2, token } = opts;
  const h = { 'user-agent': UA, accept: '*/*', ...headers };
  if (token) h.authorization = 'Bearer ' + token;
  const started = Date.now();
  let lastErr = null;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: h, signal: AbortSignal.timeout(timeoutMs) });
      const text = await res.text();
      return { ok: res.ok, status: res.status, text, latencyMs: Date.now() - started, fetchedAt: new Date().toISOString(), url };
    } catch (err) {
      lastErr = err;
      if (i < retries) await sleep(700 * (i + 1));
    }
  }
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
