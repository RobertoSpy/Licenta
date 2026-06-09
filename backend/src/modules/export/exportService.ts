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
import { prisma } from '../../lib/prisma';
import { conformityService } from '../../core/services/conformityService';

export interface ExportProjectData {
  title: string;
  county: string | null;
  locality: string | null;
  houseType: string | null;
  floors: number | null;
  totalFloorAreaSqm: number | null;
  // Terrain & Regulations
  plotAreaSqm: number | null;
  soilType: string | null;
  slopePercent: number | null;
  streetOrientation: string | null;
  soilNotes: string | null;
  maxAllowedFloors: number | null;
  minFoundationDepthCm: number | null;
  zoningRestrictions: string | null;
  // Architecture
  buildingPurpose: string | null;
  budgetCategory: string | null;
  chatSummaries: Array<{ phase: string; screen: string | null; summary: string }>;
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

function computeUsableSqm(
  widthPx: number, 
  heightPx: number, 
  wallThicknessCm: number | { left: number; right: number; top: number; bottom: number } = 25
): number {
  let leftCm, rightCm, topCm, bottomCm;

  if (typeof wallThicknessCm === 'number') {
    leftCm = rightCm = topCm = bottomCm = wallThicknessCm;
  } else {
    leftCm = wallThicknessCm.left;
    rightCm = wallThicknessCm.right;
    topCm = wallThicknessCm.top;
    bottomCm = wallThicknessCm.bottom;
  }

  const leftPx = (leftCm / 100) * PIXELS_PER_METER;
  const rightPx = (rightCm / 100) * PIXELS_PER_METER;
  const topPx = (topCm / 100) * PIXELS_PER_METER;
  const bottomPx = (bottomCm / 100) * PIXELS_PER_METER;

  const usableWidthPx = Math.max(0, widthPx - leftPx - rightPx);
  const usableHeightPx = Math.max(0, heightPx - topPx - bottomPx);
  return parseFloat((pxToMeters(usableWidthPx) * pxToMeters(usableHeightPx)).toFixed(2));
}

function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
  const safeTitle = escapeHtml(project.title);

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

    /* ── Stiluri Comune Pagini Noi ── */
    .content-page { width: 210mm; min-height: 297mm; padding: 48px; page-break-after: always; }
    .page-header { border-bottom: 2px solid #f97316; padding-bottom: 12px; margin-bottom: 32px; }
    .page-title { font-size: 24px; font-weight: 900; color: #1e293b; }
    .section-title { font-size: 16px; font-weight: 700; color: #334155; margin-bottom: 16px; margin-top: 32px; text-transform: uppercase; letter-spacing: 0.05em; }
    .data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .data-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
    .data-label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }
    .data-value { font-size: 15px; font-weight: 700; color: #1e293b; }
    .chat-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #22c55e; border-radius: 8px; padding: 20px; margin-top: 24px; font-size: 13px; line-height: 1.6; color: #166534; }
    .chat-title { font-size: 12px; font-weight: 800; text-transform: uppercase; margin-bottom: 8px; color: #15803d; display: flex; align-items: center; gap: 6px; }

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
        <div class="cover-title">${safeTitle}</div>
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

  <!-- ══ PAGINA 2: DATE TEREN ȘI REGLEMENTĂRI ════════════════════ -->
  <div class="content-page">
    <div class="page-header">
      <div class="page-title">I. Analiza Terenului și Reglementări</div>
    </div>

    <div class="section-title">Date Geotehnice și Topografice</div>
    <div class="data-grid">
      <div class="data-box">
        <div class="data-label">Suprafață Teren</div>
        <div class="data-value">${project.plotAreaSqm ? project.plotAreaSqm.toFixed(1) + ' mp' : 'Nespecificat'}</div>
      </div>
      <div class="data-box">
        <div class="data-label">Tipul Solului</div>
        <div class="data-value">${project.soilType ?? 'Nespecificat'}</div>
      </div>
      <div class="data-box">
        <div class="data-label">Înclinare (Panta)</div>
        <div class="data-value">${project.slopePercent !== null ? project.slopePercent + '%' : 'Plat'}</div>
      </div>
      <div class="data-box">
        <div class="data-label">Orientare Stradală</div>
        <div class="data-value">${project.streetOrientation ?? 'Nespecificat'}</div>
      </div>
    </div>

    <div class="section-title">Reglementări Urbanistice Locale</div>
    <div class="data-grid">
      <div class="data-box">
        <div class="data-label">Regim Maxim Permis</div>
        <div class="data-value">${project.maxAllowedFloors ? 'P+' + (project.maxAllowedFloors - 1) : 'Nespecificat'}</div>
      </div>
      <div class="data-box">
        <div class="data-label">Adâncime Fundație (Îngheț)</div>
        <div class="data-value">${project.minFoundationDepthCm ? project.minFoundationDepthCm + ' cm' : 'Nespecificat'}</div>
      </div>
      <div class="data-box" style="grid-column: 1 / -1;">
        <div class="data-label">Restricții Zonale / Note</div>
        <div class="data-value" style="font-size: 13px; font-weight: normal; margin-top: 8px;">${project.zoningRestrictions || project.soilNotes || 'Nu au fost identificate restricții speciale.'}</div>
      </div>
    </div>

    ${project.chatSummaries.find(s => s.phase === 'faza1') ? `
    <div class="section-title" style="margin-top: 48px;">Concluziile Agenților AI (Faza 1)</div>
    <div class="chat-box">
      <div class="chat-title">✦ Rezumat Geotehnic & Urbanistic</div>
      <div>${escapeHtml(project.chatSummaries.find(s => s.phase === 'faza1')?.summary).replace(/\\n/g, '<br/>')}</div>
    </div>` : ''}
  </div>

  <!-- ══ PAGINA 3: CONCEPT ARHITECTURAL ══════════════════════════ -->
  <div class="content-page">
    <div class="page-header">
      <div class="page-title">II. Concept Arhitectural</div>
    </div>

    <div class="section-title">Parametri Generali</div>
    <div class="data-grid">
      <div class="data-box">
        <div class="data-label">Stil Arhitectural</div>
        <div class="data-value">${project.houseType ?? 'Standard'}</div>
      </div>
      <div class="data-box">
        <div class="data-label">Tip Construcție</div>
        <div class="data-value">${project.buildingPurpose === 'commercial' ? 'Comercial' : project.buildingPurpose === 'mixed' ? 'Mixt' : 'Rezidențial'}</div>
      </div>
      <div class="data-box">
        <div class="data-label">Categorie Buget</div>
        <div class="data-value" style="text-transform: capitalize;">${project.budgetCategory ?? 'Mediu'}</div>
      </div>
      <div class="data-box">
        <div class="data-label">Regim Înălțime Final</div>
        <div class="data-value">${project.floors !== null ? 'P+' + (project.floors - 1) : 'Parter'}</div>
      </div>
    </div>

    ${project.chatSummaries.find(s => s.phase === 'faza2') ? `
    <div class="section-title" style="margin-top: 48px;">Consultant AI Arhitectural (Faza 2)</div>
    <div class="chat-box" style="background: #eff6ff; border-color: #bfdbfe; border-left-color: #3b82f6; color: #1e40af;">
      <div class="chat-title" style="color: #1d4ed8;">✦ Note Arhitect & Layout</div>
      <div>${escapeHtml(project.chatSummaries.find(s => s.phase === 'faza2')?.summary).replace(/\\n/g, '<br/>')}</div>
    </div>` : ''}
  </div>

  <!-- ══ PAGINA 4: PLAN PARTER ══════════════════════════════════ -->
  <div class="plan-page">
    <div class="plan-header">
      <div>
        <div class="plan-title">Plan Parter — ${safeTitle}</div>
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
// HTML TEMPLATE — Contractor PDF
// ─────────────────────────────────────────────────────────────────
function buildContractorHtmlTemplate(project: any, bom: any[], snapshot: any, planPngBase64: string | null): string {
  const safeTitle = escapeHtml(project.title);
  const generatedAt = new Date().toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' });
  const snapshotVersion = snapshot ? snapshot.version : 1;

  let bomRows = '<tr><td colspan="4" style="padding:10px;text-align:center;color:#94a3b8">Niciun material în BOM</td></tr>';
  if (bom && bom.length > 0) {
    bomRows = bom.map(item => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9">${item.phase}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9">${item.material?.name || 'Material'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:center">${item.quantity} ${item.material?.unit || 'buc'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:center">${item.formula || '-'}</td>
      </tr>
    `).join('');
  }

  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; }
    .page { width: 210mm; height: 297mm; display: flex; flex-direction: column; padding: 32px 40px; page-break-after: always; }
    .header { font-size: 24px; font-weight: 900; color: #f97316; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 30px; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
    .meta-label { font-size: 11px; color: #64748b; }
    .meta-value { font-size: 16px; font-weight: 700; color: #1e293b; margin-top: 4px; }
    .plan-image { width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 20px; }
    .plan-image img { width: 100%; display: block; }
    .table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .table th { background: #f8fafc; padding: 8px 10px; text-align: left; font-weight: 700; color: #475569; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
    .table td { vertical-align: middle; }
    @media print { @page { size: A4; margin: 0; } }
  </style>
</head>
<body>
  <!-- PAGINA 1: Date tehnice -->
  <div class="page">
    <div class="header">Proiect de execuție: ${safeTitle}</div>
    <div class="meta-grid">
      <div class="meta-box"><div class="meta-label">Locație</div><div class="meta-value">${escapeHtml(project.locality)}, ${escapeHtml(project.county)}</div></div>
      <div class="meta-box"><div class="meta-label">Zonă Seismică</div><div class="meta-value">${escapeHtml(project.seismicZone) || '—'}</div></div>
      <div class="meta-box"><div class="meta-label">Adâncime Îngheț</div><div class="meta-value">${project.frostDepthCm ? project.frostDepthCm + ' cm' : '—'}</div></div>
      <div class="meta-box"><div class="meta-label">Regim Înălțime</div><div class="meta-value">P+${project.totalFloors ? project.totalFloors - 1 : 0}</div></div>
    </div>
    <p style="font-size:12px;color:#64748b">Document pentru contractor · Generat la ${generatedAt}</p>
  </div>

  <!-- PAGINA 2: Plan 2D -->
  <div class="page">
    <div class="header">Plan Arhitectural v${snapshotVersion}</div>
    <div class="plan-image">
      ${planPngBase64 ? `<img src="data:image/png;base64,${planPngBase64}" alt="Plan parter" />` : '<div style="padding:40px;text-align:center;color:#94a3b8">Imagine lipsă</div>'}
    </div>
  </div>

  <!-- PAGINA 3+: Deviz BOM -->
  <div class="page" style="page-break-after: auto;">
    <div class="header">Deviz Cantități (BOM)</div>
    <table class="table">
      <thead>
        <tr>
          <th>Faza</th>
          <th>Material</th>
          <th style="text-align:center">Cantitate</th>
          <th style="text-align:center">Formulă</th>
        </tr>
      </thead>
      <tbody>
        ${bomRows}
      </tbody>
    </table>
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
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        chatSummaries: true
      }
    });

    if (!project) return null;
    const snapshot = await prisma.planSnapshot.findFirst({
      where: { projectId },
      orderBy: [{ isPublished: 'desc' }, { version: 'desc' }],
    });

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
        title: project.title,
        county: project.county,
        locality: project.locality,
        houseType: project.houseStyle ?? null,
        floors: project.totalFloors ?? null,
        totalFloorAreaSqm: project.totalFloorAreaSqm ?? null,
        plotAreaSqm: project.plotAreaSqm ?? null,
        soilType: project.soilType ?? null,
        slopePercent: project.slopePercent ?? null,
        streetOrientation: project.streetOrientation ?? null,
        soilNotes: project.soilNotes ?? null,
        maxAllowedFloors: project.maxAllowedFloors ?? null,
        minFoundationDepthCm: project.minFoundationDepthCm ?? null,
        zoningRestrictions: project.zoningRestrictions ?? null,
        buildingPurpose: project.buildingPurpose ?? null,
        budgetCategory: project.budgetCategory ?? null,
        chatSummaries: project.chatSummaries.map(s => ({
          phase: s.phase,
          screen: s.screen,
          summary: s.summary
        }))
      },
      planPngBase64,
      rooms,
      generatedAt,
      snapshot.version,
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

  /**
   * Generează PDF de execuție pentru contractor pe baza unui Quote acceptat sau în așteptare.
   */
  async generateContractorPdf(
    quoteId: number,
    contractorId: number,
    planPngBase64: string | null
  ): Promise<{ buffer: Buffer; filename: string } | null> {
    // 1. Verifică că quote-ul aparține contractorului
    const quote = await prisma.contractorQuote.findFirst({
      where: { id: quoteId, contractorId },
      include: { project: true }
    });

    if (!quote) return null;

    // 2. Ia BOM-ul proiectului
    const bom = await prisma.projectBOM.findMany({
      where: { projectId: quote.projectId },
      include: { material: true },
      orderBy: { phase: 'asc' },
    });

    // 3. Ia snapshot-ul publicat
    const snapshot = await prisma.planSnapshot.findFirst({
      where: { projectId: quote.projectId, isPublished: true },
      orderBy: { version: 'desc' }
    });

    // 4. Generează HTML
    const html = buildContractorHtmlTemplate(quote.project, bom, snapshot, planPngBase64);

    // 5. Puppeteer → PDF
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

      const slug = quote.project.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const filename = `proiect-executie-${slug}.pdf`;

      return { buffer: Buffer.from(pdfBuffer), filename };
    } finally {
      await browser.close();
    }
  }
};

export const _testable = {
  pxToMeters,
  computeUsableSqm,
  buildHtmlTemplate,
  buildContractorHtmlTemplate,
  escapeHtml
} as const;
