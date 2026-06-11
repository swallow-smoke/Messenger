import { useEffect } from 'react';
import { useDocsStore } from '../store/docs';

export function useObsidian(vaultPath: string | null): void {
  const { loadObsidianTree } = useDocsStore();

  useEffect(() => {
    if (!vaultPath || !window.electron) return;

    void loadObsidianTree(vaultPath);
    void window.electron.obsidian.startWatch(vaultPath);

    window.electron.obsidian.onChanged(({ event, path }) => {
      if (event !== 'unlink') {
        void loadObsidianTree(vaultPath);
      }
    });

    return () => {
      void window.electron?.obsidian.stopWatch();
    };
  }, [vaultPath, loadObsidianTree]);
}
