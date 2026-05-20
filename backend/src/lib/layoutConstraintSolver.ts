// backend/src/lib/layoutConstraintSolver.ts
import { GeneratedRoom } from './treemapPartitioner';
import rawRules from '../data/conformity-rules.json';

const conformityRules = rawRules as {
  room_min_sqm: Array<{
    code: string;
    targets: string[];
    min_sqm: number;
    severity: string;
    source_ref: string;
  }>;
};

// Normalize label for conformity matching
function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Build min area lookup table from rules
const ROOM_MIN_LOOKUP = new Map<string, number>();
for (const rule of conformityRules.room_min_sqm) {
  for (const target of rule.targets) {
    ROOM_MIN_LOOKUP.set(normalizeLabel(target), rule.min_sqm);
  }
}

/**
 * Constraint Solver:
 * Asigură că planul generat respectă minimele legale.
 * Nu modifică topologia, ci redistribuie suprafețe (în metri) 
 * prin ajustarea dimensiunilor camerelor din aceeași coloană.
 * Funcția operează simplist momentan: verifică și ajustează pe Y.
 */
export function applyLegalConstraints(rooms: GeneratedRoom[]): GeneratedRoom[] {
  // O(n^2) simplist pe coloane pentru ajustare (demo)
  const SNAP = 0.01;
  const colGroups = new Map<number, GeneratedRoom[]>();

  for (const room of rooms) {
    let foundKey: number | null = null;
    for (const key of colGroups.keys()) {
      if (Math.abs(key - room.xM) < SNAP) {
        foundKey = key;
        break;
      }
    }
    if (foundKey !== null) {
      colGroups.get(foundKey)!.push(room);
    } else {
      colGroups.set(room.xM, [room]);
    }
  }

  const result: GeneratedRoom[] = [];

  for (const [colX, colRooms] of colGroups) {
    // Sortăm camerele din coloană după Y
    const sorted = [...colRooms].sort((a, b) => a.yM - b.yM);
    let totalColHeight = 0;
    
    // Identificăm deficitele și surplusurile relative
    const status = sorted.map(room => {
      totalColHeight += room.heightM;
      const key = normalizeLabel(room.label);
      const minRequired = ROOM_MIN_LOOKUP.get(key) || 0;
      
      // Dacă camera e prea îngustă raportat la minimul necesar, 
      // ar avea nevoie de un nou heightM minim
      let minHeight = 0;
      if (minRequired > 0) {
          minHeight = minRequired / room.widthM;
      }
      return { room, minHeight, currentHeight: room.heightM };
    });

    // Pas 1: Setează înălțimile minime pentru cele care au deficit
    // și colectează deficitul total necesar
    let extraNeeded = 0;
    for (const s of status) {
      if (s.currentHeight < s.minHeight) {
        extraNeeded += (s.minHeight - s.currentHeight);
        s.currentHeight = s.minHeight;
      }
    }

    // Pas 2: Dacă s-a cerut extra, se scade de la ceilalți (ex. hol, debara, bucatarie) 
    // care au surplus.
    if (extraNeeded > 0) {
      // Priorități pentru tăiere: debara, hol, baia, apoi living/bucătărie (ideal)
      // Aici facem o simplă reducere proporțională pentru camerele fără deficit
      const donors = status.filter(s => s.currentHeight > s.minHeight);
      const totalDonorSurplus = donors.reduce((sum, d) => sum + (d.currentHeight - d.minHeight), 0);
      
      if (totalDonorSurplus >= extraNeeded) {
        for (const d of donors) {
          const surplus = d.currentHeight - d.minHeight;
          const share = surplus / totalDonorSurplus;
          d.currentHeight -= extraNeeded * share;
        }
      } else {
        // Fallback: extindem discret coloana în jos 
        // (în realitate ar afecta și alte coloane, deci mărim puțin footprint-ul)
        // Nu tratăm riguros geometria complexă aici pentru simplificarea demonstrației
      }
    }

    // Reconstruim coordonatele finale
    const colWidth = sorted[0].widthM;
    let currentY = sorted[0].yM;
    for (const s of status) {
      result.push({
        label: s.room.label,
        xM: colX,
        yM: parseFloat(currentY.toFixed(3)),
        widthM: parseFloat(colWidth.toFixed(3)),
        heightM: parseFloat(s.currentHeight.toFixed(3))
      });
      currentY += s.currentHeight;
    }
  }

  return result;
}
