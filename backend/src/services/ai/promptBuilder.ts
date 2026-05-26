import { AgentType, AGENT_SOURCES_BY_PURPOSE, BuildingPurpose } from '../../data/normative-registry';
import { searchHybrid } from './ragService';
import { bomService } from '../bomService';
import { detectRequiredAgents } from './agentRouter';

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
      const purpose = (project.buildingPurpose as BuildingPurpose) ?? 'residential';
      const agentSources = AGENT_SOURCES_BY_PURPOSE[purpose]?.[agent] || [];

      if (agentSources.length === 0) return null;

      const chunks = await searchHybrid(question, agent, limitPerAgent, agentSources, purpose);
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
