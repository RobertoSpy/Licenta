import fs from 'fs';
import path from 'path';
import { normativeCache } from '../services/normativeCache';

jest.mock('fs');
jest.mock('path', () => {
  const actualPath = jest.requireActual('path');
  return {
    ...actualPath,
    join: jest.fn((...args) => args.join('/')) // simplified mock
  };
});

describe('normativeCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    normativeCache.clear();
  });

  it('ar trebui sa incarce datele din fisiere si sa le puna in cache la primul apel', async () => {
    (fs.readFileSync as jest.Mock).mockImplementation((filepath: string) => {
      if (filepath.includes('seismic-zones.json')) return '{"seismic": true}';
      if (filepath.includes('frost-depth.json')) return '{"frost": true}';
      if (filepath.includes('floor-rules.json')) return '{"floors": true}';
      if (filepath.includes('snow-zones.json')) return '{"snow": true}';
      if (filepath.includes('wind-zones.json')) return '{"wind": true}';
      return '{}';
    });

    const result = await normativeCache.load();
    
    expect(fs.readFileSync).toHaveBeenCalledTimes(5);
    expect(result).toContain('=== NORMATIVE STATICE CAG');
    expect(result).toContain('{"seismic": true}');
    expect(result).toContain('{"frost": true}');
    expect(result).toContain('{"floors": true}');
    expect(result).toContain('{"snow": true}');
    expect(result).toContain('{"wind": true}');
  });

  it('ar trebui sa returneze valoarea din cache la apeluri ulterioare fara a mai citi din FS', async () => {
    (fs.readFileSync as jest.Mock).mockReturnValue('mock-data');

    const result1 = await normativeCache.load();
    expect(fs.readFileSync).toHaveBeenCalledTimes(5);

    const result2 = await normativeCache.load();
    expect(fs.readFileSync).toHaveBeenCalledTimes(5); // Ramane 5, nu creste
    expect(result1).toBe(result2);
  });

  it('ar trebui sa returneze un string gol si sa logheze eroare daca FS da fail', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('File not found');
    });

    const result = await normativeCache.load();

    expect(result).toBe('');
    expect(consoleSpy).toHaveBeenCalledWith('[normativeCache] Eroare la încărcare CAG:', 'File not found');

    consoleSpy.mockRestore();
  });

  it('ar trebui sa stearga cache-ul cand este apelata functia clear()', async () => {
    (fs.readFileSync as jest.Mock).mockReturnValue('mock-data');

    await normativeCache.load();
    expect(fs.readFileSync).toHaveBeenCalledTimes(5);

    normativeCache.clear();

    await normativeCache.load();
    expect(fs.readFileSync).toHaveBeenCalledTimes(10); // A citit din nou
  });
});
