import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { usePreferencesStore } from '../../store/preferences';

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

function openLink(e: React.MouseEvent, url: string) {
  if (window.electron?.shell) {
    e.preventDefault();
    void window.electron.shell.openExternal(url);
  }
}

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// Pick black/white text for a GitHub label background (YIQ contrast).
function labelTextColor(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#fff';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 140 ? '#000' : '#fff';
}

const cardBase =
  'mt-2 block max-w-lg rounded-lg border border-white/10 bg-white/5 hover:bg-white/[0.08] transition-colors no-underline overflow-hidden';

// ---------------------------------------------------------------------------
// GitHub cards
// ---------------------------------------------------------------------------

function GitHubRepoCard({ preview }: { preview: LinkPreviewData }): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => preview.url && openLink(e, preview.url)}
      className={`${cardBase} p-3`}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg flex-shrink-0">🐙</span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm text-white truncate">{preview.title}</div>
          {preview.description && (
            <div className="text-xs text-white/60 mt-0.5 line-clamp-2">{preview.description}</div>
          )}
        </div>
      </div>

      {preview.topics && preview.topics.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {preview.topics.slice(0, 6).map((t) => (
            <span key={t} className="px-1.5 py-0.5 rounded-full text-[10px] bg-accent/15 text-accent">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-white/40">
        {preview.stars !== undefined && <span>⭐ {preview.stars.toLocaleString()}</span>}
        {preview.language && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-accent inline-block" />
            {preview.language}
          </span>
        )}
        {preview.license && <span>⚖ {preview.license}</span>}
        {preview.pushedAt && <span>updated {relativeTime(preview.pushedAt)}</span>}
      </div>

      {preview.readmeExcerpt && (
        <div className="mt-2 rounded bg-black/20 p-2">
          <div className={`text-xs text-white/55 whitespace-pre-wrap ${expanded ? '' : 'line-clamp-4'}`}>
            {preview.readmeExcerpt}
          </div>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded((v) => !v); }}
            className="mt-1 text-[10px] text-accent hover:underline"
          >
            {expanded ? 'show less' : 'show more'}
          </button>
        </div>
      )}
    </a>
  );
}

const PR_STATE_STYLE: Record<string, string> = {
  open: 'bg-green-500/20 text-green-400',
  merged: 'bg-purple-500/20 text-purple-400',
  closed: 'bg-red-500/20 text-red-400',
};

function AuthorLine({ login, avatar }: { login?: string; avatar?: string }): React.ReactElement | null {
  if (!login) return null;
  return (
    <span className="flex items-center gap-1.5 text-xs text-white/50">
      {avatar && <img src={avatar} alt="" className="w-4 h-4 rounded-full" />}
      {login}
    </span>
  );
}

function DiffStats({ additions, deletions, files }: { additions?: number; deletions?: number; files?: number }): React.ReactElement {
  return (
    <span className="flex items-center gap-2 text-xs font-mono">
      {additions !== undefined && <span className="text-green-400">+{additions.toLocaleString()}</span>}
      {deletions !== undefined && <span className="text-red-400">−{deletions.toLocaleString()}</span>}
      {files !== undefined && <span className="text-white/40">{files} file{files === 1 ? '' : 's'}</span>}
    </span>
  );
}

function GitHubPRCard({ preview }: { preview: LinkPreviewData }): React.ReactElement {
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => preview.url && openLink(e, preview.url)}
      className={`${cardBase} p-3`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${PR_STATE_STYLE[preview.prState ?? 'open']}`}
        >
          {preview.prState}
        </span>
        <span className="text-xs text-white/40">Pull Request</span>
      </div>
      <div className="font-semibold text-sm text-white line-clamp-2">{preview.title}</div>
      {preview.bodyExcerpt && (
        <div className="text-xs text-white/55 mt-1 line-clamp-2">{preview.bodyExcerpt}</div>
      )}
      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2">
        <AuthorLine login={preview.authorLogin} avatar={preview.authorAvatar} />
        <DiffStats additions={preview.additions} deletions={preview.deletions} files={preview.changedFiles} />
        {preview.createdAt && <span className="text-xs text-white/40">{relativeTime(preview.createdAt)}</span>}
      </div>
    </a>
  );
}

function GitHubIssueCard({ preview }: { preview: LinkPreviewData }): React.ReactElement {
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => preview.url && openLink(e, preview.url)}
      className={`${cardBase} p-3`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
            preview.issueState === 'closed' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'
          }`}
        >
          {preview.issueState}
        </span>
        <span className="text-xs text-white/40">Issue</span>
      </div>
      <div className="font-semibold text-sm text-white line-clamp-2">{preview.title}</div>
      {preview.labels && preview.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {preview.labels.slice(0, 6).map((l) => (
            <span
              key={l.name}
              className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
              style={{ backgroundColor: `#${l.color}`, color: labelTextColor(l.color) }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}
      {preview.bodyExcerpt && (
        <div className="text-xs text-white/55 mt-1.5 line-clamp-2">{preview.bodyExcerpt}</div>
      )}
      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2">
        <AuthorLine login={preview.authorLogin} avatar={preview.authorAvatar} />
        {preview.commentsCount !== undefined && (
          <span className="text-xs text-white/40">💬 {preview.commentsCount}</span>
        )}
        {preview.createdAt && <span className="text-xs text-white/40">{relativeTime(preview.createdAt)}</span>}
      </div>
    </a>
  );
}

function GitHubCodeCard({ preview, highlight }: { preview: LinkPreviewData; highlight: boolean }): React.ReactElement {
  const lines = (preview.codeContent ?? '').split('\n').slice(0, 15);
  const code = lines.join('\n');
  return (
    <div className={`${cardBase} cursor-default`}>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm">📄</span>
          <span className="font-mono text-xs text-white truncate">{preview.fileName ?? preview.title}</span>
          {preview.codeLanguage && preview.codeLanguage !== 'text' && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-accent/15 text-accent flex-shrink-0">
              {preview.codeLanguage}
            </span>
          )}
        </div>
        <a
          href={preview.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => preview.url && openLink(e, preview.url)}
          className="text-[10px] text-accent hover:underline flex-shrink-0 no-underline"
        >
          view on GitHub
        </a>
      </div>
      {highlight ? (
        <SyntaxHighlighter
          style={oneDark}
          language={preview.codeLanguage ?? 'text'}
          PreTag="div"
          customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.72rem', background: 'transparent' }}
        >
          {code}
        </SyntaxHighlighter>
      ) : (
        <pre className="text-[0.72rem] font-mono p-3 overflow-x-auto whitespace-pre text-white/80">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

function GitHubCommitCard({ preview }: { preview: LinkPreviewData }): React.ReactElement {
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => preview.url && openLink(e, preview.url)}
      className={`${cardBase} p-3`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">🔀</span>
        {preview.commitSha && (
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
            {preview.commitSha}
          </span>
        )}
        <span className="text-xs text-white/40">Commit</span>
      </div>
      <div className="font-semibold text-sm text-white line-clamp-2">{preview.title}</div>
      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2">
        <AuthorLine login={preview.authorLogin} avatar={preview.authorAvatar} />
        {preview.createdAt && <span className="text-xs text-white/40">{relativeTime(preview.createdAt)}</span>}
        {preview.commitStats && (
          <DiffStats additions={preview.commitStats.additions} deletions={preview.commitStats.deletions} />
        )}
      </div>
      {preview.commitFiles && preview.commitFiles.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {preview.commitFiles.map((f) => (
            <div key={f.filename} className="font-mono text-[10px] text-white/45 truncate">
              {f.filename}
            </div>
          ))}
        </div>
      )}
    </a>
  );
}

function GitHubCard({ preview, highlight }: { preview: LinkPreviewData; highlight: boolean }): React.ReactElement {
  switch (preview.githubType) {
    case 'pr':
      return <GitHubPRCard preview={preview} />;
    case 'issue':
      return <GitHubIssueCard preview={preview} />;
    case 'code':
      return <GitHubCodeCard preview={preview} highlight={highlight} />;
    case 'commit':
      return <GitHubCommitCard preview={preview} />;
    case 'repo':
    default:
      return <GitHubRepoCard preview={preview} />;
  }
}

// ---------------------------------------------------------------------------
// Notion card
// ---------------------------------------------------------------------------

function NotionBlockView({ block }: { block: NotionBlock }): React.ReactElement | null {
  switch (block.type) {
    case 'heading_1':
      return <div className="text-sm font-bold text-white">{block.text}</div>;
    case 'heading_2':
      return <div className="text-[0.8rem] font-bold text-white">{block.text}</div>;
    case 'heading_3':
      return <div className="text-xs font-semibold text-white/90">{block.text}</div>;
    case 'paragraph':
      return <div className="text-xs text-white/70">{block.text}</div>;
    case 'bulleted_list':
      return <div className="text-xs text-white/70 pl-2">• {block.text}</div>;
    case 'numbered_list':
      return <div className="text-xs text-white/70 pl-2">– {block.text}</div>;
    case 'to_do':
      return (
        <div className="text-xs text-white/70">
          {block.checked ? '☑' : '☐'} <span className={block.checked ? 'line-through opacity-60' : ''}>{block.text}</span>
        </div>
      );
    case 'quote':
      return <div className="text-xs italic text-white/60 border-l-2 border-white/30 pl-2">{block.text}</div>;
    case 'callout':
      return (
        <div className="text-xs text-white/70 border-l-2 border-accent bg-accent/10 rounded-r px-2 py-1">
          {block.emoji && <span className="mr-1">{block.emoji}</span>}
          {block.text}
        </div>
      );
    default:
      return null;
  }
}

function NotionCard({ preview }: { preview: LinkPreviewData }): React.ReactElement {
  const hasDeep = preview.blocks && preview.blocks.length > 0;
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => preview.url && openLink(e, preview.url)}
      className={cardBase}
    >
      {preview.coverImage && (
        <img
          src={preview.coverImage}
          alt=""
          className="w-full h-16 object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <div className="p-3">
        <div className="flex items-center gap-2">
          {preview.notionIcon ? (
            preview.notionIconType === 'url' ? (
              <img src={preview.notionIcon} alt="" className="w-6 h-6 rounded flex-shrink-0" />
            ) : (
              <span className="text-2xl leading-none flex-shrink-0">{preview.notionIcon}</span>
            )
          ) : (
            <span className="text-lg flex-shrink-0">📝</span>
          )}
          <div className="min-w-0">
            <div className="text-[10px] text-white/40">Notion</div>
            <div className="font-semibold text-sm text-white truncate">{preview.title}</div>
          </div>
        </div>

        {hasDeep ? (
          <div className="mt-2 space-y-1">
            {preview.blocks!.slice(0, 5).map((b, i) => (
              <NotionBlockView key={i} block={b} />
            ))}
          </div>
        ) : (
          preview.description && (
            <div className="text-xs text-white/60 mt-1.5 line-clamp-3">{preview.description}</div>
          )
        )}

        <div className="mt-2 text-[10px] text-accent">Open in Notion →</div>
      </div>
    </a>
  );
}

// ---------------------------------------------------------------------------
// Generic + Sketchfab (unchanged behavior)
// ---------------------------------------------------------------------------

function GenericCard({ preview }: { preview: LinkPreviewData }): React.ReactElement {
  const hostname = preview.url ? (() => { try { return new URL(preview.url).hostname; } catch { return ''; } })() : '';

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => preview.url && openLink(e, preview.url)}
      className={`${cardBase} flex gap-3`}
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

function SketchfabCard({ preview, enable3DPreview }: { preview: LinkPreviewData; enable3DPreview: boolean }): React.ReactElement {
  if (enable3DPreview && preview.embedUrl) {
    return (
      <div className="mt-2 rounded-lg overflow-hidden border border-white/10" style={{ width: 480, height: 320 }}>
        <iframe
          src={preview.embedUrl}
          title={preview.title ?? 'Sketchfab model'}
          allow="autoplay; fullscreen; xr-spatial-tracking"
          className="w-full h-full border-0"
        />
      </div>
    );
  }
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => preview.url && openLink(e, preview.url)}
      className={`${cardBase} flex gap-3`}
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
        <div className="text-xs text-white/40 mb-0.5 uppercase tracking-wide">Sketchfab</div>
        <div className="font-semibold text-sm text-white truncate">{preview.title}</div>
        {preview.description && (
          <div className="text-xs text-white/60 mt-0.5 line-clamp-2">{preview.description}</div>
        )}
      </div>
    </a>
  );
}

interface Props {
  preview: LinkPreviewData;
}

export function LinkPreviewCard({ preview }: Props): React.ReactElement | null {
  const { prefs } = usePreferencesStore();
  const isGitHubDeep = preview.type === 'github' && !!preview.githubType;
  if (!preview.title && !preview.description && !isGitHubDeep) return null;
  if (preview.type === 'sketchfab') return <SketchfabCard preview={preview} enable3DPreview={prefs.enable3DPreview} />;
  if (preview.type === 'github') return <GitHubCard preview={preview} highlight={prefs.enableCodeHighlight} />;
  if (preview.type === 'notion') return <NotionCard preview={preview} />;
  return <GenericCard preview={preview} />;
}
