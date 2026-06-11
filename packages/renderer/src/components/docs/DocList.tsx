import React, { useEffect, useState } from 'react';
import { useDocsStore } from '../../store/docs';
import type { Doc } from '../../store/docs';

interface Props {
  workspaceId: string;
  onSelect(id: string): void;
}

export function DocList({ workspaceId, onSelect }: Props): React.ReactElement {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [query, setQuery] = useState('');
  const { fetchDocs } = useDocsStore();

  useEffect(() => {
    fetchDocs(workspaceId, query || undefined).then(setDocs).catch(() => {});
  }, [workspaceId, query, fetchDocs]);

  return (
    <div className="flex flex-col gap-2 p-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search documents..."
        className="bg-white/10 rounded px-3 py-1.5 text-sm outline-none placeholder-white/40"
      />
      {docs.map((doc) => (
        <button
          key={doc.id}
          onClick={() => onSelect(doc.id)}
          className="text-left px-3 py-2 rounded hover:bg-white/10 text-sm"
        >
          <div className="font-medium">{doc.title}</div>
          <div className="text-xs text-white/40">
            {doc.source !== 'internal' && <span className="mr-2 text-accent">[{doc.source}]</span>}
            {new Date(doc.updatedAt).toLocaleDateString()}
          </div>
        </button>
      ))}
    </div>
  );
}
