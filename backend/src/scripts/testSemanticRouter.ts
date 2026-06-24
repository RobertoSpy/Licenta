import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../../.env') });
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

// Aici poți pune exact cele 8 întrebări din lucrarea ta (Tabelul 3.2)
const testQueries = [
  "Apa freatică este la 2 metri adâncime, este sigur să fac subsol?",
  "În ce zonă de risc la cutremur se află Bucureștiul?",
  "Cât fier beton de 12 trebuie să bag în stâlpii de la parter?",
  "Cum ar trebui să compartimentez spațiul pentru a avea mai multă lumină în living?",
  "Care este limita minimă de retragere față de vecini conform PUG?",
  "Fă-mi un calcul aproximativ pentru costurile de finisaj.",
  "Ce polistiren îmi recomanzi pentru o izolație care respectă NZEB?",
  "Ce tip de tablou și conducte îmi trebuie la instalația casei?"
];

async function run() {
  console.log("\n[1] Apelam Google Gemini pentru a calcula vectorii celor 9 Agenți ZIDARIO...");
  const agentVectors: Record<string, number[]> = {};
  for (const [agent, desc] of Object.entries(AGENT_DESCRIPTIONS)) {
    agentVectors[agent] = await embeddingService.embed(desc!);
  }

  console.log("[2] Gata! Începem testarea întrebărilor...\n");

  for (const query of testQueries) {
    console.log(`=======================================================`);
    console.log(`Q: "${query}"`);
    const qVec = await embeddingService.embed(query);
    
    const scores: { agent: string, score: number }[] = [];
    for (const [agent, vec] of Object.entries(agentVectors)) {
      const score = cosineSimilarity(qVec, vec);
      scores.push({ agent, score });
    }

    // Sortăm descrescător
    scores.sort((a, b) => b.score - a.score);

    console.log(`🏆 TOP 3 Agenți (conform similarității Cosinus):`);
    for (let i = 0; i < 3; i++) {
      const { agent, score } = scores[i];
      const isAboveThreshold = score >= 0.60 ? "✅ PASS (>0.60)" : "❌ REJECTED";
      console.log(`  ${i + 1}. [${agent.padEnd(14)}] -> ${score.toFixed(3)}  ${isAboveThreshold}`);
    }
    console.log();
  }
}

run().catch(console.error);
