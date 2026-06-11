import React from 'react';
import type { FileNode } from '../../types/electron';

interface Props {
  nodes: FileNode[];
  vaultPath: string;
  onOpen(filePath: string, vaultPath: string): void;
}

function TreeNode({ node, vaultPath, onOpen }: { node: FileNode; vaultPath: string; onOpen: Props['onOpen'] }): React.ReactElement {
  const [expanded, setExpanded] = React.useState(false);

  if (node.children) {
    return (
      <div>
        <button
          onClick={() => setExpanded((x) => !x)}
          className="flex items-center gap-1 text-sm text-white/70 hover:text-white px-2 py-0.5 w-full text-left"
        >
          <span>{expanded ? '▾' : '▸'}</span>
          <span>{node.name}</span>
        </button>
        {expanded && (
          <div className="pl-3">
            {node.children.map((child) => (
              <TreeNode key={child.path} node={child} vaultPath={vaultPath} onOpen={onOpen} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onOpen(node.path, vaultPath)}
      className="flex items-center gap-1 text-sm text-white/60 hover:text-white px-2 py-0.5 w-full text-left"
    >
      <span>📝</span>
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function FileTree({ nodes, vaultPath, onOpen }: Props): React.ReactElement {
  return (
    <div className="py-2">
      {nodes.map((node) => (
        <TreeNode key={node.path} node={node} vaultPath={vaultPath} onOpen={onOpen} />
      ))}
    </div>
  );
}
