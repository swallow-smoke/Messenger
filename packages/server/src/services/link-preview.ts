import ogs from 'open-graph-scraper';
import type { InputJsonValue } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';

export interface GitHubLabel {
  name: string;
  color: string;
}

export interface CommitFile {
  filename: string;
  status?: string;
}

export interface NotionBlock {
  type:
    | 'paragraph'
    | 'heading_1'
    | 'heading_2'
    | 'heading_3'
    | 'bulleted_list'
    | 'numbered_list'
    | 'to_do'
    | 'quote'
    | 'callout';
  text: string;
  checked?: boolean;
  emoji?: string;
  color?: string;
}

export interface LinkPreviewData {
  url?: string;
  type?: 'github' | 'notion' | 'generic' | 'sketchfab';
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  stars?: number;
  language?: string;
  embedUrl?: string;

  // GitHub deep preview
  githubType?: 'repo' | 'pr' | 'issue' | 'code' | 'commit';
  license?: string;
  topics?: string[];
  pushedAt?: string;
  readmeExcerpt?: string;
  authorLogin?: string;
  authorAvatar?: string;
  bodyExcerpt?: string;
  createdAt?: string;
  prState?: 'open' | 'merged' | 'closed';
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  mergedAt?: string;
  issueState?: 'open' | 'closed';
  labels?: GitHubLabel[];
  commentsCount?: number;
  codeContent?: string;
  codeLanguage?: string;
  fileName?: string;
  commitSha?: string;
  commitStats?: { additions: number; deletions: number };
  commitFiles?: CommitFile[];

  // Notion deep preview
  notionIcon?: string;
  notionIconType?: 'emoji' | 'url';
  coverImage?: string;
  blocks?: NotionBlock[];
}

// ---------------------------------------------------------------------------
// Generic OG fallback
// ---------------------------------------------------------------------------

async function fetchOGPreview(url: string, type: 'notion' | 'generic'): Promise<LinkPreviewData> {
  try {
    const { result } = await ogs({ url, timeout: 5000 });
    return {
      type,
      title: result.ogTitle ?? result.twitterTitle,
      description: result.ogDescription ?? result.twitterDescription,
      imageUrl: result.ogImage?.[0]?.url ?? result.twitterImage?.[0]?.url,
      siteName: result.ogSiteName,
    };
  } catch {
    return { type };
  }
}

// ---------------------------------------------------------------------------
// GitHub deep preview
// ---------------------------------------------------------------------------

const EXT_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx', mjs: 'javascript', cjs: 'javascript',
  py: 'python', rs: 'rust', go: 'go', java: 'java', kt: 'kotlin', swift: 'swift',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp', c: 'c', h: 'c', hpp: 'cpp', cs: 'csharp',
  rb: 'ruby', php: 'php', json: 'json', yml: 'yaml', yaml: 'yaml', toml: 'toml',
  md: 'markdown', html: 'html', css: 'css', scss: 'scss', sass: 'scss',
  sh: 'bash', bash: 'bash', zsh: 'bash', sql: 'sql', xml: 'xml', lua: 'lua',
  dart: 'dart', vue: 'markup', svelte: 'markup',
};

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'GameDev-Messenger',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function ghFetch(path: string): Promise<Response | null> {
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: githubHeaders(),
      signal: AbortSignal.timeout(6000),
    });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

function decodeBase64(content: string): string {
  return Buffer.from(content.replace(/\n/g, ''), 'base64').toString('utf-8');
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-+*]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchGitHubRepo(owner: string, repo: string, url: string): Promise<LinkPreviewData> {
  const res = await ghFetch(`/repos/${owner}/${repo}`);
  if (!res) return fetchOGPreview(url, 'generic');
  const data = (await res.json()) as {
    full_name: string;
    description: string | null;
    stargazers_count: number;
    language: string | null;
    license: { spdx_id?: string | null; name?: string | null } | null;
    topics?: string[];
    pushed_at: string;
  };

  let readmeExcerpt: string | undefined;
  const readmeRes = await ghFetch(`/repos/${owner}/${repo}/readme`);
  if (readmeRes) {
    try {
      const readme = (await readmeRes.json()) as { content?: string };
      if (readme.content) {
        const stripped = stripMarkdown(decodeBase64(readme.content));
        if (stripped) readmeExcerpt = stripped.slice(0, 300);
      }
    } catch {
      // README is optional — ignore
    }
  }

  const license =
    data.license?.spdx_id && data.license.spdx_id !== 'NOASSERTION'
      ? data.license.spdx_id
      : data.license?.name ?? undefined;

  return {
    type: 'github',
    githubType: 'repo',
    url,
    title: data.full_name,
    description: data.description ?? undefined,
    imageUrl: `https://opengraph.githubassets.com/1/${data.full_name}`,
    siteName: 'GitHub',
    stars: data.stargazers_count,
    language: data.language ?? undefined,
    license,
    topics: data.topics ?? [],
    pushedAt: data.pushed_at,
    readmeExcerpt,
  };
}

async function fetchGitHubPR(owner: string, repo: string, num: string, url: string): Promise<LinkPreviewData> {
  const res = await ghFetch(`/repos/${owner}/${repo}/pulls/${num}`);
  if (!res) return fetchOGPreview(url, 'generic');
  const data = (await res.json()) as {
    title: string;
    state: 'open' | 'closed';
    merged: boolean;
    user: { login: string; avatar_url: string } | null;
    body: string | null;
    changed_files: number;
    additions: number;
    deletions: number;
    created_at: string;
    merged_at: string | null;
  };

  return {
    type: 'github',
    githubType: 'pr',
    url,
    title: data.title,
    siteName: 'GitHub',
    prState: data.merged ? 'merged' : data.state,
    authorLogin: data.user?.login,
    authorAvatar: data.user?.avatar_url,
    bodyExcerpt: data.body ? stripMarkdown(data.body).slice(0, 200) : undefined,
    changedFiles: data.changed_files,
    additions: data.additions,
    deletions: data.deletions,
    createdAt: data.created_at,
    mergedAt: data.merged_at ?? undefined,
  };
}

async function fetchGitHubIssue(owner: string, repo: string, num: string, url: string): Promise<LinkPreviewData> {
  const res = await ghFetch(`/repos/${owner}/${repo}/issues/${num}`);
  if (!res) return fetchOGPreview(url, 'generic');
  const data = (await res.json()) as {
    title: string;
    state: 'open' | 'closed';
    user: { login: string; avatar_url: string } | null;
    body: string | null;
    labels: Array<{ name: string; color: string } | string>;
    comments: number;
    created_at: string;
  };

  const labels: GitHubLabel[] = data.labels
    .map((l) => (typeof l === 'string' ? { name: l, color: '888888' } : { name: l.name, color: l.color }))
    .filter((l) => l.name);

  return {
    type: 'github',
    githubType: 'issue',
    url,
    title: data.title,
    siteName: 'GitHub',
    issueState: data.state,
    authorLogin: data.user?.login,
    authorAvatar: data.user?.avatar_url,
    bodyExcerpt: data.body ? stripMarkdown(data.body).slice(0, 200) : undefined,
    labels,
    commentsCount: data.comments,
    createdAt: data.created_at,
  };
}

async function fetchGitHubCode(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  url: string,
): Promise<LinkPreviewData> {
  const res = await ghFetch(`/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`);
  if (!res) return fetchOGPreview(url, 'generic');
  const data = (await res.json()) as { content?: string; encoding?: string; name?: string };
  if (!data.content || data.encoding !== 'base64') return fetchOGPreview(url, 'generic');

  const decoded = decodeBase64(data.content);
  const codeContent = decoded.split('\n').slice(0, 30).join('\n');
  const fileName = data.name ?? path.split('/').pop() ?? path;
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

  return {
    type: 'github',
    githubType: 'code',
    url,
    title: path,
    siteName: 'GitHub',
    fileName,
    codeContent,
    codeLanguage: EXT_LANG[ext] ?? 'text',
  };
}

async function fetchGitHubCommit(owner: string, repo: string, sha: string, url: string): Promise<LinkPreviewData> {
  const res = await ghFetch(`/repos/${owner}/${repo}/commits/${sha}`);
  if (!res) return fetchOGPreview(url, 'generic');
  const data = (await res.json()) as {
    sha: string;
    commit: { message: string; author: { name: string; date: string } | null };
    author: { login: string; avatar_url: string } | null;
    stats?: { additions: number; deletions: number };
    files?: Array<{ filename: string; status: string }>;
  };

  return {
    type: 'github',
    githubType: 'commit',
    url,
    title: data.commit.message.split('\n')[0],
    bodyExcerpt: data.commit.message.split('\n').slice(1).join('\n').trim() || undefined,
    siteName: 'GitHub',
    commitSha: data.sha.slice(0, 7),
    authorLogin: data.author?.login ?? data.commit.author?.name,
    authorAvatar: data.author?.avatar_url,
    createdAt: data.commit.author?.date,
    commitStats: data.stats ? { additions: data.stats.additions, deletions: data.stats.deletions } : undefined,
    commitFiles: (data.files ?? []).slice(0, 5).map((f) => ({ filename: f.filename, status: f.status })),
  };
}

async function fetchGitHubDeepPreview(url: string): Promise<LinkPreviewData> {
  const pr = /github\.com\/([^/\s?#]+)\/([^/\s?#]+)\/pull\/(\d+)/i.exec(url);
  if (pr) return fetchGitHubPR(pr[1], pr[2], pr[3], url);

  const issue = /github\.com\/([^/\s?#]+)\/([^/\s?#]+)\/issues\/(\d+)/i.exec(url);
  if (issue) return fetchGitHubIssue(issue[1], issue[2], issue[3], url);

  const commit = /github\.com\/([^/\s?#]+)\/([^/\s?#]+)\/commit\/([0-9a-f]+)/i.exec(url);
  if (commit) return fetchGitHubCommit(commit[1], commit[2], commit[3], url);

  const blob = /github\.com\/([^/\s?#]+)\/([^/\s?#]+)\/blob\/([^/\s?#]+)\/([^\s?#]+)/i.exec(url);
  if (blob) return fetchGitHubCode(blob[1], blob[2], blob[3], blob[4], url);

  const repo = /github\.com\/([^/\s?#]+)\/([^/\s?#]+)/i.exec(url);
  if (repo) return fetchGitHubRepo(repo[1], repo[2], url);

  return fetchOGPreview(url, 'generic');
}

// ---------------------------------------------------------------------------
// Notion deep preview
// ---------------------------------------------------------------------------

interface NotionBlockValue {
  id?: string;
  type?: string;
  properties?: { title?: unknown[]; checked?: unknown[] };
  content?: string[];
  format?: { page_icon?: string; page_cover?: string };
}

interface NotionRecordMap {
  block?: Record<string, { value?: NotionBlockValue }>;
}

function findRecordMap(obj: unknown, depth = 0): NotionRecordMap | null {
  if (depth > 8 || obj === null || typeof obj !== 'object') return null;
  const record = obj as Record<string, unknown>;
  if (record.recordMap && typeof record.recordMap === 'object') {
    const rm = record.recordMap as NotionRecordMap;
    if (rm.block) return rm;
  }
  if (record.block && typeof record.block === 'object') return record as NotionRecordMap;
  for (const key of Object.keys(record)) {
    const found = findRecordMap(record[key], depth + 1);
    if (found) return found;
  }
  return null;
}

// Notion stores rich text as [["plain text", [...formatting]], ...]
function notionText(prop: unknown): string {
  if (!Array.isArray(prop)) return '';
  return prop
    .map((seg) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
    .join('')
    .trim();
}

const NOTION_TYPE_MAP: Record<string, NotionBlock['type']> = {
  text: 'paragraph',
  header: 'heading_1',
  sub_header: 'heading_2',
  sub_sub_header: 'heading_3',
  bulleted_list: 'bulleted_list',
  numbered_list: 'numbered_list',
  to_do: 'to_do',
  quote: 'quote',
  callout: 'callout',
};

function resolveNotionIcon(icon: string | undefined): { notionIcon?: string; notionIconType?: 'emoji' | 'url' } {
  if (!icon) return {};
  if (/^https?:\/\//.test(icon)) return { notionIcon: icon, notionIconType: 'url' };
  if (icon.startsWith('/')) return { notionIcon: `https://www.notion.so${icon}`, notionIconType: 'url' };
  return { notionIcon: icon, notionIconType: 'emoji' };
}

function resolveNotionCover(cover: string | undefined): string | undefined {
  if (!cover) return undefined;
  if (/^https?:\/\//.test(cover)) return cover;
  if (cover.startsWith('/')) return `https://www.notion.so${cover}`;
  return cover;
}

async function fetchNotionDeepPreview(url: string): Promise<LinkPreviewData> {
  const og = await fetchOGPreview(url, 'notion');
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GameDev-Messenger/1.0)' },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return og;
    const html = await res.text();

    const scriptMatch = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
    if (!scriptMatch) return og;

    const recordMap = findRecordMap(JSON.parse(scriptMatch[1]));
    if (!recordMap?.block) return og;

    const blocksMap = recordMap.block;
    const pageEntry = Object.values(blocksMap).find((b) => b.value?.type === 'page');
    const pageValue = pageEntry?.value;
    if (!pageValue) return og;

    const title = notionText(pageValue.properties?.title) || og.title;
    const { notionIcon, notionIconType } = resolveNotionIcon(pageValue.format?.page_icon);
    const coverImage = resolveNotionCover(pageValue.format?.page_cover);

    const blocks: NotionBlock[] = [];
    for (const childId of pageValue.content ?? []) {
      if (blocks.length >= 8) break;
      const child = blocksMap[childId]?.value;
      if (!child?.type) continue;
      const mapped = NOTION_TYPE_MAP[child.type];
      if (!mapped) continue;
      const text = notionText(child.properties?.title);
      if (!text && mapped !== 'to_do') continue;

      const block: NotionBlock = { type: mapped, text };
      if (mapped === 'to_do') {
        block.checked = notionText(child.properties?.checked) === 'Yes';
      }
      if (mapped === 'callout') {
        const ico = resolveNotionIcon(child.format?.page_icon);
        if (ico.notionIconType === 'emoji') block.emoji = ico.notionIcon;
      }
      blocks.push(block);
    }

    return {
      type: 'notion',
      url,
      title,
      description: og.description,
      imageUrl: og.imageUrl,
      siteName: 'Notion',
      notionIcon,
      notionIconType,
      coverImage,
      blocks: blocks.slice(0, 8),
    };
  } catch {
    return og;
  }
}

// ---------------------------------------------------------------------------
// Sketchfab
// ---------------------------------------------------------------------------

interface SketchfabOEmbed {
  title?: string;
  thumbnail_url?: string;
  html?: string;
}

async function fetchSketchfabPreview(url: string): Promise<LinkPreviewData> {
  try {
    const oembedUrl = `https://sketchfab.com/oembed?url=${encodeURIComponent(url)}`;
    const response = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return { type: 'sketchfab' };
    const data = (await response.json()) as SketchfabOEmbed;
    const srcMatch = /src="([^"]+)"/.exec(data.html ?? '');
    return {
      type: 'sketchfab',
      title: data.title,
      imageUrl: data.thumbnail_url,
      siteName: 'Sketchfab',
      embedUrl: srcMatch?.[1],
    };
  } catch {
    return { type: 'sketchfab' };
  }
}

// ---------------------------------------------------------------------------
// Dispatch + caching
// ---------------------------------------------------------------------------

export async function fetchLinkPreview(url: string): Promise<LinkPreviewData> {
  if (/github\.com/i.test(url)) return fetchGitHubDeepPreview(url);
  if (/notion\.(so|site)/i.test(url)) return fetchNotionDeepPreview(url);
  if (/sketchfab\.com/i.test(url)) return fetchSketchfabPreview(url);
  return fetchOGPreview(url, 'generic');
}

function expiryFor(type?: LinkPreviewData['type']): Date {
  const now = Date.now();
  if (type === 'github') return new Date(now + 60 * 60 * 1000); // 1 hour
  if (type === 'notion') return new Date(now + 30 * 60 * 1000); // 30 minutes
  return new Date(now + 24 * 60 * 60 * 1000); // 24 hours
}

/**
 * Returns a preview for the URL, served from the LinkPreview cache when fresh,
 * otherwise fetched and persisted. Never throws — falls back to a fresh fetch
 * if the DB is unavailable.
 */
export async function getCachedLinkPreview(url: string): Promise<LinkPreviewData> {
  try {
    const existing = await prisma.linkPreview.findUnique({ where: { url } });
    if (existing?.data && existing.expiresAt > new Date()) {
      return existing.data as LinkPreviewData;
    }

    const preview = await fetchLinkPreview(url);
    const data: LinkPreviewData = { url, ...preview };
    const scalar = {
      title: preview.title,
      description: preview.description,
      imageUrl: preview.imageUrl,
      siteName: preview.siteName,
      embedUrl: preview.embedUrl,
      data: data as unknown as InputJsonValue,
      expiresAt: expiryFor(preview.type),
    };
    await prisma.linkPreview.upsert({
      where: { url },
      create: { url, ...scalar },
      update: { ...scalar, fetchedAt: new Date() },
    });
    return data;
  } catch {
    return fetchLinkPreview(url);
  }
}
