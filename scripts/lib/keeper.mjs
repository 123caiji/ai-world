import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateWindow } from './window.mjs';

/**
 * 自愈链（keeper）
 *
 * 背景：GitHub Actions 的 schedule 只是「尽力而为」——高峰期会延迟几十分钟，
 * 更糟的是会整段丢拍（实测 cron "7 * * * *" 在 4 小时里一次都没触发，
 * 线上数据因此停在 4 小时前）。所以采集节奏不能交给 cron 决定。
 *
 * 做法：
 *  1. 每轮 run 一开始就用 GITHUB_TOKEN 把「下一轮」workflow_dispatch 排进队列；
 *  2. 本轮如果窗口还没开，就在 job 里睡到窗口打开再采集（job 上限 6 小时，够）；
 *  3. 于是每 165 分钟一采集由链条自己保证，cron 只当兜底。
 *
 * workflow_dispatch 是 GITHUB_TOKEN 触发新 run 的例外（push 才会被抑制），
 * 所以这条链不需要 PAT、不需要 workflow scope。
 */

const WORKFLOW_FILE = 'radar.yml';
const DEFAULT_MAX_WAIT_MIN = 180;
const HEARTBEAT_EVERY_MS = 10 * 60000;

/** 睡眠分片：1 分钟，便于打印进度、也让取消能及时生效 */
export const SLEEP_CHUNK_MS = Number(process.env.KEEPER_SLEEP_CHUNK_MS || 60000);

/**
 * 把检出同步到远端最新 main。
 *
 * 为什么需要：workflow_dispatch 触发的 run 检出的是「派发那一刻的 sha」，
 * 而不是「运行时最新的 main」。如果上一环在我 checkout 之后才把采集结果推上来，
 * 我这边看到的 site.json 就是旧的 → 误判窗口已开 → 白采一轮，最后 push 被拒（非快进）。
 * 实测出现过一次（run 41008410610 的「提交数据」失败）。
 *
 * 采集是在临时 runner 上跑的，工作区可以随便重置，所以直接 reset --hard 到 origin/main。
 */
export function syncToRemoteMain({ root = process.cwd(), log = console.log } = {}) {
  const git = (args) => execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  try {
    git(['fetch', '--no-tags', 'origin', 'main']);
    const head = git(['rev-parse', 'HEAD']);
    const remote = git(['rev-parse', 'origin/main']);
    if (head === remote) return { synced: false, head };
    git(['reset', '--hard', 'origin/main']);
    log('keeper: 检出 ' + head.slice(0, 7) + ' 落后远端 ' + remote.slice(0, 7) + '，已同步到最新 main 再判断窗口');
    return { synced: true, from: head, to: remote };
  } catch (err) {
    const message = String((err && err.message) || err).split('\n')[0];
    log('keeper: 同步远端 main 失败（' + message + '），按当前检出继续');
    return { synced: false, error: message };
  }
}

export function isActions() {
  return process.env.GITHUB_ACTIONS === 'true';
}

/** 读 config/keeper.json；文件缺失或坏掉一律按「关」处理，退回纯 cron 模式 */
export function readKeeperConfig(root) {
  const file = join(root, 'config', 'keeper.json');
  const fallback = { enabled: false, maxWaitMinutes: DEFAULT_MAX_WAIT_MIN };
  if (!existsSync(file)) return fallback;
  try {
    const cfg = JSON.parse(readFileSync(file, 'utf8'));
    const maxWait = Number(cfg.maxWaitMinutes);
    return {
      enabled: cfg.enabled !== false,
      maxWaitMinutes: maxWait > 0 ? maxWait : DEFAULT_MAX_WAIT_MIN,
    };
  } catch (error) {
    console.warn('keeper: config/keeper.json 解析失败，按关闭处理（' + error.message + '）');
    return fallback;
  }
}

export function readKeeperState(root) {
  try {
    return JSON.parse(readFileSync(join(root, 'data', 'keeper.json'), 'utf8'));
  } catch {
    return {};
  }
}

/** 合并写入 data/keeper.json：既是链条心跳，也是给前端看的调度状态 */
export function writeKeeperState(root, patch = {}) {
  const prev = readKeeperState(root);
  const chainRuns = Number.isFinite(prev.chainRuns) ? prev.chainRuns + 1 : 1;
  const next = { ...prev, ...patch, chainRuns, updatedAt: new Date().toISOString() };
  writeFileSync(join(root, 'data', 'keeper.json'), JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}

/**
 * 把下一轮排进队列。必须在本轮「干活之前」调用：
 * 这样即使本轮被取消/超时/报错，链子也不会断。
 */
export async function dispatchSuccessor({ reason = '' } = {}) {
  if (!isActions()) return { ok: false, skipped: 'not-in-actions' };
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
  if (!repo || !token) return { ok: false, error: '缺少 GITHUB_REPOSITORY 或 token' };
  const ref = process.env.GITHUB_REF_NAME || 'main';
  const url = 'https://api.github.com/repos/' + repo + '/actions/workflows/' + WORKFLOW_FILE + '/dispatches';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'ai-world-keeper',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ ref }),
    });
    const body = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      ref,
      reason,
      message: res.ok ? 'queued' : body.slice(0, 200),
      at: new Date().toISOString(),
    };
  } catch (error) {
    return { ok: false, error: error.message, ref, reason };
  }
}

/**
 * 睡到采集窗口打开（最长 maxWaitMinutes 分钟，默认 180）。
 * 每分钟醒一次重算窗口，每 10 分钟打一条进度，方便在 Actions 日志里看出它没死。
 */
export async function waitForWindow({ root, intervalMinutes, maxWaitMinutes, log = console.log }) {
  const startedAt = Date.now();
  const deadline = startedAt + Math.max(0, maxWaitMinutes) * 60000;
  let evaluated = evaluateWindow(root, { intervalMinutes });
  if (evaluated.collect) return { evaluated, waitedMinutes: 0 };

  log(
    'keeper: 窗口未到（上次采集 ' + Math.round(evaluated.sinceMinutes) + ' 分钟前），' +
    '本轮守候到窗口打开，最多等 ' + maxWaitMinutes + ' 分钟',
  );

  let lastBeat = startedAt;
  while (!evaluated.collect && Date.now() < deadline) {
    // 尽量精确睡到 due 那一刻，但每片不超过 SLEEP_CHUNK_MS，且不越过 deadline
    const untilDue = evaluated.nextDueAt ? new Date(evaluated.nextDueAt).getTime() - Date.now() : 0;
    const target = untilDue > 0 ? Math.min(SLEEP_CHUNK_MS, untilDue + 2000) : SLEEP_CHUNK_MS;
    const sleep = Math.max(1000, Math.min(target, deadline - Date.now()));
    await new Promise((resolve) => setTimeout(resolve, sleep));
    evaluated = evaluateWindow(root, { intervalMinutes });
    if (!evaluated.collect && Date.now() - lastBeat >= HEARTBEAT_EVERY_MS) {
      lastBeat = Date.now();
      log(
        'keeper: 已守候 ' + Math.round((Date.now() - startedAt) / 60000) + ' 分钟，' +
        '还差 ' + Math.max(0, Math.round((new Date(evaluated.nextDueAt).getTime() - Date.now()) / 60000)) + ' 分钟到窗口',
      );
    }
  }

  return { evaluated, waitedMinutes: Math.round((Date.now() - startedAt) / 60000) };
}
