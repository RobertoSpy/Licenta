import { useEffect } from 'react';
import { useEditorState } from './useEditorState';
import { editorApi } from '../api/editorApi';

const AUTO_SAVE_DELAY = 30_000; // 30 secunde

/**
 * Hook de auto-save multi-etaj.
 * Salvează elementele etajului activ după 30s de inactivitate,
 * dacă planul a fost modificat (isDirty).
 */
export function useEditorAutoSave(projectId: number) {
  const { elements, isDirty, activeFloor, markClean } = useEditorState();

  useEffect(() => {
    if (!isDirty || elements.length === 0) return;

    const timer = setTimeout(async () => {
      try {
        await editorApi.saveFloor(projectId, activeFloor, elements);
        markClean();
        console.log(
          `[AutoSave] Etaj "${activeFloor}" salvat automat la`,
          new Date().toLocaleTimeString('ro-RO')
        );
      } catch (err) {
        console.error('[AutoSave] Eroare la salvarea automată:', err);
      }
    }, AUTO_SAVE_DELAY);

    return () => clearTimeout(timer);
  }, [elements, isDirty, projectId, activeFloor, markClean]);
}
