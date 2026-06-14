import React from 'react';

interface NotionEmbed {
  type: 'notion';
  title: string;
  lastEdited?: string;
}

interface ObsidianEmbed {
  type: 'obsidian';
  path: string;
  preview?: string;
}

interface TaskEmbed {
  type: 'task';
  seqNum: number;
  title: string;
  status: string;
  assignee?: { displayName: string; avatarUrl?: string };
}

interface CiEmbed {
  type: 'ci_build';
  repo: string;
  branch: string;
  status: 'success' | 'failure' | 'running';
  commitSha: string;
  commitUrl?: string;
}

interface LinkEmbed {
  type: 'link';
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  embedUrl?: string;
}

type Embed = NotionEmbed | ObsidianEmbed | TaskEmbed | CiEmbed | LinkEmbed;

interface Props {
  embed: Embed;
}

const STATUS_COLOR: Record<string, string> = {
  success: 'text-green-400',
  failure: 'text-red-400',
  running: 'text-yellow-400',
};

export function EmbedCard({ embed }: Props): React.ReactElement {
  switch (embed.type) {
    case 'notion':
      return (
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-white/5 border border-white/10 text-sm mt-1">
          <span>📄</span>
          <span className="font-medium">{embed.title}</span>
          {embed.lastEdited && <span className="text-white/40 text-xs ml-auto">{embed.lastEdited}</span>}
        </div>
      );
    case 'obsidian':
      return (
        <div className="flex flex-col gap-1 px-3 py-2 rounded bg-white/5 border border-white/10 text-sm mt-1">
          <span className="text-white/60 text-xs font-mono">{embed.path}</span>
          {embed.preview && <p className="text-white/70 truncate">{embed.preview}</p>}
        </div>
      );
    case 'task':
      return (
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-white/5 border border-white/10 text-sm mt-1">
          <span className="text-accent font-mono text-xs">#{embed.seqNum}</span>
          <span className="font-medium">{embed.title}</span>
          <span className="ml-auto px-1.5 py-0.5 rounded text-xs bg-white/10">{embed.status}</span>
          {embed.assignee && (
            <span className="text-white/50 text-xs">{embed.assignee.displayName}</span>
          )}
        </div>
      );
    case 'ci_build':
      return (
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-white/5 border border-white/10 text-sm mt-1">
          <span className={STATUS_COLOR[embed.status] ?? ''}>
            {embed.status === 'success' ? '✓' : embed.status === 'failure' ? '✗' : '⟳'}
          </span>
          <span>{embed.repo}</span>
          <span className="text-white/50">@{embed.branch}</span>
          {embed.commitUrl ? (
            <a href={embed.commitUrl} className="font-mono text-xs text-accent ml-auto">{embed.commitSha.slice(0, 7)}</a>
          ) : (
            <span className="font-mono text-xs text-white/40 ml-auto">{embed.commitSha.slice(0, 7)}</span>
          )}
        </div>
      );
    case 'link':
      return (
        <a
          href={embed.url}
          target="_blank"
          rel="noreferrer"
          className="flex gap-3 px-3 py-2 rounded bg-white/5 border border-white/10 text-sm mt-1 hover:bg-white/10 transition-colors"
        >
          {embed.imageUrl && (
            <img src={embed.imageUrl} alt="" className="w-16 h-16 object-cover rounded flex-shrink-0" />
          )}
          <div className="flex flex-col gap-0.5 overflow-hidden">
            {embed.siteName && <span className="text-xs text-white/40">{embed.siteName}</span>}
            {embed.title && <span className="font-medium truncate">{embed.title}</span>}
            {embed.description && <p className="text-white/60 text-xs line-clamp-2">{embed.description}</p>}
          </div>
        </a>
      );
  }
}
