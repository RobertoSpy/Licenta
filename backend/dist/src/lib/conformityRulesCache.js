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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupplementalRules = getSupplementalRules;
const normative_registry_1 = require("../data/normative-registry");
const ragService_1 = require("../modules/ai/services/ragService");
const RULE_SEEDS = [
    {
        code: 'CORRIDOR_MIN_WIDTH',
        label: 'Lățime minimă coridor/hol',
        agent: 'architectural',
        query: 'latime minima coridor hol circulatie interioara trecere libera',
        minRangeM: 0.8,
        maxRangeM: 2.5,
    },
    {
        code: 'DOOR_MIN_WIDTH',
        label: 'Lățime minimă ușă',
        agent: 'architectural',
        query: 'dimensiuni minime goluri usi interioare latime minima trecere',
        minRangeM: 0.6,
        maxRangeM: 1.5,
    },
];
const MAX_SOURCES = 2;
const EXCERPT_LEN = 260;
function extractMeters(text, minRangeM, maxRangeM) {
    const regex = /(\d+(?:[.,]\d+)?)\s*(m|metru|metri|cm|centimetri)/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
        const raw = match[1].replace(',', '.');
        const unit = match[2].toLowerCase();
        const value = parseFloat(raw);
        if (Number.isNaN(value))
            continue;
        const valueM = unit.startsWith('cm') ? value / 100 : value;
        if (valueM >= minRangeM && valueM <= maxRangeM) {
            return parseFloat(valueM.toFixed(2));
        }
    }
    return null;
}
function buildExcerpt(chunk) {
    const content = chunk.content.replace(/\s+/g, ' ').trim();
    return content.length <= EXCERPT_LEN
        ? content
        : `${content.slice(0, EXCERPT_LEN)}…`;
}
function resolveRuleSeed(seed, purpose) {
    return __awaiter(this, void 0, void 0, function* () {
        const sources = normative_registry_1.AGENT_SOURCES_BY_PURPOSE[purpose][seed.agent];
        const chunks = yield (0, ragService_1.searchHybrid)(seed.query, seed.agent, 5, sources);
        for (const chunk of chunks) {
            const value = extractMeters(chunk.content, seed.minRangeM, seed.maxRangeM);
            if (value !== null) {
                const sources = chunks.slice(0, MAX_SOURCES).map((c) => ({
                    source: c.source,
                    chapter: c.chapter,
                    excerpt: buildExcerpt(c),
                }));
                return {
                    code: seed.code,
                    label: seed.label,
                    minValueM: value,
                    sources,
                };
            }
        }
        return null;
    });
}
// ─────────────────────────────────────────────────────────────────
// In-memory cache — 6h TTL, inflight deduplication
// ─────────────────────────────────────────────────────────────────
const rulesCache = new Map();
const inflight = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
function getSupplementalRules() {
    return __awaiter(this, arguments, void 0, function* (purpose = 'residential') {
        const now = Date.now();
        const cached = rulesCache.get(purpose);
        if (cached && now < cached.expiresAt)
            return cached.rules;
        const existingInflight = inflight.get(purpose);
        if (existingInflight)
            return existingInflight;
        const promise = (() => __awaiter(this, void 0, void 0, function* () {
            const resolved = yield Promise.all(RULE_SEEDS.map(seed => resolveRuleSeed(seed, purpose)));
            const rules = resolved.filter((r) => r !== null);
            rulesCache.set(purpose, { rules, expiresAt: Date.now() + CACHE_TTL_MS });
            inflight.delete(purpose);
            return rules;
        }))();
        inflight.set(purpose, promise);
        return promise;
    });
}
