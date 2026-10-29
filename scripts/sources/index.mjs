import { makeFeedSource } from '../lib/rssSource.mjs';
import { source as arxiv } from './arxiv.mjs';
import { source as hfPapers } from './hf-papers.mjs';
import { source as hn } from './hn.mjs';
import { source as openrouter } from './openrouter.mjs';
import { source as github } from './github.mjs';
import { source as dshPlugins } from './dsh-plugins.mjs';

const AI_MATCH = 'AI|A\\.I\\.|人工智能|大模型|模型|智能体|Agent|LLM|GPT|Claude|Gemini|OpenAI|英伟达|NVIDIA|算力|推理|多模态|机器人|芯片';

export const sources = [
  arxiv,
  hfPapers,
  github,
  dshPlugins,
  openrouter,
  hn,
  makeFeedSource({ id: 'qbitai', label: '量子位', url: 'https://www.qbitai.com/feed', kind: 'news', tags: ['中文'], limit: 20 }),
  makeFeedSource({ id: '36kr', label: '36氪', url: 'https://36kr.com/feed', kind: 'news', tags: ['中文'], limit: 20, match: AI_MATCH }),
  makeFeedSource({ id: 'ithome', label: 'IT之家', url: 'https://www.ithome.com/rss/', kind: 'news', tags: ['中文'], limit: 12, match: AI_MATCH }),
  makeFeedSource({ id: 'openai', label: 'OpenAI 官方博客', url: 'https://openai.com/news/rss.xml', kind: 'news', tags: ['官方'], limit: 12 }),
  makeFeedSource({ id: 'deepmind', label: 'Google DeepMind', url: 'https://blog.google/technology/google-deepmind/rss/', kind: 'news', tags: ['官方'], limit: 12 }),
  makeFeedSource({ id: 'hf-blog', label: 'Hugging Face 博客', url: 'https://huggingface.co/blog/feed.xml', kind: 'news', tags: ['官方'], limit: 12 }),
  makeFeedSource({ id: 'github-blog', label: 'GitHub 博客', url: 'https://github.blog/feed/', kind: 'news', tags: ['工程'], limit: 10 }),
  makeFeedSource({ id: 'cloudflare', label: 'Cloudflare 博客', url: 'https://blog.cloudflare.com/rss/', kind: 'news', tags: ['工程'], limit: 8, match: AI_MATCH }),
  makeFeedSource({ id: 'the-decoder', label: 'The Decoder', url: 'https://the-decoder.com/feed/', kind: 'news', tags: ['英文'], limit: 12 }),
  makeFeedSource({ id: 'techcrunch-ai', label: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', kind: 'news', tags: ['英文'], limit: 12 }),
  makeFeedSource({ id: 'mit-tr', label: 'MIT 科技评论', url: 'https://www.technologyreview.com/feed/', kind: 'news', tags: ['英文'], limit: 8, match: AI_MATCH }),
  makeFeedSource({ id: 'latent-space', label: 'Latent Space', url: 'https://www.latent.space/feed', kind: 'news', tags: ['英文'], limit: 8 }),
  makeFeedSource({ id: 'simonw', label: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/', kind: 'news', tags: ['个人'], limit: 8 }),
  makeFeedSource({ id: 'producthunt', label: 'Product Hunt', url: 'https://www.producthunt.com/feed', kind: 'product', tags: ['产品'], limit: 10, match: 'AI|Agent|GPT|LLM|模型|智能' }),
];

export function sourceById(id) {
  return sources.find((s) => s.id === id) || null;
}
