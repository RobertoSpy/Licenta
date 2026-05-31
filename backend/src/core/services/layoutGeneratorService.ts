// backend/src/services/layoutGeneratorService.ts
import houseStyles from '../../data/house-styles.json';
import { calcHouseFootprint, buildRoomLayout, GeneratedRoom } from '../../lib/treemapPartitioner';
import { applyLegalConstraints } from '../../lib/layoutConstraintSolver';

export interface LayoutRequest {
  totalFloorAreaSqm: number;
  style: string;
  bedrooms: number;
}

export interface CanvasElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  label?: string;
  wallThicknessCm?: number;
}

// Helper pentru generare UUIDv4 compatibil fără dependințe externe
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const PIXELS_PER_METER = 20;

export class LayoutGeneratorService {
  public static generateLayout(request: LayoutRequest): CanvasElement[] {
    const styleKey = this.normalizeStyle(request.style);
    
    // 1. Găsește template-ul
    const template = houseStyles.templates[styleKey as keyof typeof houseStyles.templates];
    if (!template) {
        throw new Error(`Style not found: ${styleKey}`);
    }

    // 2. Selectează configurația în funcție de dormitoare
    // Asigurăm un fallback la 1_dormitor dacă nu există varianta exactă
    const configKey = `${Math.min(Math.max(1, request.bedrooms), 3)}_dormitoare`.replace('1_dormitoare', '1_dormitor');
    const config = template.configurations[configKey as keyof typeof template.configurations] || template.configurations['1_dormitor'];

    // 3. Calculează footprint-ul dreptunghiular
    const footprint = calcHouseFootprint(request.totalFloorAreaSqm);
    // Adăugăm un mic offset de la colțul canvasului (ex: 2 metri / 40px)
    const baseRect = { xM: 2, yM: 2, widthM: footprint.widthM, heightM: footprint.heightM };

    // 4. Partiționează spațiul brut
    const rawRooms = buildRoomLayout(config.layout_matrix, config.ratios, baseRect);

    // 5. Aplică constrângerile legale (Solver)
    const legalRooms = applyLegalConstraints(rawRooms);

    // 6. Convertește în elemente Konva
    const elements = this.convertToCanvasElements(legalRooms, baseRect);
    
    return elements;
  }

  private static normalizeStyle(style: string): string {
    const s = style.toLowerCase();
    if (s.includes('modern')) return 'Modern';
    if (s.includes('industrial') || s.includes('loft')) return 'Industrial';
    if (s.includes('clasic') || s.includes('traditional')) return 'Clasic';
    if (s.includes('mediteranean')) return 'Mediteranean';
    if (s.includes('rustic')) return 'Rustic';
    return 'Modern'; // fallback
  }

  private static convertToCanvasElements(rooms: GeneratedRoom[], footprint: { xM: number, yM: number, widthM: number, heightM: number }): CanvasElement[] {
    const elements: CanvasElement[] = [];
    const wThickM = 0.25; // 25cm
    
    // Convertim dimensiunile exterioare în pixeli
    const sidePxW = Math.round(footprint.widthM * PIXELS_PER_METER);
    const sidePxH = Math.round(footprint.heightM * PIXELS_PER_METER);
    const offsetX = Math.round(footprint.xM * PIXELS_PER_METER);
    const offsetY = Math.round(footprint.yM * PIXELS_PER_METER);
    const thickPx = Math.round(wThickM * PIXELS_PER_METER);

    // Adăugăm pereții perimetrali
    elements.push({ id: uuidv4(), type: 'wall', x: offsetX, y: offsetY, width: sidePxW, height: thickPx, rotation: 0 }); // Sus
    elements.push({ id: uuidv4(), type: 'wall', x: offsetX, y: offsetY + sidePxH - thickPx, width: sidePxW, height: thickPx, rotation: 0 }); // Jos
    elements.push({ id: uuidv4(), type: 'wall', x: offsetX, y: offsetY, width: thickPx, height: sidePxH, rotation: 0 }); // Stânga
    elements.push({ id: uuidv4(), type: 'wall', x: offsetX + sidePxW - thickPx, y: offsetY, width: thickPx, height: sidePxH, rotation: 0 }); // Dreapta

    // Adăugăm ușa de intrare pe peretele de jos, la mijloc
    elements.push({
       id: uuidv4(), type: 'door', x: offsetX + sidePxW / 2 - (0.9 * PIXELS_PER_METER)/2, y: offsetY + sidePxH - thickPx,
       width: Math.round(0.9 * PIXELS_PER_METER), height: thickPx, rotation: 0
    });

    // Transformăm GeneratedRoom în tipul 'room'
    for (const r of rooms) {
      elements.push({
        id: uuidv4(),
        type: 'room',
        label: this.capitalize(r.label),
        x: Math.round(r.xM * PIXELS_PER_METER),
        y: Math.round(r.yM * PIXELS_PER_METER),
        width: Math.round(r.widthM * PIXELS_PER_METER),
        height: Math.round(r.heightM * PIXELS_PER_METER),
        rotation: 0,
        wallThicknessCm: 25
      });
    }

    return elements;
  }

  private static capitalize(s: string): string {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/([0-9]+)/, ' $1');
  }
}
