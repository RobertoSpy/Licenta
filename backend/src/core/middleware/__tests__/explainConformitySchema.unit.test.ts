import { explainConformitySchema } from '../validateMiddleware';

describe('explainConformitySchema', () => {
  it('accepts valid violations array', () => {
    const validData = {
      violations: [
        { label: 'Living', usableSqm: 16, minRequired: 18 }
      ]
    };
    expect(() => explainConformitySchema.parse(validData)).not.toThrow();
  });

  it('rejects missing violations field', () => {
    expect(() => explainConformitySchema.parse({})).toThrow();
  });

  it('rejects empty violations array', () => {
    const invalidData = { violations: [] };
    expect(() => explainConformitySchema.parse(invalidData)).toThrow('At least one violation required');
  });

  it('rejects malformed violation object (missing fields)', () => {
    const invalidData = {
      violations: [
        { label: 'Living', usableSqm: 16 } // missing minRequired
      ]
    };
    expect(() => explainConformitySchema.parse(invalidData)).toThrow();
  });

  it('rejects non-positive numbers', () => {
    const invalidData = {
      violations: [
        { label: 'Living', usableSqm: -5, minRequired: 18 }
      ]
    };
    expect(() => explainConformitySchema.parse(invalidData)).toThrow();
  });

  it('strips unknown fields', () => {
    const dataWithUnknown = {
      violations: [
        { label: 'Living', usableSqm: 16, minRequired: 18 }
      ],
      unknownField: 'test'
    };
    const parsed = explainConformitySchema.parse(dataWithUnknown);
    expect((parsed as any).unknownField).toBeUndefined();
  });
});
