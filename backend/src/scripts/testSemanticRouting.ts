import { AGENT_DESCRIPTIONS } from '../modules/ai/services/agentRouter';
import { embeddingService } from '../modules/ai/services/embeddingService';

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

const queries = [
  { q: "Apa freatică este la 2 metri adâncime, este sigur să fac subsol?", expected: "geotehnic" },
  { q: "În ce zonă de risc la cutremur se află Bucureștiul?", expected: "seismic" },
  { q: "Cât fier beton de 12 trebuie să bag în stâlpii de la parter?", expected: "structural" },
  { q: "Cum ar trebui să compartimentez spațiul pentru a avea mai multă lumină în living?", expected: "architectural" },
  { q: "Care este limita minimă de retragere față de vecini conform PUG?", expected: "legal" },
  { q: "Fă-mi un calcul aproximativ pentru costurile de finisaj.", expected: "deviz" },
  { q: "Ce polistiren îmi recomanzi pentru o izolație care respectă NZEB?", expected: "energetic" },
  { q: "Ce tip de tablou și conducte îmi trebuie la instalația casei?", expected: "instalatii" }
];

async function runTest() {
  const agentVectors: Record<string, number[]> = {};
  for (const [agent, desc] of Object.entries(AGENT_DESCRIPTIONS)) {
    agentVectors[agent] = await embeddingService.embed(desc);
  }

  console.log("Rezultate Test Semantic Routing:\n");

  for (const item of queries) {
    const qVec = await embeddingService.embed(item.q);
    console.log(`\nÎntrebare: "${item.q}" (Așteptat: ${item.expected})`);
    const results = [];
    for (const [agent, agentVec] of Object.entries(agentVectors)) {
      const score = cosineSimilarity(qVec, agentVec);
      results.push({ agent, score });
    }
    
    // Sorteaza descrescator
    results.sort((a, b) => b.score - a.score);
    
    for (const res of results.slice(0, 3)) { // afisam top 3
      console.log(`  - ${res.agent}: ${res.score.toFixed(3)}`);
    }
  }
}

runTest().catch(console.error);
