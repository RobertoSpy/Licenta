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
  // NEW FIELDS
  lat: number | null;
  lng: number | null;
  seismicZone: string | null;
  frostDepthCm: number | null;
  hasBasement: boolean;
  hasGroundFloor: boolean;
  upperFloorsCount: number;
  hasMansard: boolean;
}

interface RoomRow {
  label: string;
  usableSqm: number;
  status: 'ok' | 'warning' | 'error';
  minRequiredSqm?: number;
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

function buildHtmlTemplate(
  project: ExportProjectData,
  planPngBase64: string | null,
  rooms: RoomRow[],
  generatedAt: string,
  snapshotVersion: number,
): string {
  const totalSqmFloat = rooms.reduce((acc, r) => acc + r.usableSqm, 0);
  const totalSqm = totalSqmFloat.toFixed(1);
  const totalBuiltSqm = project.totalFloorAreaSqm ? project.totalFloorAreaSqm.toFixed(1) : (totalSqmFloat * 1.25).toFixed(1);
  const violationsCount = rooms.filter((r) => r.status === 'error').length;
  const safeTitle = escapeHtml(project.title);

  const getNorthRotation = (orientation: string | null): number => {
    if (!orientation) return 0;
    const map: Record<string, number> = {
      'N': 180, 'NE': 225, 'E': 270, 'SE': 315,
      'S': 0, 'SV': 45, 'V': 90, 'NV': 135,
    };
    return map[orientation] ?? 0;
  };

  const configParts = [];
  if (project.hasBasement) configParts.push('Subsol');
  if (project.hasGroundFloor) configParts.push('Parter');
  if (project.upperFloorsCount > 0) configParts.push(`Etaje: ${project.upperFloorsCount}`);
  if (project.hasMansard) configParts.push('Mansardă');
  const configString = configParts.length > 0 ? configParts.join(' / ') : 'Parter';

  const roomRows = rooms
    .map((r) => {
      const statusBadge =
        r.status === 'ok'
          ? '<span style="color:#16a34a">✓ Conform</span>'
          : r.status === 'warning'
          ? '<span style="color:#d97706">⚠ Aproape</span>'
          : '<span style="color:#dc2626">✗ Neconform</span>';
      return `<tr>
        <td>${escapeHtml(r.label)}</td>
        <td style="text-align:center">${r.usableSqm.toFixed(1)} mp</td>
        <td style="text-align:center">${r.minRequiredSqm ? r.minRequiredSqm.toFixed(1) + ' mp' : '-'}</td>
        <td style="text-align:center">${statusBadge}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; }
    
    .page { width: 210mm; height: 297mm; padding: 48px; page-break-after: always; display: flex; flex-direction: column; }
    .page-center { justify-content: center; align-items: center; text-align: center; }
    
    /* Cover */
    .cover-header { margin-bottom: 60px; }
    .cover-logo { font-size: 36px; font-weight: 900; color: #f97316; }
    .cover-logo span { color: #1e293b; }
    .cover-title { font-size: 32px; font-weight: 900; margin-bottom: 8px; }
    .cover-address { font-size: 18px; color: #64748b; margin-bottom: 24px; }
    .cover-date { font-size: 14px; color: #94a3b8; margin-bottom: 60px; }
    .cover-summary { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; max-width: 500px; margin: 0 auto; text-align: left; width: 100%; }
    .cover-summary ul { list-style: none; }
    .cover-summary li { font-size: 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .cover-summary li::before { content: '•'; color: #f97316; font-size: 20px; font-weight: bold; }
    .cover-summary strong { color: #334155; }

    /* Tables & Grid */
    .section-title { font-size: 18px; font-weight: 800; color: #f97316; margin-bottom: 16px; margin-top: 32px; border-bottom: 2px solid #f97316; padding-bottom: 8px; }
    .data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .data-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
    .data-label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
    .data-value { font-size: 15px; font-weight: 700; color: #1e293b; }
    
    /* Plan Page */
    .plan-page { width: 210mm; height: 297mm; padding: 32px; page-break-after: always; display: flex; flex-direction: column; }
    .plan-header { text-align: center; margin-bottom: 20px; }
    .plan-title { font-size: 20px; font-weight: 900; }
    .plan-container { position: relative; border: 2px solid #e2e8f0; border-radius: 8px; padding: 20px; background: #fff; flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .plan-image { max-width: 100%; max-height: 100%; object-fit: contain; }
    
    .north-arrow { position: absolute; top: 20px; right: 20px; display: flex; flex-direction: column; align-items: center; z-index: 10; }
    .north-arrow svg { width: 20px; height: 32px; }
    
    .legend { display: flex; justify-content: center; gap: 24px; margin-top: 20px; font-size: 12px; color: #64748b; font-weight: 600; }
    .legend-item { display: flex; align-items: center; gap: 8px; }
    .legend-swatch { width: 24px; height: 12px; border-radius: 2px; border: 1px solid currentColor; }
    
    /* Rooms Table */
    .rooms-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 20px; }
    .rooms-table th { background: #f8fafc; padding: 12px; text-align: left; font-weight: 800; color: #475569; border-bottom: 2px solid #e2e8f0; }
    .rooms-table td { padding: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }

    /* Disclaimer */
    .disclaimer-text { font-size: 16px; font-weight: 600; color: #64748b; line-height: 1.6; max-width: 600px; text-align: center; }

    @media print {
      @page { size: A4; margin: 0; }
    }
  </style>
</head>
<body>

  <!-- P1: Copertă -->
  <div class="page page-center">
    <div class="cover-header">
      <div class="cover-logo">Zidario<span>.ro</span></div>
    </div>
    <div class="cover-title">${safeTitle}</div>
    <div class="cover-address">${escapeHtml(project.locality) || 'Localitate nespecificată'}, ${escapeHtml(project.county) || 'Județ nespecificat'}</div>
    <div class="cover-date">Data generării: ${generatedAt}</div>
    
    <div class="cover-summary">
      <ul>
        <li><strong>Suprafața construită estimată:</strong> ${totalBuiltSqm} mp</li>
        <li><strong>Regim de înălțime:</strong> ${project.floors !== null ? `P+${project.floors - 1}` : 'Parter'}</li>
        <li><strong>Stil arhitectural ales:</strong> ${escapeHtml(project.houseType) || 'Nespecificat'}</li>
        <li><strong>Status conformitate:</strong> <span style="color:${violationsCount > 0 ? '#dc2626' : '#16a34a'}">${violationsCount === 0 ? 'Conform' : 'Neconform'}</span></li>
        <li><strong>Număr camere:</strong> ${rooms.length}</li>
      </ul>
    </div>
  </div>

  <!-- P2: Fișă Tehnică a Terenului și Construcției -->
  <div class="page">
    <h1 style="font-size: 24px; font-weight: 900; margin-bottom: 10px;">Fișă Tehnică a Terenului și Construcției</h1>
    
    <div class="section-title">1. Teren</div>
    <div class="data-grid">
      <div class="data-box">
        <div class="data-label">Suprafața terenului</div>
        <div class="data-value">${project.plotAreaSqm ? project.plotAreaSqm.toFixed(1) + ' mp' : 'Nespecificat'}</div>
      </div>
      <div class="data-box">
        <div class="data-label">Coordonate GPS</div>
        <div class="data-value">${project.lat && project.lng ? `${project.lat.toFixed(4)}, ${project.lng.toFixed(4)}` : 'Nespecificat'}</div>
      </div>
      <div class="data-box">
        <div class="data-label">Tip sol</div>
        <div class="data-value">${escapeHtml(project.soilType) || 'Nespecificat'}</div>
      </div>
      <div class="data-box">
        <div class="data-label">Pantă teren</div>
        <div class="data-value">${project.slopePercent !== null ? project.slopePercent + '%' : 'Nespecificat'}</div>
      </div>
      <div class="data-box" style="grid-column: 1 / -1;">
        <div class="data-label">Observații sol</div>
        <div class="data-value" style="font-weight: normal;">${escapeHtml(project.soilNotes) || 'Nicio observație.'}</div>
      </div>
    </div>

    <div class="section-title">2. Construcție și Reglementări</div>
    <div class="data-grid">
      <div class="data-box">
        <div class="data-label">Zonă seismică</div>
        <div class="data-value">${escapeHtml(project.seismicZone) || 'Nespecificat'}</div>
      </div>
      <div class="data-box">
        <div class="data-label">Adâncime minimă fundare</div>
        <div class="data-value">${project.minFoundationDepthCm || project.frostDepthCm ? `${project.minFoundationDepthCm || project.frostDepthCm} cm` : 'Nespecificat'}</div>
      </div>
      <div class="data-box">
        <div class="data-label">Regim înălțime permis</div>
        <div class="data-value">${project.maxAllowedFloors ? 'P+' + (project.maxAllowedFloors - 1) : 'Nespecificat'}</div>
      </div>
      <div class="data-box">
        <div class="data-label">Configurația aleasă</div>
        <div class="data-value">${escapeHtml(configString)}</div>
      </div>
    </div>
  </div>

  <!-- P3: Planul Fiecărui Etaj -->
  <div class="plan-page">
    <div class="plan-header">
      <div class="plan-title">Plan Parter</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px">Scara: 1:100 (la tipărire A4) · Orientare: Landscape</div>
    </div>
    
    <div class="plan-container">
      <div class="north-arrow" style="transform: rotate(${getNorthRotation(project.streetOrientation)}deg);">
         <div style="font-weight: 900; font-size: 14px; margin-bottom: 2px;">N</div>
         <svg viewBox="0 0 24 40">
            <path d="M12 0 L24 40 L12 30 L0 40 Z" fill="#1e293b"/>
         </svg>
      </div>
      ${planPngBase64 ? `<img src="data:image/png;base64,${planPngBase64}" class="plan-image" alt="Plan" />` : '<div style="color:#94a3b8">Imaginea planului nu este disponibilă</div>'}
    </div>

    <div class="legend">
      <div class="legend-item"><div class="legend-swatch" style="background:#1e293b; border-color:#1e293b;"></div>Perete exterior</div>
      <div class="legend-item"><div class="legend-swatch" style="background:#64748b; border-color:#64748b;"></div>Perete interior</div>
      <div class="legend-item"><div class="legend-swatch" style="background:#f97316; border-color:#f97316;"></div>Ușă</div>
      <div class="legend-item"><div class="legend-swatch" style="background:#3b82f6; border-color:#3b82f6;"></div>Fereastră</div>
    </div>
  </div>

  <!-- P4: Tabel Încăperi -->
  <div class="page">
    <h1 style="font-size: 24px; font-weight: 900; margin-bottom: 20px;">Tabel Încăperi</h1>
    <table class="rooms-table">
      <thead>
        <tr>
          <th>Cameră</th>
          <th style="text-align:center">Suprafață utilă</th>
          <th style="text-align:center">Minim legal</th>
          <th style="text-align:center">Status</th>
        </tr>
      </thead>
      <tbody>
        ${roomRows || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">Nicio cameră desenată</td></tr>'}
      </tbody>
    </table>
    
    <div style="margin-top: 32px; background: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
      <div style="display:flex; justify-content:space-between; margin-bottom: 12px; font-size: 16px;">
        <span style="color:#64748b; font-weight:600;">Total suprafață utilă desfășurată:</span>
        <span style="font-weight:800; color:#1e293b;">${totalSqm} mp</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size: 16px;">
        <span style="color:#64748b; font-weight:600;">Total suprafață construită:</span>
        <span style="font-weight:800; color:#1e293b;">${totalBuiltSqm} mp</span>
      </div>
    </div>
  </div>

  <!-- P5: Disclaimer -->
  <div class="page page-center">
    <p class="disclaimer-text">
      Planul a fost generat automat de platforma Zidario pe baza datelor introduse de utilizator și validat față de Legea 114/1996 și NP 057-2002.<br/><br/>
      Nu înlocuiește un proiect tehnic semnat și ștampilat de arhitect autorizat.
    </p>
  </div>

</body>
</html>`;
}

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

export const exportService = {
  async generatePlanPdf(
    projectId: number,
    planPngBase64: string | null
  ): Promise<{ buffer: Buffer; filename: string } | null> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { chatSummaries: true }
    });

    if (!project) return null;
    const snapshot = await prisma.planSnapshot.findFirst({
      where: { projectId },
      orderBy: [{ isPublished: 'desc' }, { version: 'desc' }],
    });

    if (!snapshot) return null;

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

    const rooms: RoomRow[] = rawRooms.map((room) => {
      const roomResult = resultsById.get(room.id);
      return {
        label: room.label,
        usableSqm: room.usableSqm,
        status: roomResult?.status ?? 'ok',
        minRequiredSqm: roomResult?.minRequiredSqm,
      };
    });

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
        })),
        lat: project.lat,
        lng: project.lng,
        seismicZone: project.seismicZone,
        frostDepthCm: project.frostDepthCm,
        hasBasement: project.hasBasement,
        hasGroundFloor: project.hasGroundFloor,
        upperFloorsCount: project.upperFloorsCount,
        hasMansard: project.hasMansard,
      },
      planPngBase64,
      rooms,
      generatedAt,
      snapshot.version,
    );

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

  async generateContractorPdf(
    quoteId: number,
    contractorId: number,
    planPngBase64: string | null
  ): Promise<{ buffer: Buffer; filename: string } | null> {
    const quote = await prisma.contractorQuote.findFirst({
      where: { id: quoteId, contractorId },
      include: { project: true }
    });

    if (!quote) return null;

    const bom = await prisma.projectBOM.findMany({
      where: { projectId: quote.projectId },
      include: { material: true },
      orderBy: { phase: 'asc' },
    });

    const snapshot = await prisma.planSnapshot.findFirst({
      where: { projectId: quote.projectId, isPublished: true },
      orderBy: { version: 'desc' }
    });

    const html = buildContractorHtmlTemplate(quote.project, bom, snapshot, planPngBase64);

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
