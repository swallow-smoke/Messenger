import React, { useMemo } from 'react';

interface Heading {
  level: number;
  text: string;
  lineIndex: number;
}

interface Props {
  content: string;
  onJumpToLine(lineIndex: number): void;
}

function parseHeadings(content: string): Heading[] {
  const lines = content.split('\n');
  const headings: Heading[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = /^(#{1,3})\s+(.+)/.exec(lines[i]);
    if (match) {
      headings.push({ level: match[1].length, text: match[2].trim(), lineIndex: i });
    }
  }
  return headings;
}

export function DocToc({ content, onJumpToLine }: Props): React.ReactElement {
  const headings = useMemo(() => parseHeadings(content), [content]);

  if (headings.length === 0) return <></>;

  return (
    <div className="w-44 flex-shrink-0 border-r border-white/10 overflow-y-auto py-3 hidden xl:block">
      <div className="px-3 mb-2 text-xs font-semibold text-white/40 uppercase tracking-wide">목차</div>
      <nav className="space-y-0.5">
        {headings.map((h, i) => (
          <button
            key={i}
            onClick={() => onJumpToLine(h.lineIndex)}
            className="w-full text-left px-3 py-1 text-xs text-white/60 hover:text-white hover:bg-white/5 rounded transition-colors truncate"
            style={{ paddingLeft: `${(h.level - 1) * 8 + 12}px` }}
            title={h.text}
          >
            {h.text}
          </button>
        ))}
      </nav>
    </div>
  );
}
