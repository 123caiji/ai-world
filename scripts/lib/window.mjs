import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 采集窗口：定时器每小时都会尝试触发，但真正采集最长每 3 小时一次。
 * 好处是 GitHub 的 cron 延迟/丢拍不会造成「三小时错过一次」——
 * 只要某一轮尝试时发现上次采集已超过窗口，就立刻补跑。
 */
export const DEFAULT_INTERVAL_MIN = Number(process.env.COLLECT_INTERVAL_MIN || 165);
export const FORCE = process.env.FORCE_COLLECT === '1';
export const SKIP_MARKER = '.radar-skip';

export function lastCollectAt(root) {
  for (const rel of ['data/site.json', 'data/feed.json']) {
    try {
      const json = JSON.parse(readFileSync(join(root, rel), 'utf8'));
      const stamp = json.feedGeneratedAt || json.generatedAt;
      if (stamp) return new Date(stamp);
    } catch {
      /* 文件缺失/损坏就当没有历史 */
    }
  }
  return null;
}

export function minutesSince(date) {
  return date ? (Date.now() - date.getTime()) / 60000 : Number.POSITIVE_INFINITY;
}

export function humanMinutes(minutes) {
  if (!Number.isFinite(minutes)) return '无历史数据';
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return m + ' 分钟';
  return (Math.round(m / 6) / 10).toFixed(1).replace(/\.0$/, '') + ' 小时';
}

export function writeSkipMarker(root, payload) {
  writeFileSync(join(root, SKIP_MARKER), JSON.stringify(payload, null, 2) + '\n');
}

export function readSkipMarker(root) {
  const file = join(root, SKIP_MARKER);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return { skippedAt: null };
  }
}

export function clearSkipMarker(root) {
  const file = join(root, SKIP_MARKER);
  if (existsSync(file)) rmSync(file, { force: true });
}

/** 判断这轮要不要真采集；返回 { collect, sinceMinutes, lastCollect, intervalMinutes, nextDueAt } */
export function evaluateWindow(root, { force = FORCE, intervalMinutes = DEFAULT_INTERVAL_MIN } = {}) {
  const lastCollect = lastCollectAt(root);
  const since = minutesSince(lastCollect);
  const collect = force || intervalMinutes <= 0 || !Number.isFinite(since) || since >= intervalMinutes;
  return {
    collect,
    sinceMinutes: since,
    lastCollect,
    intervalMinutes,
    nextDueAt: Number.isFinite(since) && !collect
      ? new Date(lastCollect.getTime() + intervalMinutes * 60000)
      : null,
  };
}
