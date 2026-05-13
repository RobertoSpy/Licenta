import { useEffect } from 'react';
import { CanvasElement, useEditorState } from './useEditorState';
import { apiPrivate } from '../api/axios';

const AUTO_SAVE_DELAY = 30_000; // 30 secunde

export function useEditorAutoSave(projectId: number) {
  const { elements, isDirty, markClean } = useEditorState();

  useEffect(() => {
    if (!isDirty || elements.length === 0) return;

    const timer = setTimeout(async () => {
      try {
        await apiPrivate.post('/editor/snapshots', {
          projectId,
          planJSON: { elements, savedAt: Date.now() },
        });
        markClean();
        console.log('[AutoSave] Plan salvat automat la', new Date().toLocaleTimeString('ro-RO'));
      } catch (err) {
        console.error('[AutoSave] Eroare la salvarea automată:', err);
      }
    }, AUTO_SAVE_DELAY);

    return () => clearTimeout(timer);
  }, [elements, isDirty, projectId, markClean]);
}
