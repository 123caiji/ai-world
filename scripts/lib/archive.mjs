import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// 归档文件按 id 去重：feed.json 只保留最近 MAX_FEED 条，
// 掉出榜单的老条目会被重新判成「新」，同一 id 反复写进 archive/YYYY-MM.jsonl。
// 2026-11 单月涨到 36 MB 就是这么来的。这里两件事：
//   1) archiveIdSet(months) 给出当月/上月已归档的 id，写入前先过滤；
//   2) compactArchiveFile(file, limitBytes) 在文件超阈值时原地压一遍，按 id 保留首次出现。

export function archiveIdSet(dir, months) {
  const ids = new Set();
  for (const month of months) {
    const file = join(dir, month + '.jsonl');
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line) continue;
      try {
        const row = JSON.parse(line);
        if (row && row.id) ids.add(row.id);
      } catch {
        // 坏行跳过：宁可少去重，也不能让采集崩掉
      }
    }
  }
  return ids;
}

export function compactArchiveFile(file, limitBytes) {
  if (!existsSync(file)) return null;
  const beforeBytes = statSync(file).size;
  if (beforeBytes <= limitBytes) return null;
  const seen = new Set();
  const kept = [];
  let dropped = 0;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      dropped += 1;
      continue;
    }
    if (!row.id || seen.has(row.id)) {
      dropped += 1;
      continue;
    }
    seen.add(row.id);
    kept.push(line);
  }
  writeFileSync(file, kept.join('\n') + '\n', 'utf8');
  return { beforeBytes, afterBytes: statSync(file).size, rows: kept.length, dropped };
}
