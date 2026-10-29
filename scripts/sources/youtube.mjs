import { fetchText } from '../lib/http.mjs';
import { decodeEntities, makeItem, stripHtml, toIso, trimText } from '../lib/util.mjs';

const CHANNELS = [
  { id: 'UCXUPKJO5MZQN11PqgIvyuvQ', name: 'Andrej Karpathy', label: 'Karpathy' },
  { id: 'UCNJ1Ymd5yFuUPtn21xtRbbw', name: 'AI Explained', label: 'AI Explained' },
  { id: 'UCbfYPyITQ-7l4upoX8nvctg', name: 'Two Minute Papers', label: 'Two Minute Papers' },
  { id: 'UChpleBmo18P08aKCIgti38g', name: 'Matt Wolfe', label: 'Matt Wolfe' },
  { id: 'UCMLtBahI5DMrt0NPvDSoIRQ', name: 'Machine Learning Street Talk', label: 'MLST' },
];

function parseChannel(xml) {
  const blocks = xml.match(/<entry>[\s\S]*?<\/entry>/gi) || [];
  const out = [];
  for (const block of blocks) {
    const videoId = (block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
    const published = (block.match(/<published>([^<]+)<\/published>/) || [])[1];
    const author = (block.match(/<name>([\s\S]*?)<\/name>/) || [])[1];
    const desc = (block.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1];
    const thumb = (block.match(/<media:thumbnail url="([^"]+)"/) || [])[1];
    const stars = (block.match(/<media:starRating[^>]*count="(\d+)"/) || [])[1];
    const views = (block.match(/<media:statistics views="(\d+)"/) || [])[1];
    if (!videoId || !title) continue;
    out.push({
      videoId,
      title: stripHtml(decodeEntities(title)).trim(),
      publishedAt: toIso(published),
      author: stripHtml(decodeEntities(author || '')).trim(),
      summary: trimText(stripHtml(decodeEntities(desc || '')), 300),
      thumb,
      likes: stars ? Number(stars) : null,
      views: views ? Number(views) : null,
    });
  }
  return out;
}

export const source = {
  id: 'youtube',
  label: 'AI 视频频道',
  kind: 'video',
  homepage: 'https://www.youtube.com',
  async run() {
    const items = [];
    let httpStatus = 200;
    let latencyMs = 0;
    let raw = 0;
    const results = await Promise.all(CHANNELS.map(async (ch) => {
      const url = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + ch.id;
      try {
        const res = await fetchText(url, { timeoutMs: 25000 });
        latencyMs += res.latencyMs;
        if (!res.ok) return { ch, url, entries: [], status: res.status, fetchedAt: res.fetchedAt };
        const entries = parseChannel(res.text);
        return { ch, url, entries: entries.slice(0, 3), status: res.status, fetchedAt: res.fetchedAt };
      } catch (err) {
        return { ch, url, entries: [], status: null, fetchedAt: new Date().toISOString(), error: String(err.message || err) };
      }
    }));
    for (const r of results) {
      if (r.status) httpStatus = r.status;
      raw += r.entries.length;
      for (const entry of r.entries) {
        items.push(makeItem({
          kind: 'video',
          source: 'youtube',
          sourceLabel: 'YouTube · ' + (r.ch.label || entry.author),
          title: entry.title,
          url: 'https://www.youtube.com/watch?v=' + entry.videoId,
          summary: entry.summary,
          publishedAt: entry.publishedAt,
          score: entry.likes || null,
          scoreLabel: entry.likes ? '👍 ' + entry.likes : '',
          tags: ['视频', r.ch.label || ''],
          image: 'https://i.ytimg.com/vi/' + entry.videoId + '/hqdefault.jpg',
          imageSource: 'YouTube 视频封面',
          evidence: {
            url: r.url,
            fetchedAt: r.fetchedAt,
            httpStatus: r.status,
            pointer: 'Atom entry yt:videoId=' + entry.videoId,
          },
        }));
      }
    }
    return { items, httpStatus, latencyMs, count: raw };
  },
};
