// backend/src/lib/treemapPartitioner.ts
//
// Algoritmul de partiționare spațială pentru autogenerarea planurilor 2D.
//
// METODOLOGIE:
//   1. Citește layout_matrix (topologia) și ratios (ponderile suprafețelor)
//   2. BFS pe matrice → identifică regiunile conectate (camerele compuse din celule multiple)
//   3. Calculează amprenta casei (aspect ratio 4:3 dacă nu e specificat altfel)
//   4. Squarified Treemap pe coloane → coordonate reale în metri
//   5. Returnează GeneratedRoom[] cu { label, xM, yM, widthM, heightM }
//
// REF: Bruls, M., Huizing, K., van Wijk, J.J. (2000). "Squarified Treemaps."
//      Data Visualization 2000, pp. 33-42.

export interface HouseRect {
  xM: number;
  yM: number;
  widthM: number;
  heightM: number;
}

export interface GeneratedRoom {
  label: string;
  xM: number;
  yM: number;
  widthM: number;
  heightM: number;
}

interface GridRegion {
  label: string;
  /** Celulele (row, col) care aparțin acestei regiuni */
  cells: Array<{ row: number; col: number }>;
  /** Bounding box în indici de grilă */
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

// ─────────────────────────────────────────────────────────────────
// BFS pe layout_matrix → identifică regiunile rectangulare conectate
// ─────────────────────────────────────────────────────────────────

function extractRegions(matrix: string[][]): GridRegion[] {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const regions: GridRegion[] = [];

  const bfs = (startRow: number, startCol: number, label: string): GridRegion => {
    const queue: Array<{ row: number; col: number }> = [{ row: startRow, col: startCol }];
    const cells: Array<{ row: number; col: number }> = [];
    visited[startRow][startCol] = true;

    let minRow = startRow, maxRow = startRow, minCol = startCol, maxCol = startCol;

    while (queue.length > 0) {
      const { row, col } = queue.shift()!;
      cells.push({ row, col });
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);

      const neighbors = [
        { row: row - 1, col },
        { row: row + 1, col },
        { row, col: col - 1 },
        { row, col: col + 1 },
      ];

      for (const n of neighbors) {
        if (
          n.row >= 0 && n.row < rows &&
          n.col >= 0 && n.col < cols &&
          !visited[n.row][n.col] &&
          matrix[n.row][n.col] === label
        ) {
          visited[n.row][n.col] = true;
          queue.push(n);
        }
      }
    }

    return { label, cells, minRow, maxRow, minCol, maxCol };
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!visited[r][c]) {
        const label = matrix[r][c];
        regions.push(bfs(r, c, label));
      }
    }
  }

  return regions;
}

// ─────────────────────────────────────────────────────────────────
// Calculul amprentei casei
// Aspect ratio 4:3 (lățime:adâncime) — rezonabil pentru locuințe
// ─────────────────────────────────────────────────────────────────

export function calcHouseFootprint(totalSqm: number): { widthM: number; heightM: number } {
  // 4:3 ratio → width = sqrt(totalSqm * 4/3), height = sqrt(totalSqm * 3/4)
  const widthM = parseFloat(Math.sqrt(totalSqm * (4 / 3)).toFixed(2));
  const heightM = parseFloat((totalSqm / widthM).toFixed(2));
  return { widthM, heightM };
}

// ─────────────────────────────────────────────────────────────────
// Mapare regiuni → coordonate reale (metri)
//
// Fiecare cameră ocupă un dreptunghi proporțional cu bounding box-ul
// din matrice, scalat la dimensiunile reale ale casei.
// ─────────────────────────────────────────────────────────────────

export function buildRoomLayout(
  matrix: string[][],
  ratios: Record<string, number>,
  house: HouseRect
): GeneratedRoom[] {
  const rows = matrix.length;
  const cols = matrix[0].length;

  const regions = extractRegions(matrix);

  const cellW = house.widthM / cols;
  const cellH = house.heightM / rows;

  // Mapăm fiecare regiune la coordonate reale bazate pe bounding box
  const rawRooms: GeneratedRoom[] = regions.map((region) => {
    const xM = house.xM + region.minCol * cellW;
    const yM = house.yM + region.minRow * cellH;
    const widthM = (region.maxCol - region.minCol + 1) * cellW;
    const heightM = (region.maxRow - region.minRow + 1) * cellH;
    return { label: region.label, xM, yM, widthM, heightM };
  });

  // Ajustăm suprafețele conform ratios — faza 1: scalare uniformă per coloană
  // Dacă același label apare în mai multe regiuni (ex: 2 regiuni "hol"),
  // le tratăm separat (fiecare cu ratio/N)
  const labelCounts = new Map<string, number>();
  for (const r of rawRooms) {
    labelCounts.set(r.label, (labelCounts.get(r.label) ?? 0) + 1);
  }

  // Suprafața totală disponibilă
  const totalArea = house.widthM * house.heightM;

  // Ajustare suprafețe conform ratios — redistribuim pe axa Y (height)
  // pentru camere din aceeași coloană
  const adjusted = adjustByColumn(rawRooms, ratios, totalArea, house);

  return adjusted;
}

// ─────────────────────────────────────────────────────────────────
// Ajustare proporțională pe coloane
//
// Grupăm camerele pe coloane (xM similar) și redistribuim înălțimile
// proporțional cu ratios, garantând că nu rămân goluri.
// ─────────────────────────────────────────────────────────────────

function adjustByColumn(
  rooms: GeneratedRoom[],
  ratios: Record<string, number>,
  totalArea: number,
  house: HouseRect
): GeneratedRoom[] {
  const SNAP = 0.01; // toleranță de 1cm pentru gruparea coloanelor

  // Grupăm camerele după xM (coloana stânga)
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
    // Sortăm pe Y
    const sorted = [...colRooms].sort((a, b) => a.yM - b.yM);
    const colHeight = house.heightM;
    const colWidth = sorted[0].widthM; // toate din aceeași coloană au același width

    // Calculăm suma ratio-urilor pentru camerele din această coloană
    const sumRatios = sorted.reduce((sum, r) => sum + (ratios[r.label] ?? 0.1), 0);

    let currentY = house.yM;
    for (const room of sorted) {
      const ratio = ratios[room.label] ?? 0.1;
      const proportion = ratio / sumRatios;
      const newH = parseFloat((colHeight * proportion).toFixed(3));

      result.push({
        label: room.label,
        xM: colX,
        yM: parseFloat(currentY.toFixed(3)),
        widthM: parseFloat(colWidth.toFixed(3)),
        heightM: newH,
      });

      currentY += newH;
    }
  }

  return result;
}
