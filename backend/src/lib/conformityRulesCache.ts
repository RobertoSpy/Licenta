import { AgentType, AGENT_SOURCES_BY_PURPOSE, BuildingPurpose } from '../data/normative-registry';
import { searchHybrid } from '../services/ai/ragService';
import { NormativeChunk } from '@prisma/client';

export interface ConformityRuleSource {
  source: string;
  chapter: string;
  excerpt: string;
}

export interface SupplementalRule {
  code: string;
  label: string;
  minValueM: number;
  sources: ConformityRuleSource[];
}

interface RuleSeed {
  code: string;
  label: string;
  agent: AgentType;
  query: string;
  minRangeM: number;
  maxRangeM: number;
}

const RULE_SEEDS: RuleSeed[] = [
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

function extractMeters(text: string, minRangeM: number, maxRangeM: number): number | null {
  const regex = /(\d+(?:[.,]\d+)?)\s*(m|metru|metri|cm|centimetri)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[1].replace(',', '.');
    const unit = match[2].toLowerCase();
    const value = parseFloat(raw);
    if (Number.isNaN(value)) continue;

    const valueM = unit.startsWith('cm') ? value / 100 : value;
    if (valueM >= minRangeM && valueM <= maxRangeM) {
      return parseFloat(valueM.toFixed(2));
    }
  }

  return null;
}

function buildExcerpt(chunk: NormativeChunk): string {
  const content = chunk.content.replace(/\s+/g, ' ').trim();
  return content.length <= EXCERPT_LEN
    ? content
    : `${content.slice(0, EXCERPT_LEN)}…`;
}

async function resolveRuleSeed(seed: RuleSeed, purpose: BuildingPurpose): Promise<SupplementalRule | null> {
  const sources = AGENT_SOURCES_BY_PURPOSE[purpose][seed.agent];
  const chunks = await searchHybrid(seed.query, seed.agent, 5, sources);

  for (const chunk of chunks) {
    const value = extractMeters(chunk.content, seed.minRangeM, seed.maxRangeM);
    if (value !== null) {
      const sources: ConformityRuleSource[] = chunks.slice(0, MAX_SOURCES).map((c) => ({
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
}

// ─────────────────────────────────────────────────────────────────
// In-memory cache — 6h TTL, inflight deduplication
// ─────────────────────────────────────────────────────────────────

const rulesCache = new Map<BuildingPurpose, {
  rules: SupplementalRule[];
  expiresAt: number;
}>();
const inflight = new Map<BuildingPurpose, Promise<SupplementalRule[]>>();

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

export async function getSupplementalRules(purpose: BuildingPurpose = 'residential'): Promise<SupplementalRule[]> {
  const now = Date.now();
  const cached = rulesCache.get(purpose);
  if (cached && now < cached.expiresAt) return cached.rules;

  const existingInflight = inflight.get(purpose);
  if (existingInflight) return existingInflight;

  const promise = (async () => {
    const resolved = await Promise.all(RULE_SEEDS.map(seed => resolveRuleSeed(seed, purpose)));
    const rules = resolved.filter((r): r is SupplementalRule => r !== null);
    rulesCache.set(purpose, { rules, expiresAt: Date.now() + CACHE_TTL_MS });
    inflight.delete(purpose);
    return rules;
  })();

  inflight.set(purpose, promise);
  return promise;
}
