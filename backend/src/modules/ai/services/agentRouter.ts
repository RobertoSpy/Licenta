import { AgentType } from '../../../data/normative-registry';
import { embeddingService } from './embeddingService';

export const AGENT_DESCRIPTIONS: Partial<Record<AgentType, string>> = {
  geotehnic: "Informații despre sol, fundații, pământ, infiltrații, tasare, studiu geotehnic, foraje și adâncimea de îngheț.",
  seismic: "Cutremure, siguranță seismică, zonare, rezistență la cutremur, spectru de răspuns și parametri seismici.",
  structural: "Structura de rezistență, materiale de construcție, beton, armătură, fier, zidărie, stâlpi, grinzi, planșee și acoperiș.",
  architectural: "Design, arhitectură, planul casei, spații, compartimentare, scări, uși, ferestre, fațadă, iluminat, ventilare și funcționalitate.",
  legal: "Legislație, autorizații de construire, certificat de urbanism, primărie, vecini, retrageri, limite de proprietate, suprafețe minime legale și avize.",
  deviz: "Costuri, prețuri, buget, estimare financiară, cheltuieli, oferte și achiziții de materiale.",
  energetic: "Eficiență energetică, clasă energetică, izolație termică, audit energetic, norme NZEB, consum energie.",
  instalatii: "Instalații electrice, sanitare, apă rece, caldă, canalizare, prize, cabluri, tablouri electrice, conducte și țevi.",
  financial: "Analiză financiară, piața construcțiilor, inflație, indici de preț INSSE, costuri pe metru pătrat, prognoze, evoluția prețurilor, moment optim de construire."
};

let cachedAgentEmbeddings: Record<string, number[]> | null = null;

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

const OFF_TOPIC_PATTERNS = [
  /reteta|rețetă|gatit|gătit|mancare|mâncare|restaurant|pizza|prajitura|prăjitură/i,
  /politica|politică|alegeri|partid|premier|presedinte|președinte|guvern|stire|știre/i,
  /fotbal|baschet|tenis|handbal|olimpiada|olimpiadă|meci|echipa de fotbal/i,
  /film|serial|muzica|muzică|actor|cantaret|cântăreț|concert|celebrity|influencer/i,
  /diagnostic|medicament|boala|boală|spital|tratament|simptome/i,
  /criptomoneda|criptomonedă|actiuni|acțiuni|bursa|bursă|forex|trading/i,
];

export function isOffTopic(message: string): boolean {
  return OFF_TOPIC_PATTERNS.some(pattern => pattern.test(message));
}

export const SCREEN_AGENTS: Record<string, AgentType[]> = {
  screen1: ['geotehnic', 'seismic'],
  screen2: ['geotehnic', 'seismic'],
  screen3: ['seismic', 'structural', 'legal'],
  screen4: ['legal', 'architectural'],
  editor:  ['legal', 'structural', 'instalatii', 'architectural'],
  bom:     ['structural', 'materiale', 'deviz', 'energetic', 'instalatii'],
  timeline:['legal', 'structural'],
  energy:  ['energetic', 'structural', 'instalatii'],
  market:  ['financial', 'deviz'],  // Analiză piață construcții
  wizard:  ['geotehnic', 'seismic', 'architectural', 'legal'], // Pentru asistentul din configuratorul de proiect
};

export async function detectRequiredAgents(
  question: string,
  screen: string
): Promise<AgentType[]> {
  const q = question.toLowerCase();
  const agents = new Set<AgentType>();

  if (/sol|teren|fundati|fundare|inghet|îngheț|adancime|adâncime|argilos|nisipos|pietros|stancos|stâncos|apa freatica|apă freatică|infiltrar|geotehni|capacitate portant|tasar|foraj|studiu geotehnic|pamant|pământ|alunecare|umiditate/i.test(q)) {
    agents.add('geotehnic');
  }
  if (/seismic|cutremur|etaj|inaltime cladire|înălțime clădire|zona|ag\b|tc\b|accelerati|spectru seismic|risc seismic|richter|zguduial/i.test(q)) {
    agents.add('seismic');
  }
  if (/zidarie|zidărie|beton|armar|perete structural|zia\b|zna\b|zc\b|dch\b|dcm\b|grosime|rezistent|cleme|fixare|ancor|sutiune|suțiune|smulgere|stalp|stâlp|grinda|grindă|planseu|planșeu|fier|etrier|placa|placă|turnare|ciment|caramida|cărămidă|bca|sarpanta|șarpantă|caprior/i.test(q)) {
    agents.add('structural');
  }
  if (/plan|regularitate|simetrie|categorie.*teren|rugozitate|expunere|vant|vânt|tip.*acoperis|acoperiș|forma|formă|design|aspect|compartimentare|scara|scară|hol|fereastra|fereastră|usa|ușă|iluminat|ventilare|fatada|fațadă/i.test(q)) {
    agents.add('architectural');
  }
  if (/suprafata|suprafață|metru patrat|metru pătrat|\bmp\b|camera|cameră|living|dormitor|baie|bucatarie|bucătărie|minim legal|legea|autorizati|pug\b|puz\b|pud\b|urbanism|aviz|certificat|primarie|primărie|norme|reguli|retragere|limita proprietate|vecin|calcan|gard|aprobare/i.test(q)) {
    agents.add('legal');
  }
  if (/cost|pret|preț|deviz|buget|estimare|mc\b|metru cub|cheltuieli|achiziti|cumpar|magazin|materiale|oferta/i.test(q)) {
    agents.add('deviz');
    agents.add('materiale');
  }
  if (/clasa energetica|clasă energetică|izolati|izolație|consum energie|kwh|nzeb|audit energetic|eficient|termic|vata|vată|eps|xps|polistiren|u-value|transmitant/i.test(q)) {
    agents.add('energetic');
  }
  if (/instalati|sanitar|apa rece|apa calda|apă rece|apă caldă|canalizare|teava|țeavă|conducta|conductă|electric|curent|priza|priză|cablu|intrerupator|întrerupător|tablou electric|iluminat/i.test(q)) {
    agents.add('instalatii');
  }
  if (/inflatie|inflație|indice cost|\bcns\b|insse|pret constructie|preț constructie|cost.*mp|când.*construi|cand.*construi|moment.*optim|piata constructii|piața construcțiilor|prognoze|forecast|material.*s-a scumpit|cat.*costa.*2027|cât.*costă.*202[78]|construi.*acum|merita.*acum/i.test(q)) {
    agents.add('financial');
  }

  if (agents.size === 0) {
    try {
      if (!cachedAgentEmbeddings) {
        cachedAgentEmbeddings = {};
        for (const [agent, desc] of Object.entries(AGENT_DESCRIPTIONS)) {
          cachedAgentEmbeddings[agent] = await embeddingService.embed(desc);
        }
      }

      const questionEmbedding = await embeddingService.embed(question);
      let foundSemantic = false;

      for (const [agent, vector] of Object.entries(cachedAgentEmbeddings)) {
        const similarity = cosineSimilarity(questionEmbedding, vector);
        if (similarity > 0.60) {
          console.log(`[detectRequiredAgents] Semantic Match -> Agent: ${agent} (Scor: ${similarity.toFixed(2)}) pentru "${question}"`);
          agents.add(agent as AgentType);
          foundSemantic = true;
          
          if (agent === 'deviz') agents.add('materiale');
        }
      }
      
      if (foundSemantic) {
        console.log(`[detectRequiredAgents] Agenți din semantic: [${[...agents].join(', ')}]`);
      }
    } catch (e: any) {
      console.error('[detectRequiredAgents] Eroare la clasificarea semantică:', e.message);
    }
  }

  if (agents.size === 0 && screen && SCREEN_AGENTS[screen]) {
    SCREEN_AGENTS[screen].forEach(a => agents.add(a));
    console.log(`[detectRequiredAgents] Fallback pe screen "${screen}": [${[...agents].join(', ')}]`);
  }

  // Pe ecranul de market, forțăm agentul financiar să fie prezent oricum
  if (screen === 'market') {
    agents.add('financial');
  }

  if (agents.size === 0) {
    agents.add('legal');
  }

  return [...agents];
}
