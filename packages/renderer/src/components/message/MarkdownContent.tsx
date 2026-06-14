import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Props {
  content: string;
  enableCodeHighlight?: boolean;
  onTaskClick?: (taskNum: number) => void;
}

function openLink(href: string): void {
  if (window.electron?.shell) {
    void window.electron.shell.openExternal(href);
  } else {
    window.open(href, '_blank', 'noopener,noreferrer');
  }
}

const LANG_EXT: Record<string, string> = {
  csharp: 'cs', cs: 'cs',
  javascript: 'js', js: 'js',
  typescript: 'ts', ts: 'ts',
  jsx: 'jsx', tsx: 'tsx',
  python: 'py', py: 'py',
  rust: 'rs', go: 'go',
  java: 'java', cpp: 'cpp', c: 'c',
  html: 'html', css: 'css',
  json: 'json', yaml: 'yaml', yml: 'yml',
  bash: 'sh', sh: 'sh', shell: 'sh',
};

function CopyButton({ code }: { code: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={copy}
      className="px-2 py-0.5 text-[10px] rounded bg-white/10 text-white/50 hover:bg-white/20 hover:text-white transition-colors font-mono"
    >
      {copied ? '복사됨' : '복사'}
    </button>
  );
}

function DownloadButton({ code, language }: { code: string; language: string }): React.ReactElement {
  const ext = LANG_EXT[language.toLowerCase()] ?? 'txt';

  function download() {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={download}
      className="px-2 py-0.5 text-[10px] rounded bg-white/10 text-white/50 hover:bg-white/20 hover:text-white transition-colors font-mono"
    >
      저장
    </button>
  );
}

function processTaskLinks(text: string, onTaskClick?: (n: number) => void): React.ReactNode {
  const parts = text.split(/(#\d+)/g);
  return parts.map((part, i) => {
    const match = /^#(\d+)$/.exec(part);
    if (match) {
      const num = parseInt(match[1], 10);
      return (
        <button
          key={i}
          onClick={() => onTaskClick?.(num)}
          className="text-accent hover:underline font-mono text-[0.85em]"
        >
          {part}
        </button>
      );
    }
    return part;
  });
}

export function MarkdownContent({ content, enableCodeHighlight = true, onTaskClick }: Props): React.ReactElement {
  return (
    <div className="text-sm leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ children }) => <h1 className="text-lg font-bold mt-1 mb-0.5">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold mt-1 mb-0.5">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-bold mt-1 mb-0.5">{children}</h3>,
          h4: ({ children }) => <h3 className="text-sm font-bold mt-1 mb-0.5">{children}</h3>,
          h5: ({ children }) => <h3 className="text-sm font-bold mt-1 mb-0.5">{children}</h3>,
          h6: ({ children }) => <h3 className="text-sm font-bold mt-1 mb-0.5">{children}</h3>,
          p: ({ children }) => (
            <p className="my-0.5 first:mt-0 last:mb-0">
              {React.Children.map(children, (child) =>
                typeof child === 'string' ? processTaskLinks(child, onTaskClick) : child
              )}
            </p>
          ),
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          del: ({ children }) => <del className="line-through opacity-60">{children}</del>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-white/30 pl-3 my-1 text-white/60 italic">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              onClick={(e) => { e.preventDefault(); if (href) openLink(href); }}
              className="text-accent hover:underline cursor-pointer"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="list-disc list-inside my-0.5 pl-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside my-0.5 pl-1">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          pre: ({ children }) => <>{children}</>,
          code({ className, children }) {
            const match = /language-(\w+)/.exec(className || '');
            const raw = String(children);
            const isBlock = match || raw.endsWith('\n');

            if (isBlock) {
              const code = raw.replace(/\n$/, '');
              const language = match ? match[1] : 'text';
              return (
                <div className="relative group my-1">
                  <div className="absolute top-2 right-2 flex gap-1 z-10">
                    <DownloadButton code={code} language={language} />
                    <CopyButton code={code} />
                  </div>
                  {enableCodeHighlight ? (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={language}
                      PreTag="div"
                      customStyle={{
                        margin: 0,
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        paddingTop: '2.5rem',
                      }}
                    >
                      {code}
                    </SyntaxHighlighter>
                  ) : (
                    <pre className="bg-white/5 border border-white/10 rounded-md text-xs font-mono p-3 pt-10 overflow-x-auto whitespace-pre-wrap text-white/80">
                      <code>{code}</code>
                    </pre>
                  )}
                </div>
              );
            }

            return (
              <code className="bg-white/10 text-white/90 font-mono text-[0.8em] px-1.5 py-0.5 rounded">
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
