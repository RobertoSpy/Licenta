import { ConformityRuleSource, getSupplementalRules } from '../lib/conformityRulesCache';
import rawRules from '../data/conformity-rules.json';

// Tipaj explicit pentru datele importate din JSON
const conformityRules = rawRules as {
  room_min_sqm: Array<{
    code: string;
    targets: string[];
    min_sqm: number;
    severity: string;
    source_ref: string;
    applies_to?: string[];
  }>;
  clearance_rules: Array<{
    code: string;
    targets: string[];
    property: string;
    value: number;
    severity: string;
    source_ref: string;
    applies_to?: string[];
  }>;
};

// ─────────────────────────────────────────────────────────────────
// Single Source of Truth — regulile sunt citite din conformity-rules.json.
// NU mai există valori hardcodate în cod.
// ─────────────────────────────────────────────────────────────────

export interface ConformityRoomInput {
  id: string;
  label?: string;
  usableSqm: number;
  widthM?: number;
  heightM?: number;
}

export interface ConformityDoorInput {
  id: string;
  widthM: number;
}

export type ConformitySeverity = 'warning' | 'error';

export interface ConformityRuleIssue {
  targetType: 'room' | 'door' | 'project';
  targetId: string;
  code: string;
  severity: ConformitySeverity;
  article: string;
  message: string;
  currentValue: number;
  requiredValue: number;
  deltaValue: number;
  suggestion: string;
  sources?: ConformityRuleSource[];
}

export interface ConformityRoomResult {
  id: string;
  status: 'ok' | 'warning' | 'error';
  minRequiredSqm?: number;
  issues: ConformityRuleIssue[]
}

export interface ConformityEvaluation {
  rooms: ConformityRoomResult[];
  violations: ConformityRuleIssue[];
  warnings: ConformityRuleIssue[];
}

// ─────────────────────────────────────────────────────────────────
// Construim lookup-ul din JSON la startup (O(1) la runtime)
// { "living": { min: 18, source_ref: "...", code: "...", severity: "error" }, ... }
// ─────────────────────────────────────────────────────────────────

interface RoomMinRule {
  min: number;
  code: string;
  severity: ConformitySeverity;
  source_ref: string;
  applies_to?: string[];
}

const ROOM_MIN_LOOKUP = new Map<string, RoomMinRule>();

for (const rule of conformityRules.room_min_sqm) {
  for (const target of rule.targets) {
    ROOM_MIN_LOOKUP.set(
      target.toLowerCase().replace(/\s+/g, ''),
      {
        min: rule.min_sqm,
        code: rule.code,
        severity: rule.severity as ConformitySeverity,
        source_ref: rule.source_ref,
        applies_to: rule.applies_to,
      }
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// Normalizare label: "Sufragerie " → "sufragerie", "Cameră de Zi" → "cameradezi"
// ─────────────────────────────────────────────────────────────────

function normalizeLabel(label?: string): string {
  if (!label) return '';
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// ─────────────────────────────────────────────────────────────────
// Evaluare cameră — citit exclusiv din ROOM_MIN_LOOKUP (JSON)
// ─────────────────────────────────────────────────────────────────

function evaluateRoom(room: ConformityRoomInput, buildingPurpose: string): ConformityRoomResult {
  const key = normalizeLabel(room.label);
  const rule = ROOM_MIN_LOOKUP.get(key);
  const issues: ConformityRuleIssue[] = [];

  if (!rule) {
    return { id: room.id, status: 'ok', issues };
  }

  if (rule.applies_to && !rule.applies_to.includes(buildingPurpose)) {
    return { id: room.id, status: 'ok', issues };
  }

  const isWarning = room.usableSqm < rule.min && room.usableSqm >= rule.min * 0.9;
  const isError = room.usableSqm < rule.min * 0.9;

  if (isWarning || isError) {
    const severity: ConformitySeverity = isError ? 'error' : 'warning';
    const delta = parseFloat((rule.min - room.usableSqm).toFixed(2));

    issues.push({
      targetType: 'room',
      targetId: room.id,
      code: rule.code,
      severity,
      article: rule.source_ref,
      message: `Suprafața utilă este sub minimul legal pentru "${room.label ?? 'Cameră'}" (${rule.source_ref}).`,
      currentValue: room.usableSqm,
      requiredValue: rule.min,
      deltaValue: delta,
      suggestion: `Mărește camera cu cel puțin ${delta} m² util.`,
    });
  }

  const status: ConformityRoomResult['status'] = isError
    ? 'error'
    : isWarning
      ? 'warning'
      : 'ok';

  return { id: room.id, status, minRequiredSqm: rule.min, issues };
}

// ─────────────────────────────────────────────────────────────────
// Lookup pentru clearance_rules (din JSON)
// ─────────────────────────────────────────────────────────────────

function getClearanceRule(code: string, buildingPurpose: string) {
  return conformityRules.clearance_rules.find((r) => r.code === code && (!r.applies_to || r.applies_to.includes(buildingPurpose)));
}

// ─────────────────────────────────────────────────────────────────
// Export principal
// ─────────────────────────────────────────────────────────────────

export const conformityService = {
  async evaluateRooms(
    rooms: ConformityRoomInput[],
    options?: { doors?: ConformityDoorInput[]; buildingPurpose?: string }
  ): Promise<ConformityEvaluation> {
    const purpose = options?.buildingPurpose ?? 'residential';
    const roomResults = rooms.map(r => evaluateRoom(r, purpose));
    const extraIssues: ConformityRuleIssue[] = [];

    // Reguli suplimentare din RAG (cached 6h)
    const supplementalRules = await getSupplementalRules(purpose as any);
    const corridorRuleRAG = supplementalRules.find((rule) => rule.code === 'CORRIDOR_MIN_WIDTH');
    const doorRuleRAG = supplementalRules.find((rule) => rule.code === 'DOOR_MIN_WIDTH');

    // Fallback static din JSON dacă RAG nu a returnat valori
    const corridorRuleJSON = getClearanceRule('L114_CORRIDOR_WIDTH', purpose);
    const doorRuleJSON = getClearanceRule('P118_DOOR_WIDTH', purpose);

    const corridorMinM = corridorRuleRAG?.minValueM ?? corridorRuleJSON?.value ?? 1.2;
    const doorMinM = doorRuleRAG?.minValueM ?? doorRuleJSON?.value ?? 0.8;

    // Verificare lățime coridor
    const corridorLabels = new Set(['hol', 'coridor', 'vestibul', 'circulatie', 'circulație']);
    for (const room of rooms) {
      const key = normalizeLabel(room.label);
      if (!corridorLabels.has(key)) continue;
      if (!room.widthM || !room.heightM) continue;

      const corridorWidth = Math.min(room.widthM, room.heightM);
      if (corridorWidth < corridorMinM) {
        const delta = parseFloat((corridorMinM - corridorWidth).toFixed(2));
        const issue: ConformityRuleIssue = {
          targetType: 'room',
          targetId: room.id,
          code: 'L114_CORRIDOR_WIDTH',
          severity: 'error',
          article: 'P118-99 / Legea 114/1996',
          message: `Lățimea coridorului este sub minimul pentru evacuare.`,
          currentValue: corridorWidth,
          requiredValue: corridorMinM,
          deltaValue: delta,
          suggestion: `Lărgește coridorul cu cel puțin ${delta} m.`,
          sources: corridorRuleRAG?.sources,
        };
        const targetRoom = roomResults.find((r) => r.id === room.id);
        if (targetRoom) targetRoom.issues.push(issue);
      }
    }

    // Verificare lățime uși
    if (options?.doors?.length) {
      for (const door of options.doors) {
        if (door.widthM < doorMinM) {
          const delta = parseFloat((doorMinM - door.widthM).toFixed(2));
          extraIssues.push({
            targetType: 'door',
            targetId: door.id,
            code: 'P118_DOOR_WIDTH',
            severity: 'warning',
            article: 'P118-99',
            message: 'Lățimea ușii este sub minimul recomandat pentru evacuare.',
            currentValue: door.widthM,
            requiredValue: doorMinM,
            deltaValue: delta,
            suggestion: `Mărește lățimea ușii cu cel puțin ${delta} m.`,
            sources: doorRuleRAG?.sources,
          });
        }
      }
    }

    const roomIssues = roomResults.flatMap((room) => room.issues);
    const allIssues = [...roomIssues, ...extraIssues];
    const violations = allIssues.filter((issue) => issue.severity === 'error');
    const warnings = allIssues.filter((issue) => issue.severity === 'warning');

    return { rooms: roomResults, violations, warnings };
  },
};
