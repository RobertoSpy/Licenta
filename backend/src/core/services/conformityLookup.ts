import rawRules from '../../data/conformity-rules.json';

export interface RoomMinSqmRule {
  code: string;
  targets: string[];
  min_sqm: number;
  severity: string;
  _source: string;
  applies_to?: string[];
}

export interface ClearanceRule {
  code: string;
  targets: string[];
  property: string;
  value: number;
  severity: string;
  _source: string;
  applies_to?: string[];
}

export interface EnvironmentalRule {
  code: string;
  targets: string[];
  property: string;
  value: number;
  severity: string;
  _source: string;
  applies_to?: string[];
}

const conformityRules = rawRules as {
  room_min_sqm: RoomMinSqmRule[];
  clearance_rules: ClearanceRule[];
  environmental_rules: EnvironmentalRule[];
};

/**
 * Normalizes a label by making it lowercase, removing diacritics, 
 * trimming whitespace, and keeping only alphanumeric characters.
 */
export function normalizeLabel(label?: string): string {
  if (!label) return '';
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Matches a rule from a list by looking up type and label in rule targets.
 * Attempts Exact match first, then falls back to Substring match.
 */
function matchRuleByTarget<T extends { targets: string[] }>(
    rules: T[],
    type?: string,
    label?: string
): T | undefined {
    const typeKey = normalizeLabel(type);
    const labelKey = normalizeLabel(label);

    // Exact Match
    let rule = rules.find(r => 
        (typeKey && r.targets.some(t => normalizeLabel(t) === typeKey)) ||
        (labelKey && r.targets.some(t => normalizeLabel(t) === labelKey))
    );

    // Fallback Substring Match
    if (!rule) {
        rule = rules.find(r => 
            r.targets.some(t => {
                const nt = normalizeLabel(t);
                const matchType = typeKey && (typeKey.includes(nt) || nt.includes(typeKey));
                const matchLabel = labelKey && (labelKey.includes(nt) || nt.includes(labelKey));
                return matchType || matchLabel;
            })
        );
    }
    return rule;
}

export function findRoomMinRule(type?: string, label?: string, buildingPurpose: string = 'residential'): RoomMinSqmRule | undefined {
    const applicableRules = conformityRules.room_min_sqm.filter(r => !r.applies_to || r.applies_to.includes(buildingPurpose));
    return matchRuleByTarget(applicableRules, type, label);
}

export function findEnvironmentalRule(property: string, type?: string, label?: string, buildingPurpose: string = 'residential'): EnvironmentalRule | undefined {
    const applicableRules = conformityRules.environmental_rules.filter(r => 
        r.property === property && (!r.applies_to || r.applies_to.includes(buildingPurpose))
    );
    return matchRuleByTarget(applicableRules, type, label);
}

export function findClearanceRule(code: string, buildingPurpose: string = 'residential'): ClearanceRule | undefined {
    return conformityRules.clearance_rules.find(r => 
        r.code === code && (!r.applies_to || r.applies_to.includes(buildingPurpose))
    );
}

export const ARCH_RULES = {
    isGarage: (type?: string, label?: string) => {
        const typeKey = normalizeLabel(type);
        const labelKey = normalizeLabel(label);
        return typeKey.includes('garaj') || labelKey.includes('garaj');
    }
};
