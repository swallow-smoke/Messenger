import React from 'react';

export interface LinkPreviewData {
  url?: string;
  type?: 'github' | 'notion' | 'generic';
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  stars?: number;
  language?: string;
}

function openLink(e: React.MouseEvent, url: string) {
  if (window.electron?.shell) {
    e.preventDefault();
    void window.electron.shell.openExternal(url);
  }
}

function GitHubCard({ preview }: { preview: LinkPreviewData }): React.ReactElement {
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => preview.url && openLink(e, preview.url)}
      className="mt-2 flex items-start gap-3 max-w-lg rounded-lg border border-white/10 bg-white/5 p-3 hover:bg-white/[0.08] transition-colors no-underline"
    >
      <span className="text-xl flex-shrink-0 mt-0.5">🐙</span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm text-white truncate">{preview.title}</div>
        {preview.description && (
          <div className="text-xs text-white/60 mt-0.5 line-clamp-2">{preview.description}</div>
        )}
        <div className="flex items-center gap-3 mt-1.5 text-xs text-white/40">
          {preview.stars !== undefined && <span>⭐ {preview.stars.toLocaleString()}</span>}
          {preview.language && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent inline-block" />
              {preview.language}
            </span>
          )}
          <span>GitHub</span>
        </div>
      </div>
    </a>
  );
}

function NotionCard({ preview }: { preview: LinkPreviewData }): React.ReactElement {
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => preview.url && openLink(e, preview.url)}
      className="mt-2 flex gap-3 max-w-lg rounded-lg border border-white/10 bg-white/5 overflow-hidden hover:bg-white/[0.08] transition-colors no-underline"
    >
      {preview.imageUrl && (
        <img
          src={preview.imageUrl}
          alt=""
          className="w-20 h-20 object-cover flex-shrink-0"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <div className="py-2.5 pr-3 min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs text-white/40 mb-0.5">
          <span>📝</span>
          <span>Notion</span>
        </div>
        <div className="font-semibold text-sm text-white truncate">{preview.title}</div>
        {preview.description && (
          <div className="text-xs text-white/60 mt-0.5 line-clamp-2">{preview.description}</div>
        )}
      </div>
    </a>
  );
}

function GenericCard({ preview }: { preview: LinkPreviewData }): React.ReactElement {
  const hostname = preview.url ? (() => { try { return new URL(preview.url).hostname; } catch { return ''; } })() : '';

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => preview.url && openLink(e, preview.url)}
      className="mt-2 flex gap-3 max-w-lg rounded-lg border border-white/10 bg-white/5 overflow-hidden hover:bg-white/[0.08] transition-colors no-underline"
    >
      {preview.imageUrl && (
        <img
          src={preview.imageUrl}
          alt=""
          className="w-20 h-20 object-cover flex-shrink-0"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <div className="py-2.5 pr-3 min-w-0 flex-1">
        {(preview.siteName || hostname) && (
          <div className="text-xs text-white/40 mb-0.5 truncate uppercase tracking-wide">
            {preview.siteName ?? hostname}
          </div>
        )}
        <div className="font-semibold text-sm text-white truncate">{preview.title}</div>
        {preview.description && (
          <div className="text-xs text-white/60 mt-0.5 line-clamp-2">{preview.description}</div>
        )}
        {!preview.siteName && !hostname && preview.url && (
          <div className="text-xs text-white/30 mt-1 truncate">{preview.url}</div>
        )}
      </div>
    </a>
  );
}

interface Props {
  preview: LinkPreviewData;
}

export function LinkPreviewCard({ preview }: Props): React.ReactElement | null {
  if (!preview.title && !preview.description) return null;
  if (preview.type === 'github') return <GitHubCard preview={preview} />;
  if (preview.type === 'notion') return <NotionCard preview={preview} />;
  return <GenericCard preview={preview} />;
}
