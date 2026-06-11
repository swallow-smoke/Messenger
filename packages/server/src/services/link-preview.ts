import ogs from 'open-graph-scraper';

export interface LinkPreviewData {
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
}

export async function fetchLinkPreview(url: string): Promise<LinkPreviewData> {
  try {
    const { result } = await ogs({ url, timeout: 5000 });
    return {
      title: result.ogTitle ?? result.twitterTitle,
      description: result.ogDescription ?? result.twitterDescription,
      imageUrl: result.ogImage?.[0]?.url ?? result.twitterImage?.[0]?.url,
      siteName: result.ogSiteName,
    };
  } catch {
    return {};
  }
}
