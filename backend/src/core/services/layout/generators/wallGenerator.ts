import { CanvasElement, PIXELS_PER_METER } from '../layoutTypes';
import { uuidv4 } from '../layoutUtils';

export function generateOuterWalls(
  outerWallLines: Array<{ x1: number; y1: number; x2: number; y2: number }>,
  thickPx: number
): CanvasElement[] {
  const elements: CanvasElement[] = [];

  for (const line of outerWallLines) {
    const isHorizontal = Math.abs(line.y1 - line.y2) < 0.01;
    const x = Math.round(line.x1 * PIXELS_PER_METER);
    const y = Math.round(line.y1 * PIXELS_PER_METER);

    if (isHorizontal) {
      const width = Math.round(Math.abs(line.x2 - line.x1) * PIXELS_PER_METER);
      elements.push({
        id: uuidv4(),
        type: 'wall',
        x,
        y: y - thickPx / 2,
        width,
        height: thickPx,
        rotation: 0,
      });
    } else {
      const height = Math.round(Math.abs(line.y2 - line.y1) * PIXELS_PER_METER);
      elements.push({
        id: uuidv4(),
        type: 'wall',
        x: x - thickPx / 2,
        y,
        width: thickPx,
        height,
        rotation: 0,
      });
    }
  }

  return elements;
}
