// backend/src/services/exportService.ts
//
// Export Plan 2D — PDF de prezentare (2 pagini) + PNG via Konva frontend
//
// ARHITECTURA:
//   • PNG   — exportat direct din frontend (Konva Stage.toDataURL) fără backend
//   • PDF   — generat backend cu Puppeteer: renderizează HTML template → PDF A4
//
// Structura PDF:
//   Pagina 1 — Copertă: titlu proiect, județ, localitate, dată, rezumat
//   Pagina 2 — Plan parter: imagine PNG + scară + legendă + tabel camere
//
// Fluxul:
//   1. exportController cere snapshot publicat din DB (editorRepository)
//   2. exportService renderizează HTML cu datele proiectului + PNG inline (base64)
//   3. Puppeteer generează PDF și îl returnează ca Buffer
//   4. Controller trimite Buffer cu Content-Type: application/pdf

import puppeteer from 'puppeteer';
import { prisma } from '../lib/prisma';
import { conformityService } from './conformityService';

export interface ExportProjectData {
  title: string;
  county: string | null;
  locality: string | null;
  houseType: string | null;
  floors: number | null;
  totalFloorAreaSqm: number | null;
}

interface RoomRow {
  label: string;
  usableSqm: number;
  status: 'ok' | 'warning' | 'error';
}

const PIXELS_PER_METER = 20;

function pxToMeters(px: number): number {
  return px / PIXELS_PER_METER;
}

function computeUsableSqm(widthPx: number, heightPx: number, wallThicknessCm = 25): number {
  const thicknessPx = (wallThicknessCm / 100) * PIXELS_PER_METER;
  const usableWidthPx = Math.max(0, widthPx - 2 * thicknessPx);
  const usableHeightPx = Math.max(0, heightPx - 2 * thicknessPx);
  return parseFloat((pxToMeters(usableWidthPx) * pxToMeters(usableHeightPx)).toFixed(2));
}

// ─────────────────────────────────────────────────────────────────
// HTML TEMPLATE — Copertă + Plan (renderizat de Puppeteer)
// ─────────────────────────────────────────────────────────────────

function buildHtmlTemplate(
  project: ExportProjectData,
  planPngBase64: string | null,
  rooms: RoomRow[],
  generatedAt: string,
  snapshotVersion: number,
): string {
  const totalSqm = rooms.reduce((acc, r) => acc + r.usableSqm, 0).toFixed(1);
  const violationsCount = rooms.filter((r) => r.status === 'error').length;

  const roomRows = rooms
    .map((r) => {
      const statusBadge =
        r.status === 'ok'
          ? '<span style="color:#16a34a">✓ Conform</span>'
          : r.status === 'warning'
          ? '<span style="color:#d97706">⚠ Aproape</span>'
          : '<span style="color:#dc2626">✗ Sub limită</span>';
      return `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9">${r.label}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:center">${r.usableSqm} m²</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:center">${statusBadge}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; }

    /* ── Pagina 1: Copertă ── */
    .cover {
      width: 210mm; height: 297mm;
      display: flex; flex-direction: column;
      padding: 0;
      page-break-after: always;
    }
    .cover-header {
      background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
      color: white; padding: 40px 48px;
    }
    .cover-logo { font-size: 28px; font-weight: 900; letter-spacing: -0.5px; }
    .cover-logo span { opacity: 0.7; }
    .cover-subtitle { font-size: 12px; opacity: 0.8; margin-top: 4px; }
    .cover-body { flex: 1; padding: 48px; display: flex; flex-direction: column; justify-content: space-between; }
    .cover-title { font-size: 32px; font-weight: 900; color: #1e293b; line-height: 1.2; }
    .cover-meta { margin-top: 24px; display: flex; flex-direction: column; gap: 10px; }
    .cover-meta-row { display: flex; gap: 8px; align-items: center; font-size: 14px; }
    .cover-meta-label { color: #64748b; min-width: 100px; }
    .cover-meta-value { font-weight: 600; color: #1e293b; }
    .cover-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 32px; }
    .cover-stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
    .cover-stat-value { font-size: 28px; font-weight: 900; color: #f97316; }
    .cover-stat-label { font-size: 11px; color: #64748b; margin-top: 2px; }
    .cover-footer { border-top: 1px solid #e2e8f0; padding-top: 16px; }
    .cover-footer-text { font-size: 11px; color: #94a3b8; }

    /* ── Pagina 2: Plan ── */
    .plan-page { width: 210mm; padding: 32px 40px; }
    .plan-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .plan-title { font-size: 18px; font-weight: 900; color: #1e293b; }
    .plan-version { font-size: 11px; color: #64748b; background: #f1f5f9; padding: 4px 10px; border-radius: 6px; }
    .plan-image { width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 20px; }
    .plan-image img { width: 100%; display: block; }
    .plan-no-image { height: 200px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 13px; background: #f8fafc; }
    .legend { display: flex; gap: 20px; margin-bottom: 20px; font-size: 11px; color: #64748b; }
    .legend-item { display: flex; align-items: center; gap: 6px; }
    .legend-swatch { width: 20px; height: 12px; border-radius: 2px; border: 1px solid currentColor; }
    .rooms-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .rooms-table th { background: #f8fafc; padding: 8px 10px; text-align: left; font-weight: 700; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid #e2e8f0; }
    .rooms-table td { vertical-align: middle; }
    .violations-note { margin-top: 12px; padding: 10px 14px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; font-size: 11px; color: #b91c1c; }

    @media print {
      @page { size: A4; margin: 0; }
    }
  </style>
</head>
<body>

  <!-- ══ PAGINA 1: COPERTĂ ══════════════════════════════════════ -->
  <div class="cover">
    <div class="cover-header">
      <div class="cover-logo">Zidario<span>.ro</span></div>
      <div class="cover-subtitle">Plan de arhitectură generat automat</div>
    </div>
    <div class="cover-body">
      <div>
        <div class="cover-title">${project.title}</div>
        <div class="cover-meta">
          <div class="cover-meta-row">
            <span class="cover-meta-label">📍 Locație</span>
            <span class="cover-meta-value">${project.locality ?? '—'}, ${project.county ?? '—'}</span>
          </div>
          <div class="cover-meta-row">
            <span class="cover-meta-label">🏠 Tip casă</span>
            <span class="cover-meta-value">${project.houseType ?? '—'}</span>
          </div>
          <div class="cover-meta-row">
            <span class="cover-meta-label">📐 Regim înălțime</span>
            <span class="cover-meta-value">${project.floors !== null ? `P+${(project.floors ?? 1) - 1}` : '—'}</span>
          </div>
        </div>

        <div class="cover-stats">
          <div class="cover-stat">
            <div class="cover-stat-value">${totalSqm}</div>
            <div class="cover-stat-label">mp suprafață utilă totală</div>
          </div>
          <div class="cover-stat">
            <div class="cover-stat-value">${rooms.length}</div>
            <div class="cover-stat-label">camere desenate</div>
          </div>
          <div class="cover-stat">
            <div class="cover-stat-value" style="color:${violationsCount > 0 ? '#dc2626' : '#16a34a'}">${violationsCount === 0 ? '✓' : violationsCount}</div>
            <div class="cover-stat-label">${violationsCount === 0 ? 'Plan conform Legea 114/1996' : `camere sub limita legală`}</div>
          </div>
          <div class="cover-stat">
            <div class="cover-stat-value">v${snapshotVersion}</div>
            <div class="cover-stat-label">versiunea planului</div>
          </div>
        </div>
      </div>

      <div class="cover-footer">
        <div class="cover-footer-text">Generat de Zidario.ro · ${generatedAt} · Scop informativ — nu înlocuiește proiectul tehnic semnat de arhitect</div>
      </div>
    </div>
  </div>

  <!-- ══ PAGINA 2: PLAN PARTER ══════════════════════════════════ -->
  <div class="plan-page">
    <div class="plan-header">
      <div>
        <div class="plan-title">Plan Parter — ${project.title}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">Scara: 1:100 · 1 celulă grid = 1m real</div>
      </div>
      <div class="plan-version">Versiunea ${snapshotVersion}</div>
    </div>

    <div class="plan-image">
      ${planPngBase64
        ? `<img src="data:image/png;base64,${planPngBase64}" alt="Plan parter" />`
        : '<div class="plan-no-image">Imaginea planului nu este disponibilă</div>'
      }
    </div>

    <div class="legend">
      <div class="legend-item">
        <div class="legend-swatch" style="background:#1e293b;border-color:#1e293b"></div>
        Perete exterior (25cm)
      </div>
      <div class="legend-item">
        <div class="legend-swatch" style="background:#64748b;border-color:#64748b"></div>
        Perete interior (12.5cm)
      </div>
      <div class="legend-item">
        <div class="legend-swatch" style="background:#f97316;border-color:#f97316"></div>
        Ușă
      </div>
      <div class="legend-item">
        <div class="legend-swatch" style="background:#3b82f6;border-color:#3b82f6"></div>
        Fereastră
      </div>
    </div>

    <!-- Tabel camere -->
    <table class="rooms-table">
      <thead>
        <tr>
          <th>Cameră</th>
          <th style="text-align:center">Suprafață utilă</th>
          <th style="text-align:center">Conformitate (Legea 114/1996)</th>
        </tr>
      </thead>
      <tbody>
        ${roomRows || '<tr><td colspan="3" style="padding:10px;text-align:center;color:#94a3b8">Nicio cameră desenată</td></tr>'}
      </tbody>
    </table>

    ${violationsCount > 0
      ? `<div class="violations-note">⚠ ${violationsCount} ${violationsCount === 1 ? 'cameră este' : 'camere sunt'} sub suprafețele minime impuse de Legea 114/1996, Art. 5. Consultați un arhitect autorizat pentru conformare.</div>`
      : ''
    }
  </div>

</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────
// EXPORT SERVICE
// ─────────────────────────────────────────────────────────────────

export const exportService = {
  /**
   * Generează PDF de prezentare pentru proiect.
   * Necesită snapshot publicat în DB.
   * Returnează Buffer PDF sau null dacă nu există snapshot publicat.
   */
  async generatePlanPdf(
    projectId: number,
    planPngBase64: string | null
  ): Promise<{ buffer: Buffer; filename: string } | null> {
    // 1. Fetch proiect + snapshot publicat
    // Notă: select fără câmpuri Faza 2 (totalFloorAreaSqm etc.) deoarece
    // Prisma client e stale — rulează `npx prisma generate` după migrație
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) return null;

    // Cast pentru câmpurile Faza 2 (există în DB dar Prisma client ncă le vede)
    const proj = project as unknown as {
      title: string;
      county: string | null;
      locality: string | null;
      houseStyle: string | null;
      totalFloors: number | null;
      totalFloorAreaSqm: number | null;
    };

    // Caută snapshot publicat; fallback pe ultimul
    // Notă: planSnapshot e model Faza 2 — Prisma client poate fi stale dacă
    // migrarea nu a rulat. În producție, rulează: npx prisma migrate dev
    const snapshots = await prisma.$queryRaw<Array<{
      id: number;
      version: number;
      isPublished: boolean;
      planJSON: unknown;
    }>>`
      SELECT id, version, "isPublished", "planJSON"
      FROM "PlanSnapshot"
      WHERE "projectId" = ${projectId}
      ORDER BY "isPublished" DESC, version DESC
      LIMIT 1
    `;

    const snapshot = snapshots[0] ?? null;

    if (!snapshot) return null;

    // 2. Extrage camere din planJSON
    const planJSON = snapshot.planJSON as {
      elements?: Array<{
        id: string;
        type: string;
        label?: string;
        width?: number;
        height?: number;
        wallThicknessCm?: number;
      }>;
    };

    const rawRooms = (planJSON.elements ?? [])
      .filter((el) => el.type === 'room')
      .map((el) => ({
        id: el.id,
        label: el.label ?? 'Cameră',
        usableSqm: computeUsableSqm(el.width ?? 0, el.height ?? 0, el.wallThicknessCm ?? 25),
      }));

    const results = await conformityService.evaluateRooms(rawRooms);
    const resultsById = new Map(results.rooms.map((r) => [r.id, r]));

    const rooms: RoomRow[] = rawRooms.map((room) => ({
      label: room.label,
      usableSqm: room.usableSqm,
      status: resultsById.get(room.id)?.status ?? 'ok',
    }));

    // 3. Build HTML
    const generatedAt = new Date().toLocaleDateString('ro-RO', {
      day: '2-digit', month: 'long', year: 'numeric',
    });

    const html = buildHtmlTemplate(
      {
        title: proj.title,
        county: proj.county,
        locality: proj.locality,
        houseType: proj.houseStyle ?? null,
        floors: proj.totalFloors ?? null,
        totalFloorAreaSqm: proj.totalFloorAreaSqm ?? null,
      },
      planPngBase64,
      rooms,
      generatedAt,
      (snapshot as unknown as { version: number }).version,
    );

    // 4. Puppeteer → PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });

      const slug = project.title
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      const filename = `plan-parter-${slug}-v${snapshot.version}.pdf`;

      return { buffer: Buffer.from(pdfBuffer), filename };
    } finally {
      await browser.close();
    }
  },
};
