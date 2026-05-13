import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const editorRepository = {
  /**
   * Creare snapshot nou — auto-increment version per proiect.
   */
  async createSnapshot(projectId: number, planJSON: object, label?: string) {
    // Calculăm versiunea: max(version) + 1 pentru proiectul dat
    const last = await prisma.planSnapshot.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (last?.version ?? 0) + 1;

    return prisma.planSnapshot.create({
      data: { projectId, planJSON, version: nextVersion, label },
    });
  },

  /**
   * Ultimele 20 snapshot-uri pentru un proiect (fără planJSON — doar metadate).
   */
  async listSnapshots(projectId: number) {
    return prisma.planSnapshot.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        version: true,
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
   * Obține cel mai recent snapshot al unui proiect (sau cel publicat).
   */
  async getLatestSnapshot(projectId: number) {
    return prisma.planSnapshot.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Publică un snapshot — marchează ca versiunea oficială → input Faza 3.
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
   * Auto-cleanup: păstrăm doar ultimele 20 snapshot-uri per proiect.
   */
  async cleanupOldSnapshots(projectId: number) {
    const snapshots = await prisma.planSnapshot.findMany({
      where: { projectId, isPublished: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (snapshots.length > 20) {
      const toDelete = snapshots.slice(20).map((s) => s.id);
      await prisma.planSnapshot.deleteMany({ where: { id: { in: toDelete } } });
    }
  },
};
