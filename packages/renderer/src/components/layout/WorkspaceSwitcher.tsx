import React from 'react';

interface Workspace {
  id: string;
  name: string;
  iconUrl?: string;
}

interface Props {
  workspaces: Workspace[];
  activeId: string | null;
  onSelect(id: string): void;
  onCreateNew(): void;
}

export function WorkspaceSwitcher({ workspaces, activeId, onSelect, onCreateNew }: Props): React.ReactElement {
  return (
    <div className="flex flex-col items-center gap-2 py-3 w-14 bg-sidebar border-r border-white/10">
      {workspaces.map((ws) => (
        <button
          key={ws.id}
          onClick={() => onSelect(ws.id)}
          title={ws.name}
          className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-all
            ${activeId === ws.id ? 'bg-accent text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
        >
          {ws.iconUrl ? (
            <img src={ws.iconUrl} alt={ws.name} className="w-full h-full rounded-lg object-cover" />
          ) : (
            ws.name.charAt(0).toUpperCase()
          )}
        </button>
      ))}
      {/* Create new workspace */}
      <button
        onClick={onCreateNew}
        title="새 워크스페이스 만들기"
        className="w-9 h-9 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 border border-dashed border-white/20 hover:border-white/40 transition-all text-lg"
      >
        +
      </button>
    </div>
  );
}
