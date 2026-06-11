import React, { useEffect, useRef, useCallback } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { useDocsStore } from '../../store/docs';

interface Props {
  docId: string;
  vaultPath?: string;
}

export function DocEditor({ docId, vaultPath }: Props): React.ReactElement {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { docs, fetchDoc, saveDoc } = useDocsStore();
  const doc = docs[docId];

  useEffect(() => {
    void fetchDoc(docId);
  }, [docId, fetchDoc]);

  const scheduleSave = useCallback(
    (content: string) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveDoc(docId, content, vaultPath);
      }, 1000);
    },
    [docId, saveDoc, vaultPath]
  );

  useEffect(() => {
    if (!editorRef.current || !doc) return;
    if (viewRef.current) {
      viewRef.current.destroy();
    }
    const view = new EditorView({
      doc: doc.content ?? '',
      extensions: [
        basicSetup,
        markdown(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            scheduleSave(update.state.doc.toString());
          }
        }),
      ],
      parent: editorRef.current,
    });
    viewRef.current = view;
    return () => { view.destroy(); clearTimeout(saveTimer.current); };
  }, [doc?.id, scheduleSave]);

  if (!doc) {
    return <div className="flex-1 flex items-center justify-center text-white/40">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-3 border-b border-white/10">
        <h1 className="text-lg font-semibold">{doc.title}</h1>
      </div>
      <div ref={editorRef} className="flex-1 overflow-auto text-sm" />
    </div>
  );
}
