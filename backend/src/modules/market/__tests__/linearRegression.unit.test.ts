import { linearRegression } from '../marketService';

describe('linearRegression Math Logic', () => {
  it('throws error when provided with < 2 points', () => {
    expect(() => linearRegression([])).toThrow('Nu există suficiente date');
    expect(() => linearRegression([100])).toThrow('Nu există suficiente date');
  });

  it('linearRegression with perfectly linear data has rmse=0', () => {
    // Values: 10, 20, 30, 40 (slope = 10, intercept = 10)
    const { slope, intercept, rmse } = linearRegression([10, 20, 30, 40]);
    expect(slope).toBeCloseTo(10);
    expect(intercept).toBeCloseTo(10);
    expect(rmse).toBeCloseTo(0);
  });

  it('linearRegression returns correct slope and intercept for known dataset', () => {
    // Known dataset points: y = 2x + 5
    // x = 0 -> 5
    // x = 1 -> 7
    // x = 2 -> 9
    // Noise added: 5, 8, 9 (instead of 5, 7, 9)
    const { slope, intercept, rmse } = linearRegression([5, 8, 9]);
    
    // Means: x_mean = 1, y_mean = 22/3 = 7.33
    // slope should be positive, around 2
    expect(slope).toBeCloseTo(2);
    // intercept should be around 5.33
    expect(intercept).toBeCloseTo(5.33, 1);
    expect(rmse).toBeGreaterThan(0);
  });

  it('linearRegression with 2 points (minimum) returns valid result', () => {
    const { slope, intercept, rmse } = linearRegression([10, 15]);
    expect(slope).toBeCloseTo(5);
    expect(intercept).toBeCloseTo(10);
    expect(rmse).toBeCloseTo(0);
  });

  it('linearRegression with identical y values (flat line) has slope 0', () => {
    // The x values are internally 0, 1, 2... so they are never identical
    const { slope, intercept, rmse } = linearRegression([50, 50, 50]);
    expect(slope).toBeCloseTo(0);
    expect(intercept).toBeCloseTo(50);
    expect(rmse).toBeCloseTo(0);
  });
});
