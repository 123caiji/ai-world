import { stripHtml, decodeEntities, toIso, trimText } from './util.mjs';

function unwrapCdata(value) {
  return String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function pickTag(block, tags) {
  for (const tag of tags) {
    const re = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'i');
    const m = block.match(re);
    if (m) return m[1];
  }
  return '';
}

function absolutize(url, base) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https:\/\//i.test(raw)) return raw;
  if (/^\/\//.test(raw)) return 'https:' + raw;
  if (/^http:\/\//i.test(raw)) return raw.replace(/^http:\/\//i, 'https://');
  try {
    return new URL(raw, base).toString();
  } catch {
    return '';
  }
}

// 只认站点自己给出的图：media:thumbnail / media:content / enclosure / 正文首个 <img>
function pickImage(block, base) {
  const thumb = (block.match(/<media:thumbnail\b[^>]*\burl=(["'])([^"']+)\1/i) || [])[2];
  if (thumb) return absolutize(decodeEntities(thumb), base);
  const media = (block.match(/<media:content\b[^>]*\burl=(["'])([^"']+)\1/i) || [])[2];
  if (media) return absolutize(decodeEntities(media), base);
  const enclosure = block.match(/<enclosure\b[^>]*>/i);
  if (enclosure) {
    const tag = enclosure[0];
    const url = (tag.match(/\burl=(["'])([^"']+)\1/i) || [])[2];
    const type = (tag.match(/\btype=(["'])([^"']+)\1/i) || [])[2] || '';
    if (url && (!type || /^image\//i.test(type))) return absolutize(decodeEntities(url), base);
  }
  const body = (block.match(/<(content:encoded|description|summary|content|media:description)\b[^>]*>([\s\S]*?)<\/\1>/i) || [])[2] || '';
  const img = (body.match(/<img\b[^>]*\bsrc=(["'])([^"']+)\1/i) || [])[2];
  if (img) return absolutize(decodeEntities(img), base);
  return '';
}

export function parseFeed(xml) {
  const text = String(xml || '');
  const isAtom = /<feed[\s>]/i.test(text) && /<entry[\s>]/i.test(text);
  const blocks = text.match(isAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) || [];
  const head = text.replace(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi, '');
  const feedTitle = stripHtml(unwrapCdata(pickTag(head, ['title']))) || '';
  const items = [];
  for (const block of blocks) {
    const title = stripHtml(unwrapCdata(pickTag(block, ['title', 'media:title'])));
    let link = '';
    if (isAtom) {
      const links = block.match(/<link\b[^>]*>/gi) || [];
      const alt = links.find((l) => /rel=(["'])alternate\1/i.test(l)) || links[0] || '';
      link = (alt.match(/href=(["'])([^"']+)\1/i) || [])[2] || '';
    } else {
      link = unwrapCdata(pickTag(block, ['link'])).trim();
    }
    if (!link) {
      const guidRaw = unwrapCdata(pickTag(block, ['guid', 'id'])).trim();
      if (/^https?:\/\//i.test(guidRaw)) link = guidRaw;
    }
    if (!title || !link) continue;
    const summary = stripHtml(unwrapCdata(pickTag(block, ['content:encoded', 'description', 'summary', 'content'])));
    const image = pickImage(block, link.trim());
    items.push({
      title,
      link: link.trim(),
      summary: trimText(decodeEntities(summary), 420),
      publishedAt: toIso(unwrapCdata(pickTag(block, ['published', 'pubDate', 'updated', 'dc:date'])).trim()),
      image,
    });
  }
  return { feedTitle, items };
}
