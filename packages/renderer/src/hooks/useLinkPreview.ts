import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';

const URL_REGEX = /https?:\/\/[^\s]+/g;

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
}

export function useLinkPreview(text: string): LinkPreview | null {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    const urls = text.match(URL_REGEX);
    if (!urls?.length) { setPreview(null); return; }
    const url = urls[0];
    timer.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/link-preview', { params: { url } });
        setPreview({ url, ...(data as LinkPreview) });
      } catch {
        setPreview(null);
      }
    }, 500);
    return () => clearTimeout(timer.current);
  }, [text]);

  return preview;
}
