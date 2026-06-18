import React from 'react';

export type ConnectedAccountProvider = 'github' | 'notion' | 'itchio' | 'portfolio';

export interface ConnectedAccount {
  id: string;
  provider: ConnectedAccountProvider;
  url: string;
  displayName: string;
}

export const PROVIDERS: { value: ConnectedAccountProvider; label: string }[] = [
  { value: 'github', label: 'GitHub' },
  { value: 'notion', label: 'Notion' },
  { value: 'itchio', label: 'itch.io' },
  { value: 'portfolio', label: '포트폴리오' },
];

export const PROVIDER_LABEL: Record<ConnectedAccountProvider, string> = {
  github: 'GitHub',
  notion: 'Notion',
  itchio: 'itch.io',
  portfolio: '포트폴리오',
};

// Simple inline SVG glyphs — no icon library (per project constraint).
export function ProviderIcon({
  provider,
  size = 16,
}: {
  provider: ConnectedAccountProvider;
  size?: number;
}): React.ReactElement {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'currentColor' };
  switch (provider) {
    case 'github':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.5v-1.7c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.8 18 5.1 18 5.1c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5Z" />
        </svg>
      );
    case 'notion':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 4.7c.4.3.6.3 1.4.2l8.5-.6c.2 0 0-.2-.1-.2l-1.4-1c-.3-.2-.6-.4-1.2-.4l-8.2.6c-.3 0-.3.2-.2.3L4 4.7Zm.5 1.9v8.9c0 .5.2.7.8.6l9.3-.5c.5 0 .6-.3.6-.7V6c0-.4-.2-.6-.5-.6l-9.7.6c-.4 0-.5.2-.5.6Zm9 .5c0 .2 0 .4-.3.4l-.4.1v6.5l-1.2.7-3.7-5.8v5.6l1 .2s0 .3-.4.3l-2.6.2c-.1-.2 0-.4.2-.4l.5-.2V8.9l-.7-.1c0-.2.1-.4.4-.5l2.7-.2 3.8 5.8V8.6l-.8-.1c0-.2.1-.4.4-.4l2.4-.2ZM2.6 3.1 11.1 2.5c1-.1 1.3-.1 2 .4l2.7 1.9c.4.3.6.5.6 1v11c0 .8-.3 1.3-1.4 1.4l-9.9.6c-.7 0-1-.1-1.4-.6L1.7 16c-.4-.6-.6-1-.6-1.6V4.4c0-.7.3-1.2 1.5-1.3Z" />
        </svg>
      );
    case 'itchio':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M3.7 3.4C2.8 4 .8 6.3.8 6.9v1c0 1.3 1.2 2.4 2.3 2.4 1.3 0 2.4-1.1 2.4-2.4 0 1.3 1 2.4 2.4 2.4 1.3 0 2.3-1.1 2.3-2.4 0 1.3 1.1 2.4 2.4 2.4s2.4-1.1 2.4-2.4c0 1.3 1 2.4 2.3 2.4 1.4 0 2.4-1.1 2.4-2.4v-1c0-.6-2-2.9-2.9-3.5C16.4 3.3 14.6 3.2 12 3.2s-6.4.1-8.3.2Zm5.9 6.8c-.6.9-1.6 1.5-2.7 1.5-.4 0-.8-.1-1.2-.2-.2 1.6-.3 4.4-.3 5.6 0 1.2.7 1.4 1.5 1.5.9.1 2.9.1 5.1.1s4.2 0 5.1-.1c.8-.1 1.5-.3 1.5-1.5 0-1.2-.1-4-.3-5.6-.4.1-.8.2-1.2.2-1.1 0-2.1-.6-2.7-1.5-.6.9-1.6 1.5-2.7 1.5s-2.1-.6-2.7-1.5Zm-1 1.9 1.6 1.6h2.6l1.6-1.6c0 .9.5 2.1 1.6 2.1v2.2c0 .3-.3.6-.6.6h-9.4a.6.6 0 0 1-.6-.6v-2.2c1.1 0 1.6-1.2 1.6-2.1Z" />
        </svg>
      );
    case 'portfolio':
    default:
      return (
        <svg {...common} aria-hidden="true">
          <path d="M10 4h4a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3V6a2 2 0 0 1 2-2Zm0 3h4V6h-4v1Zm-5 2v9h14V9H5Z" />
        </svg>
      );
  }
}
