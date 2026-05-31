import { prisma } from '../../lib/prisma';

export type FloorKey = 'parter' | 'etaj1' | 'etaj2' | 'mansarda';

export const editorRepository = {
  /**
   * Creare snapshot nou — auto-increment version per (proiect, etaj).
   */
  async createSnapshot(projectId: number, planJSON: object, floor: FloorKey = 'parter', label?: string) {
    // Versiunea se incrementează per (proiect, etaj) — nu global
    const last = await prisma.planSnapshot.findFirst({
      where: { projectId, floor },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (last?.version ?? 0) + 1;

    return prisma.planSnapshot.create({
      data: { projectId, planJSON, floor, version: nextVersion, label },
    });
  },

  /**
   * Ultimele 20 snapshot-uri pentru un proiect, opțional filtrate pe etaj.
   */
  async listSnapshots(projectId: number, floor?: FloorKey) {
    return prisma.planSnapshot.findMany({
      where: { projectId, ...(floor ? { floor } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        version: true,
        floor: true,
        label: true,
        isPublished: true,
        createdAt: true,
      },
    });
  },

  /**
   * Conținutul complet al unui snapshot specific (pentru restore).
   */
  async getSnapshot(id: number) {
    return prisma.planSnapshot.findUnique({ where: { id } });
  },

  /**
   * Verifică dacă un snapshot aparține userului curent (via proiect).
   */
  async verifySnapshotOwnership(snapshotId: number, userId: number): Promise<boolean> {
    const snapshot = await prisma.planSnapshot.findUnique({
      where: { id: snapshotId },
      include: { project: { select: { userId: true } } },
    });
    return snapshot?.project.userId === userId;
  },

  /**
   * Cel mai recent snapshot al unui proiect pe un anumit etaj.
   * Dacă floor nu e specificat → returnează cel mai recent indiferent de etaj (backward compat).
   */
  async getLatestSnapshot(projectId: number, floor?: FloorKey) {
    return prisma.planSnapshot.findFirst({
      where: { projectId, ...(floor ? { floor } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Publică un snapshot — marchează ca versiunea oficială → input pentru Faza 3 (BOM).
   * Dezactivează flag-ul isPublished pe toate celelalte snapshot-uri ale proiectului.
   */
  async publishSnapshot(snapshotId: number, projectId: number) {
    await prisma.planSnapshot.updateMany({
      where: { projectId },
      data: { isPublished: false },
    });

    const published = await prisma.planSnapshot.update({
      where: { id: snapshotId },
      data: { isPublished: true },
    });

    await prisma.project.update({
      where: { id: projectId },
      data: { publishedSnapshotId: snapshotId, planStatus: 'published' },
    });

    return published;
  },

  /**
   * Ștergere snapshot. Ownership check se face în controller.
   */
  async deleteSnapshot(id: number) {
    return prisma.planSnapshot.delete({ where: { id } });
  },

  /**
   * Auto-cleanup: păstrăm doar ultimele 20 snapshot-uri per (proiect, etaj).
   */
  async cleanupOldSnapshots(projectId: number, floor: FloorKey = 'parter') {
    const snapshots = await prisma.planSnapshot.findMany({
      where: { projectId, floor, isPublished: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (snapshots.length > 20) {
      const toDelete = snapshots.slice(20).map((s) => s.id);
      await prisma.planSnapshot.deleteMany({ where: { id: { in: toDelete } } });
    }
  },
};
