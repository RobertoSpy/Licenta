import { AgentType, AGENT_SOURCES_BY_PURPOSE, BuildingPurpose } from '../../../data/normative-registry';
import { searchHybrid } from './ragService';
import { bomService } from '../../bom/bomService';
import { detectRequiredAgents } from './agentRouter';

export function rewriteShortQuery(question: string, screen: string): string {
  const q = question.toLowerCase().trim();
  if (question.length < 15 || ['gata', 'ok', 'am terminat', 'next', 'da', 'nu'].includes(q)) {
    if (screen === 'screen1') return 'reglementari urbanism legea 50 certificat urbanism POT CUT maxim etaje';
    if (screen === 'screen2') return 'teren fundatie sol zona seismica adancime inghet panta';
    if (screen === 'screen3') return 'suprafete minime familie reglementari legea locuintei spatiu minim';
    if (screen === 'screen4') return 'stil architectural buget estimare cost materiale';
    if (screen === 'editor') return 'plan arhitectura iluminat natural ferestre suprafete minime legea locuintei orientare usi';
    if (screen === 'bom') return 'deviz estimare beton armat fier beton zidarie pret manopera';
  }
  return question;
}

export async function buildRAGContext(
  question: string,
  screen: string,
  project: {
    county?: string | null;
    locality?: string | null;
    seismicZone?: string | null;
    frostDepthCm?: number | null;
    soilType?: string | null;
    windPressureKpa?: number | null;
    terrainCategory?: string | null;
    buildingPurpose?: string | null;
  }
): Promise<string> {
  const agents = await detectRequiredAgents(question, screen);
  const limitPerAgent = agents.length === 1 ? 5 : 3;

  console.log(`[buildRAGContext] Agenți activi: [${agents.join(', ')}] pentru screen="${screen}"`);

  const contextParts = await Promise.all(
    agents.map(async agent => {
      if (agent === 'materiale') {
        const { ragService } = await import('./ragService');
        const materialChunks = await ragService.searchRelevantMaterialChunks(question, limitPerAgent);
        if (materialChunks.includes('Nu am găsit')) return null;
        return `[AGENT MATERIALE]\n${materialChunks}`;
      }

      const purpose = (project.buildingPurpose as BuildingPurpose) ?? 'residential';
      const agentSources = AGENT_SOURCES_BY_PURPOSE[purpose]?.[agent] || [];

      if (agentSources.length === 0) return null;

      const augmentedQuery = rewriteShortQuery(question, screen);

      const chunks = await searchHybrid(augmentedQuery, agent, limitPerAgent, agentSources, purpose);
      if (chunks.length === 0) return null;

      const chunksText = chunks
        .map(c => `§ ${c.source} — ${c.chapter}:\n${c.content}`)
        .join('\n\n');

      return `[AGENT ${agent.toUpperCase()}]\n${chunksText}`;
    })
  );

  const foundationSpec = bomService.getFoundationSpec(project.frostDepthCm, project.soilType);

  const bomContextBlock = bomService.getBOMContextForAI(0, {
    seismicZone:  project.seismicZone,
    soilType:     project.soilType,
    frostDepthCm: project.frostDepthCm,
    totalFloors:  null,
  });

  const fullProjectLines = [
    '[DATE PROIECT — DETERMINISTE]',
    project.county          ? `Județ: ${project.county}` : null,
    project.locality        ? `Localitate: ${project.locality}` : null,
    project.seismicZone     ? `Zonă seismică: ${project.seismicZone} (P100-1-2013, Anexa A)` : null,
    project.frostDepthCm    ? `Adâncime îngheț: ${project.frostDepthCm} cm (NP112-2014, Anexa B)` : null,
    project.soilType        ? `Tip sol: ${project.soilType}` : null,
    project.windPressureKpa ? `Presiune vânt qb: ${project.windPressureKpa} kPa (CR1-1-4-2012, Anexa A)` : null,
    project.terrainCategory ? `Categorie teren rugozitate: ${project.terrainCategory}` : null,
    project.frostDepthCm    ? bomService.formatForPrompt(foundationSpec) : null,
  ].filter(Boolean).join('\n');

  return [
    fullProjectLines,
    bomContextBlock,
    ...contextParts.filter(Boolean),
  ].join('\n\n---\n\n');
}

export function agentLabel(agents: AgentType[]): string {
  const labels: Record<AgentType, string> = {
    geotehnic:     'Geotehnică & Fundații',
    seismic:       'Seismicitate & Structură',
    structural:    'Structuri & Materiale',
    architectural: 'Arhitectură & Reglementări',
    legal:         'Legislație & Urbanism',
    materiale:     'Cataloage Materiale',
    deviz:         'Deviz & Estimare Costuri',
    energetic:     'Eficiență Energetică',
    instalatii:    'Instalații Sanitare & Electrice',
    general:       'General',
    financial:     'Analiză Piață & Costuri INSSE',
  };
  return agents.map(a => labels[a] || a).join(', ');
}

export function getStatusDisclaimer(agents: AgentType[]): string {
  let disclaimer = '';
  if (agents.includes('seismic')) {
    disclaimer += '\n⚠️ **Notă normativ:** P100-1/2013 este versiunea în vigoare. P100-1/2025 este în stadiu de redactare și nu a intrat în vigoare.\n';
  }
  if (agents.includes('legal') || agents.includes('architectural')) {
    disclaimer += '\n⚠️ **Notă normativ:** NP057-2002 (normativul locuințelor) se află pe lista MDLPA de reglementări propuse spre revizuire. Cifrele folosite reprezintă prevederile legal în vigoare la acest moment.\n';
  }
  return disclaimer;
}
