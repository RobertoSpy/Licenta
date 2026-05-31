export function getFloorHeightM(hasBasement: boolean, activeFloor: string): number {
  if (hasBasement && activeFloor === 'subsol') return 1.9;
  return 2.7;
}
