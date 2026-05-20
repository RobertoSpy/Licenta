import { AgentType } from '../data/normative-registry';
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
    code: 'P118_CORRIDOR_MIN_WIDTH',
    label: 'Lățime minimă coridor/hol (evacuare)',
    agent: 'architectural',
    query: 'latime minima coridor evacuare locuinta P118-99',
    minRangeM: 0.8,
    maxRangeM: 2.5,
  },
  {
    code: 'P118_DOOR_MIN_WIDTH',
    label: 'Lățime minimă ușă evacuare locuință',
    agent: 'architectural',
    query: 'latime minima usa evacuare locuinta P118-99',
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

async function resolveRuleSeed(seed: RuleSeed): Promise<SupplementalRule | null> {
  const chunks = await searchHybrid(seed.query, seed.agent, 5);

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

let cachedRules: SupplementalRule[] | null = null;
let cacheExpiresAt = 0;
let inflight: Promise<SupplementalRule[]> | null = null;

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

export async function getSupplementalRules(): Promise<SupplementalRule[]> {
  const now = Date.now();
  if (cachedRules && now < cacheExpiresAt) return cachedRules;
  if (inflight) return inflight;

  inflight = (async () => {
    const resolved = await Promise.all(RULE_SEEDS.map(resolveRuleSeed));
    cachedRules = resolved.filter((r): r is SupplementalRule => r !== null);
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    inflight = null;
    return cachedRules;
  })();

  return inflight;
}
