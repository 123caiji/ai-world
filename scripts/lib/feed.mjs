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
    items.push({
      title,
      link: link.trim(),
      summary: trimText(decodeEntities(summary), 420),
      publishedAt: toIso(unwrapCdata(pickTag(block, ['published', 'pubDate', 'updated', 'dc:date'])).trim()),
    });
  }
  return { feedTitle, items };
}
