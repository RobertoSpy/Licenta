import { editorRepository, type FloorKey } from './editorRepository';

export const editorService = {
  /**
   * Salvare snapshot (auto-save sau manual Ctrl+S) pentru un etaj specific.
   * Apelează cleanup automat după salvare (păstrează ultimele 20 per etaj).
   */
  async saveSnapshot(projectId: number, planJSON: object, floor: FloorKey = 'parter', label?: string) {
    const snapshot = await editorRepository.createSnapshot(projectId, planJSON, floor, label);
    await editorRepository.cleanupOldSnapshots(projectId, floor);
    return snapshot;
  },

  /**
   * Lista ultimelor 20 snapshot-uri pentru un proiect.
   * Dacă floor e specificat — filtrează pe etaj.
   */
  async listSnapshots(projectId: number, floor?: FloorKey) {
    return editorRepository.listSnapshots(projectId, floor);
  },

  /**
   * Conținut complet snapshot — pentru restore în editor.
   */
  async getSnapshot(snapshotId: number) {
    return editorRepository.getSnapshot(snapshotId);
  },

  /**
   * Ownership check pentru snapshot (via proiect) cu extra layer anti-cross-project reference.
   */
  async verifySnapshotOwnership(snapshotId: number, userId: number, projectId?: number): Promise<boolean> {
    return editorRepository.verifySnapshotOwnership(snapshotId, userId, projectId);
  },

  /**
   * Cel mai recent snapshot al unui proiect pe etajul specificat.
   */
  async getLatestSnapshot(projectId: number, floor?: FloorKey) {
    return editorRepository.getLatestSnapshot(projectId, floor);
  },

  /**
   * Publică snapshot ca versiunea oficială → input pentru Faza 3 (BOM).
   */
  async publishSnapshot(snapshotId: number, projectId: number) {
    return editorRepository.publishSnapshot(snapshotId, projectId);
  },

  /**
   * Ștergere snapshot (cu validare ownership în controller).
   */
  async deleteSnapshot(snapshotId: number) {
    return editorRepository.deleteSnapshot(snapshotId);
  },
};
