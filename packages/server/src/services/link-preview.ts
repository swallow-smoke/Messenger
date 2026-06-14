import ogs from 'open-graph-scraper';

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
}

async function fetchGitHubPreview(url: string): Promise<LinkPreviewData> {
  const match = url.match(/github\.com\/([^/\s?#]+)\/([^/\s?#]+)/);
  if (!match) return fetchOGPreview(url, 'generic');

  const [, owner, repo] = match;
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'GameDev-Messenger',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (process.env.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!response.ok) return fetchOGPreview(url, 'generic');

    const data = await response.json() as {
      full_name: string;
      description: string | null;
      stargazers_count: number;
      language: string | null;
    };

    return {
      type: 'github',
      title: data.full_name,
      description: data.description ?? undefined,
      imageUrl: `https://opengraph.githubassets.com/1/${data.full_name}`,
      siteName: 'GitHub',
      stars: data.stargazers_count,
      language: data.language ?? undefined,
    };
  } catch {
    return fetchOGPreview(url, 'generic');
  }
}

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

export async function fetchLinkPreview(url: string): Promise<LinkPreviewData> {
  if (/github\.com/i.test(url)) return fetchGitHubPreview(url);
  if (/notion\.(so|site)/i.test(url)) return fetchOGPreview(url, 'notion');
  if (/sketchfab\.com/i.test(url)) return fetchSketchfabPreview(url);
  return fetchOGPreview(url, 'generic');
}
