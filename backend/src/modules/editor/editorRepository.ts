import { prisma } from '../../lib/prisma';
import { extractMetricsFromSnapshot } from '../../lib/planMetricsExtractor';

export type FloorKey = 'parter' | 'etaj1';

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
   * Verifică dacă un snapshot aparține userului curent (via proiect), 
   * dar permite și injectarea de projectId pentru a asigura non-cross-project reference.
   */
  async verifySnapshotOwnership(snapshotId: number, userId: number, projectId?: number): Promise<boolean> {
    const snapshot = await prisma.planSnapshot.findUnique({
      where: { id: snapshotId },
      include: { project: { select: { userId: true, id: true } } },
    });
    
    if (!snapshot) return false;
    if (snapshot.project.userId !== userId) return false;
    if (projectId && snapshot.project.id !== projectId) return false;

    return true;
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
   * Invalidează BOM-ul existent (bomGeneratedAt = null) pentru a garanta sincronizarea.
   */
  async publishSnapshot(snapshotId: number, projectId: number) {
    await prisma.planSnapshot.updateMany({
      where: { projectId },
      data: { isPublished: false },
    });

    const published = await prisma.planSnapshot.update({
      where: { id: snapshotId },
      data: { isPublished: true },
      include: { project: { select: { totalFloors: true } } }
    });

    let totalArea: number | null = null;
    try {
      const floorsCount = published.project.totalFloors || 1;
      const res = extractMetricsFromSnapshot([published.planJSON], floorsCount);
      if (res.fromSnapshot) {
        totalArea = res.metrics.totalFloorAreaSqm;
      }
    } catch (e) {
      console.error('[publishSnapshot] Eroare extragere suprafata:', e);
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { 
        publishedSnapshotId: snapshotId, 
        planStatus: 'published',
        bomGeneratedAt: null, // invalidate BOM
        ...(totalArea ? { totalFloorAreaSqm: totalArea } : {})
      },
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
   * Snapshot-urile publicate nu sunt șterse niciodată (indiferent de createdAt).
   */
  async cleanupOldSnapshots(projectId: number, floor: FloorKey = 'parter') {
    const snapshots = await prisma.planSnapshot.findMany({
      where: { projectId, floor, isPublished: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (snapshots.length > 20) {
      // păstrăm cele mai noi 20 (slice-ul sare peste primele 20 și le ia pe restul pentru ștergere)
      const toDelete = snapshots.slice(20).map((s) => s.id);
      await prisma.planSnapshot.deleteMany({ where: { id: { in: toDelete } } });
    }
  },
};
