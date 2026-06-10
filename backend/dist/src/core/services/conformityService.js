"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.conformityService = void 0;
const conformityRulesCache_1 = require("../../lib/conformityRulesCache");
const conformity_rules_json_1 = __importDefault(require("../../data/conformity-rules.json"));
// Tipaj explicit pentru datele importate din JSON
const conformityRules = conformity_rules_json_1.default;
const ROOM_MIN_LOOKUP = new Map();
for (const rule of conformityRules.room_min_sqm) {
    for (const target of rule.targets) {
        ROOM_MIN_LOOKUP.set(target.toLowerCase().replace(/\s+/g, ''), {
            min: rule.min_sqm,
            code: rule.code,
            severity: rule.severity,
            _source: rule._source,
            applies_to: rule.applies_to,
        });
    }
}
// ─────────────────────────────────────────────────────────────────
// Normalizare label: "Sufragerie " → "sufragerie", "Cameră de Zi" → "cameradezi"
// ─────────────────────────────────────────────────────────────────
function normalizeLabel(label) {
    if (!label)
        return '';
    return label
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z]/g, '');
}
// ─────────────────────────────────────────────────────────────────
// Evaluare cameră — citit exclusiv din ROOM_MIN_LOOKUP (JSON)
// ─────────────────────────────────────────────────────────────────
function getEnvironmentalRule(code, buildingPurpose) {
    var _a;
    return (_a = conformityRules.environmental_rules) === null || _a === void 0 ? void 0 : _a.find((r) => r.code === code && (!r.applies_to || r.applies_to.includes(buildingPurpose)));
}
function evaluateRoom(room, buildingPurpose) {
    var _a;
    const key = normalizeLabel(room.label);
    const rule = ROOM_MIN_LOOKUP.get(key);
    const issues = [];
    // Validare Suprafață (Existent)
    if (rule && (!rule.applies_to || rule.applies_to.includes(buildingPurpose))) {
        const isWarning = room.usableSqm < rule.min && room.usableSqm >= rule.min * 0.9;
        const isError = room.usableSqm < rule.min * 0.9;
        if (isWarning || isError) {
            const severity = isError ? 'error' : 'warning';
            const delta = parseFloat((rule.min - room.usableSqm).toFixed(2));
            issues.push({
                targetType: 'room',
                targetId: room.id,
                code: rule.code,
                severity,
                article: rule._source,
                message: `Suprafața utilă este sub minimul legal pentru "${(_a = room.label) !== null && _a !== void 0 ? _a : 'Cameră'}" (${rule._source}).`,
                currentValue: room.usableSqm,
                requiredValue: rule.min,
                deltaValue: delta,
                suggestion: `Mărește camera cu cel puțin ${delta} m² util.`,
            });
        }
    }
    // Regula: Garajul trebuie să aibă acces exterior (să atingă perimetrul casei / să aibă o ușă de exterior)
    if (key.includes('garaj') && room.hasExteriorAccess === false) {
        issues.push({
            targetType: 'room',
            targetId: room.id,
            code: 'ARCH_GARAGE_ACCESS',
            severity: 'error',
            article: 'Regula de Arhitectură / Accesibilitate',
            message: `Garajul este blocat în interiorul casei și nu are acces auto spre exterior.`,
            currentValue: 0,
            requiredValue: 1,
            deltaValue: 1,
            suggestion: `Mută garajul pe perimetrul exterior al casei (ideal spre stradă) pentru a permite accesul mașinilor.`,
        });
    }
    // Validare Fereastră (Ratios)
    if (room.windowAreaSqm !== undefined) {
        const isDayRoom = ['living', 'sufragerie', 'cameradezi', 'dormitor', 'camera', 'cameraparintilor'].some(k => key.includes(k));
        const code = isDayRoom ? 'NP057_WINDOW_FLOOR_RATIO_LIVING' : 'NP057_WINDOW_FLOOR_RATIO_OTHER';
        const envRule = getEnvironmentalRule(code, buildingPurpose);
        if (envRule) {
            const ratio = room.windowAreaSqm / room.usableSqm;
            if (ratio < envRule.value) {
                issues.push({
                    targetType: 'room',
                    targetId: room.id,
                    code: envRule.code,
                    severity: envRule.severity,
                    article: envRule._source,
                    message: `Raportul de arie vitrată (fereastră/pardoseală) este insuficient pentru iluminat natural corespunzător.`,
                    currentValue: parseFloat(ratio.toFixed(3)),
                    requiredValue: envRule.value,
                    deltaValue: parseFloat((envRule.value - ratio).toFixed(3)),
                    suggestion: `Mărește lățimea ferestrei din proprietăți sau adaugă ferestre noi pentru a atinge raportul minim.`,
                });
            }
        }
    }
    const hasError = issues.some(i => i.severity === 'error');
    const hasWarning = issues.some(i => i.severity === 'warning');
    const status = hasError ? 'error' : hasWarning ? 'warning' : 'ok';
    return { id: room.id, status, minRequiredSqm: rule === null || rule === void 0 ? void 0 : rule.min, issues };
}
// ─────────────────────────────────────────────────────────────────
// Lookup pentru clearance_rules (din JSON)
// ─────────────────────────────────────────────────────────────────
function getClearanceRule(code, buildingPurpose) {
    return conformityRules.clearance_rules.find((r) => r.code === code && (!r.applies_to || r.applies_to.includes(buildingPurpose)));
}
// ─────────────────────────────────────────────────────────────────
// Export principal
// ─────────────────────────────────────────────────────────────────
exports.conformityService = {
    evaluateRooms(rooms, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            const purpose = (_a = options === null || options === void 0 ? void 0 : options.buildingPurpose) !== null && _a !== void 0 ? _a : 'residential';
            const roomResults = rooms.map(r => evaluateRoom(r, purpose));
            const extraIssues = [];
            const corridorLabels = new Set(['hol', 'coridor', 'vestibul', 'circulatie', 'circulație']);
            const hasCorridors = rooms.some(r => corridorLabels.has(normalizeLabel(r.label)));
            const hasDoors = !!((_b = options === null || options === void 0 ? void 0 : options.doors) === null || _b === void 0 ? void 0 : _b.length);
            let supplementalRules = [];
            // RAG fallback & optimization
            if (hasCorridors || hasDoors) {
                try {
                    supplementalRules = yield (0, conformityRulesCache_1.getSupplementalRules)(purpose);
                }
                catch (error) {
                    console.warn('[conformityService] RAG supplemental rules failed. Using deterministic fallback.', error);
                }
            }
            const corridorRuleRAG = supplementalRules.find((rule) => rule.code === 'CORRIDOR_MIN_WIDTH');
            const doorRuleRAG = supplementalRules.find((rule) => rule.code === 'DOOR_MIN_WIDTH');
            // Fallback static din JSON dacă RAG nu a returnat valori
            const corridorRuleJSON = getClearanceRule('L114_CORRIDOR_WIDTH', purpose);
            const doorRuleJSON = getClearanceRule('P118_DOOR_WIDTH', purpose);
            const corridorMinM = (_d = (_c = corridorRuleRAG === null || corridorRuleRAG === void 0 ? void 0 : corridorRuleRAG.minValueM) !== null && _c !== void 0 ? _c : corridorRuleJSON === null || corridorRuleJSON === void 0 ? void 0 : corridorRuleJSON.value) !== null && _d !== void 0 ? _d : 1.2;
            const doorMinM = (_f = (_e = doorRuleRAG === null || doorRuleRAG === void 0 ? void 0 : doorRuleRAG.minValueM) !== null && _e !== void 0 ? _e : doorRuleJSON === null || doorRuleJSON === void 0 ? void 0 : doorRuleJSON.value) !== null && _f !== void 0 ? _f : 0.8;
            // Verificare lățime coridor
            for (const room of rooms) {
                const key = normalizeLabel(room.label);
                if (!corridorLabels.has(key))
                    continue;
                if (!room.widthM || !room.heightM)
                    continue;
                const corridorWidth = Math.min(room.widthM, room.heightM);
                if (corridorWidth < corridorMinM) {
                    const delta = parseFloat((corridorMinM - corridorWidth).toFixed(2));
                    const issue = {
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
                        sources: corridorRuleRAG === null || corridorRuleRAG === void 0 ? void 0 : corridorRuleRAG.sources,
                    };
                    const targetRoom = roomResults.find((r) => r.id === room.id);
                    if (targetRoom) {
                        targetRoom.issues.push(issue);
                        if (issue.severity === 'error')
                            targetRoom.status = 'error';
                        else if (issue.severity === 'warning' && targetRoom.status === 'ok')
                            targetRoom.status = 'warning';
                    }
                }
            }
            const mainDoorRuleJSON = getClearanceRule('NP057_DOOR_ENTRANCE_MAIN', purpose);
            const intDoorRuleJSON = getClearanceRule('NP057_DOOR_INTERIOR_WIDTH', purpose);
            const mainDoorMinM = (_g = mainDoorRuleJSON === null || mainDoorRuleJSON === void 0 ? void 0 : mainDoorRuleJSON.value) !== null && _g !== void 0 ? _g : 0.9;
            const intDoorMinM = (_h = intDoorRuleJSON === null || intDoorRuleJSON === void 0 ? void 0 : intDoorRuleJSON.value) !== null && _h !== void 0 ? _h : 0.8;
            // Verificare lățime uși
            if ((_j = options === null || options === void 0 ? void 0 : options.doors) === null || _j === void 0 ? void 0 : _j.length) {
                for (const door of options.doors) {
                    const isExterior = door.isExterior;
                    const requiredMinM = isExterior ? mainDoorMinM : intDoorMinM;
                    const code = isExterior ? 'NP057_DOOR_ENTRANCE_MAIN' : 'NP057_DOOR_INTERIOR_WIDTH';
                    if (door.widthM < requiredMinM) {
                        const delta = parseFloat((requiredMinM - door.widthM).toFixed(2));
                        extraIssues.push({
                            targetType: 'door',
                            targetId: door.id,
                            code,
                            severity: 'error',
                            article: 'NP057/2002',
                            message: `Lățimea ușii ${isExterior ? 'principale' : 'interioare'} este sub minimul legal.`,
                            currentValue: door.widthM,
                            requiredValue: requiredMinM,
                            deltaValue: delta,
                            suggestion: `Mărește lățimea ușii cu cel puțin ${delta} m.`,
                        });
                    }
                }
            }
            // Validare implicită pentru înălțimea tavanului (trece automat de 2.0m pe etaje curente cu 2.7m)
            const ceilingRule = getClearanceRule('NP057_INTERIOR_HEIGHT', purpose);
            if (ceilingRule) {
                // În plan 2D nu avem control pe Z, asumăm standardul de 2.7m.
                // Nu ridicăm eroare, doar dacă ar fi necesar un raport info.
            }
            const roomIssues = roomResults.flatMap((room) => room.issues);
            const allIssues = [...roomIssues, ...extraIssues];
            const violations = allIssues.filter((issue) => issue.severity === 'error');
            const warnings = allIssues.filter((issue) => issue.severity === 'warning');
            return { rooms: roomResults, violations, warnings };
        });
    },
};
