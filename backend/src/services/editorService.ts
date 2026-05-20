import { editorRepository } from '../repositories/editorRepository';

export const editorService = {
  /**
   * Salvare snapshot (auto-save sau manual Ctrl+S).
   * Apelează cleanup automat după salvare.
   */
  async saveSnapshot(projectId: number, planJSON: object, label?: string) {
    const snapshot = await editorRepository.createSnapshot(projectId, planJSON, label);
    await editorRepository.cleanupOldSnapshots(projectId);
    return snapshot;
  },

  /**
   * Lista ultimelor 20 snapshot-uri (metadate, fără JSON complet).
   */
  async listSnapshots(projectId: number) {
    return editorRepository.listSnapshots(projectId);
  },

  /**
   * Conținut complet snapshot — pentru restore în editor.
   */
  async getSnapshot(snapshotId: number) {
    return editorRepository.getSnapshot(snapshotId);
  },

  /**
   * Ownership check pentru snapshot (via proiect).
   */
  async verifySnapshotOwnership(snapshotId: number, userId: number): Promise<boolean> {
    return editorRepository.verifySnapshotOwnership(snapshotId, userId);
  },

  /**
   * Cel mai recent snapshot al proiectului — pentru inițializarea editorului.
   */
  async getLatestSnapshot(projectId: number) {
    return editorRepository.getLatestSnapshot(projectId);
  },

  /**
   * Publică snapshot ca versiune oficială → input pentru Faza 3 (BOM).
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
