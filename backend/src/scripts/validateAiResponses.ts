/**
 * SCRIPT: validateAiResponses.ts
 * Scop: Validarea calitativă a răspunsurilor asistentului AI Zidario
 * pe un set de 20 de interogări reprezentative.
 *
 * Rulare: npx ts-node src/scripts/validateAiResponses.ts
 *
 * Rezultate: ./validation_results.json și ./validation_results.csv
 */

import fs from 'fs';
import path from 'path';
import http from 'http';

// ──────────────────────────────────────────────────────────────
// CONFIGURARE
// ──────────────────────────────────────────────────────────────
const BACKEND_HOST = 'localhost';
const BACKEND_PORT = 3000;
const ENDPOINT = '/api/ai/chat';
const LOGIN_ENDPOINT = '/api/auth/login';
const TIMEOUT_MS = 60_000; // 60 secunde per interogare

// Credențiale test (admin seeded)
const TEST_EMAIL = 'robertospiridon1@gmail.com';
const TEST_PASSWORD = 'Admin123!';

// ──────────────────────────────────────────────────────────────
// SETUL DE 20 INTEROGĂRI DE VALIDARE
// Acoperă toate domeniile agenților definiți în agentRouter.ts:
// geotehnic, seismic, structural, architectural, legal,
// deviz, energetic, instalatii, financial + off-topic
// ──────────────────────────────────────────────────────────────
interface QueryEntry {
  id: number;
  domain: string;
  screen: string;
  question: string;
  expectedKeywords: string[]; // cuvinte-cheie din răspunsul corect
  expectedNOT: string[];      // cuvinte care NU trebuie să apară
}

const QUERIES: QueryEntry[] = [
  {
    id: 1,
    domain: 'geotehnic',
    screen: 'screen1',
    question: 'Care este adâncimea minimă de îngheț pentru fundație în județul Cluj?',
    expectedKeywords: [
      'îngheț',
      'fundație',
      'cm',
      'cluj'
    ],
    expectedNOT: []
  },
  {
    id: 2,
    domain: 'geotehnic',
    screen: 'screen1',
    question: 'Trebuie să fac studiu geotehnic înainte de a construi?',
    expectedKeywords: [
      'geotehnic',
      'studiu',
      'fundație'
    ],
    expectedNOT: []
  },
  {
    id: 3,
    domain: 'seismic',
    screen: 'screen2',
    question: 'Ce zonă seismică este București și care este accelerația de calcul ag?',
    expectedKeywords: [
      'seismic',
      'bucurești',
      'ag'
    ],
    expectedNOT: []
  },
  {
    id: 4,
    domain: 'seismic',
    screen: 'screen3',
    question: 'Câte etaje pot construi într-o zonă cu risc seismic ridicat?',
    expectedKeywords: [
      'etaj',
      'seismic'
    ],
    expectedNOT: []
  },
  {
    id: 5,
    domain: 'structural',
    screen: 'bom',
    question: 'Pot folosi BCA pentru pereții structurali exteriori?',
    expectedKeywords: [
      'bca',
      'structural',
      'perete'
    ],
    expectedNOT: []
  },
  {
    id: 6,
    domain: 'structural',
    screen: 'bom',
    question: 'Ce clasă de beton se folosește în mod normal pentru fundație izolată?',
    expectedKeywords: [
      'beton',
      'fundație',
      'clasă',
      'C'
    ],
    expectedNOT: []
  },
  {
    id: 7,
    domain: 'legal',
    screen: 'screen4',
    question: 'Care este suprafața minimă legală pentru o cameră de zi conform Legii 114?',
    expectedKeywords: [
      'suprafață',
      'mp',
      'living',
      'lege'
    ],
    expectedNOT: []
  },
  {
    id: 8,
    domain: 'legal',
    screen: 'screen4',
    question: 'Ce documente îmi trebuie pentru autorizația de construire?',
    expectedKeywords: [
      'autorizație',
      'certificat',
      'urbanism',
      'primărie'
    ],
    expectedNOT: []
  },
  {
    id: 9,
    domain: 'architectural',
    screen: 'editor',
    question: 'Care este suprafața minimă pentru o baie conform normativelor în vigoare?',
    expectedKeywords: [
      'baie',
      'mp',
      'suprafață'
    ],
    expectedNOT: []
  },
  {
    id: 10,
    domain: 'deviz',
    screen: 'bom',
    question: 'Cât costă aproximativ un metru cub de beton turnat?',
    expectedKeywords: [
      'beton',
      'cost',
      'lei'
    ],
    expectedNOT: []
  },
  {
    id: 11,
    domain: 'deviz',
    screen: 'bom',
    question: 'Pot înlocui betonul C20/20 cu C16/20 pentru fundație ca să economisesc?',
    expectedKeywords: [
      'beton',
      'fundație',
      'rezistență'
    ],
    expectedNOT: []
  },
  {
    id: 12,
    domain: 'energetic',
    screen: 'energy',
    question: 'Ce grosime de polistiren este necesară pentru o casă de clasa energetică A?',
    expectedKeywords: [
      'izolație',
      'polistiren',
      'cm',
      'energetic'
    ],
    expectedNOT: []
  },
  {
    id: 13,
    domain: 'energetic',
    screen: 'energy',
    question: 'Ce înseamnă NZEB și se aplică la casele individuale?',
    expectedKeywords: [
      'NZEB',
      'energie',
      'consum'
    ],
    expectedNOT: []
  },
  {
    id: 14,
    domain: 'instalatii',
    screen: 'editor',
    question: 'Ce secțiune de cablu electric se folosește pentru o priză de 16A?',
    expectedKeywords: [
      'cablu',
      'priză',
      'secțiune',
      'mm'
    ],
    expectedNOT: []
  },
  {
    id: 15,
    domain: 'instalatii',
    screen: 'editor',
    question: 'Ce distanță minimă trebuie între o conductă de gaz și una de apă?',
    expectedKeywords: [
      'conductă',
      'gaz',
      'apă',
      'distanță'
    ],
    expectedNOT: []
  },
  {
    id: 16,
    domain: 'financial',
    screen: 'market',
    question: 'A crescut prețul materialelor de construcție în 2024 față de 2023?',
    expectedKeywords: [
      'preț',
      'materiale',
      '2024'
    ],
    expectedNOT: []
  },
  {
    id: 17,
    domain: 'financial',
    screen: 'market',
    question: 'Care este evoluția indicelui de cost în construcții CNS107D?',
    expectedKeywords: [
      'indice',
      'cost',
      'construcții'
    ],
    expectedNOT: []
  },
  {
    id: 18,
    domain: 'off-topic',
    screen: 'screen1',
    question: 'Cum fac o rețetă de lasagne?',
    expectedKeywords: [
      'întrebare',
      'casa',
      'specializat'
    ],
    expectedNOT: [
      'lasagne',
      'rețetă',
      'paste'
    ]
  },
  {
    id: 19,
    domain: 'off-topic',
    screen: 'bom',
    question: 'Cine a câștigat campionatul de fotbal în 2024?',
    expectedKeywords: [
      'întrebare',
      'casa',
      'specializat'
    ],
    expectedNOT: [
      'fotbal',
      'campionat',
      'echipă'
    ]
  },
  {
    id: 20,
    domain: 'off-topic',
    screen: 'screen2',
    question: 'Cum evoluează Bitcoin-ul în 2020?',
    expectedKeywords: [
      'construcții'
    ],
    expectedNOT: [
      'bitcoin',
      'criptomonedă',
      'preț'
    ]
  }
];

// ──────────────────────────────────────────────────────────────
// TIPURI REZULTAT
// ──────────────────────────────────────────────────────────────
type Rating = 'CORECT' | 'PARTIAL' | 'GRESIT' | 'EROARE';
type ManualRating = Rating | '';

interface ResultEntry {
  id: number;
  domain: string;
  question: string;
  response: string;
  autoRating: Rating;      // calculat automat prin keyword matching
  manualRating: ManualRating; // completat manual după inspecție
  manualNote: string;      // justificare pentru PARTIAL / GRESIT
  matchedKeywords: string[];
  missedKeywords: string[];
  foundForbidden: string[];
  durationMs: number;
}

// ──────────────────────────────────────────────────────────────
// FUNCȚIE: Obținere token JWT prin login HTTP
// ──────────────────────────────────────────────────────────────
function getValidToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD });

    const options: http.RequestOptions = {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: LOGIN_ENDPOINT,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    let data = '';
    const req = http.request(options, (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const token = parsed.token || parsed.accessToken || parsed.data?.token;
          if (!token) reject(new Error(`Login eșuat. Răspuns: ${data.slice(0, 200)}`));
          else resolve(token);
        } catch (e) {
          reject(new Error(`Nu s-a putut parsa răspunsul login: ${data.slice(0, 200)}`));
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ──────────────────────────────────────────────────────────────
// FUNCȚIE: Apel HTTP cu colectare SSE stream (cu JWT)
// ──────────────────────────────────────────────────────────────
function callChat(question: string, screen: string, token: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      message: question,
      screenContext: screen,
      conversationHistory: [],
    });

    const options: http.RequestOptions = {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: ENDPOINT,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${token}`,
      },
    };

    let fullText = '';
    let timeoutHandle: NodeJS.Timeout;

    const req = http.request(options, (res) => {
      timeoutHandle = setTimeout(() => {
        req.destroy();
        reject(new Error(`TIMEOUT după ${TIMEOUT_MS}ms`));
      }, TIMEOUT_MS);

      // Dacă primim 401/403, aruncăm o eroare specială pentru re-autentificare
      if (res.statusCode === 401 || res.statusCode === 403) {
        clearTimeout(timeoutHandle);
        reject(new Error('TOKEN_EXPIRED'));
        return;
      }

      if (res.statusCode !== 200) {
        clearTimeout(timeoutHandle);
        let errBody = '';
        res.setEncoding('utf8');
        res.on('data', chunk => errBody += chunk);
        res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${errBody.slice(0, 150)}`)));
        return;
      }

      let buffer = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        // Buffer-based SSE parser — robust față de chunk-uri parțiale TCP
        buffer += chunk;
        const parts = buffer.split('\n');
        // Ultimul element poate fi incomplet — îl păstrăm în buffer
        buffer = parts.pop() ?? '';
        for (const line of parts) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ') && !trimmed.includes('[DONE]')) {
            try {
              const json = JSON.parse(trimmed.slice(6));
              if (json.error) {
                clearTimeout(timeoutHandle);
                reject(new Error(json.error));
                return;
              }
              if (json.text) fullText += json.text;
            } catch {
              // ignoră liniile non-JSON
            }
          }
        }
      });

      res.on('end', () => {
        clearTimeout(timeoutHandle);
        resolve(fullText.trim());
      });

      res.on('error', (err) => {
        clearTimeout(timeoutHandle);
        reject(err);
      });
    });

    req.on('error', (err) => {
      clearTimeout(timeoutHandle!);
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

// ──────────────────────────────────────────────────────────────
// FUNCȚIE: Evaluare automată a răspunsului
// ──────────────────────────────────────────────────────────────
function evaluateResponse(
  entry: QueryEntry,
  response: string
): Omit<ResultEntry, 'id' | 'domain' | 'question' | 'durationMs'> {
  const responseLower = response.toLowerCase();

  const matchedKeywords = entry.expectedKeywords.filter(kw =>
    responseLower.includes(kw.toLowerCase())
  );
  const missedKeywords = entry.expectedKeywords.filter(kw =>
    !responseLower.includes(kw.toLowerCase())
  );
  const foundForbidden = entry.expectedNOT.filter(kw =>
    responseLower.includes(kw.toLowerCase())
  );

  let autoRating: Rating;

  if (foundForbidden.length > 0) {
    autoRating = 'GRESIT'; // a dat răspuns off-topic când nu trebuia
  } else if (missedKeywords.length === 0 && entry.expectedKeywords.length > 0) {
    autoRating = 'CORECT';
  } else if (matchedKeywords.length >= Math.ceil(entry.expectedKeywords.length / 2)) {
    autoRating = 'PARTIAL';
  } else {
    autoRating = 'GRESIT';
  }

  return {
    autoRating,
    manualRating: '', // de completat manual în Excel
    manualNote: '',   // justificare pentru PARTIAL / GRESIT
    matchedKeywords,
    missedKeywords,
    foundForbidden,
    response,
  };
}

// ──────────────────────────────────────────────────────────────
// FUNCȚIE: Export CSV — format hibrid auto + manual
// Coloane: ID, Domeniu, Intrebare, Rating Auto, Rating Manual,
//          Nota, Raspuns (200 char), Durata (ms)
// ──────────────────────────────────────────────────────────────
function exportCSV(results: ResultEntry[]): string {
  const header = 'ID,Domeniu,Intrebare,Rating Auto,Rating Manual,Nota,Raspuns (primele 200 char),Durata (ms)\n';
  const rows = results.map(r => {
    const q  = r.question.replace(/"/g, "''");
    const rsp = r.response.slice(0, 200).replace(/"/g, "''").replace(/\n/g, ' ');
    return (
      `${r.id},"${r.domain}","${q}",` +
      `"${r.autoRating}","${r.manualRating}","${r.manualNote}",` +
      `"${rsp}",${r.durationMs}`
    );
  });
  return header + rows.join('\n');
}

// ──────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   ZIDARIO AI — Script de Validare Semantică (20 query)   ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log(`Backend: http://${BACKEND_HOST}:${BACKEND_PORT}${ENDPOINT}\n`);

  // ── GENERARE TOKEN JWT ───────────────────────────────────
  let jwtToken = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      process.stdout.write(`🔑 Generare token JWT (incercare ${attempt}/3)...`);
      jwtToken = await getValidToken();
      console.log(' ✅ Token generat\n');
      break;
    } catch (err: any) {
      const isConnErr = err.message?.includes('hang up') || err.message?.includes('ECONNRESET') || err.message?.includes('ECONNREFUSED');
      if (isConnErr && attempt < 3) {
        console.log(` Astept 6s si reincerc...`);
        await new Promise(r => setTimeout(r, 6000));
      } else {
        console.error(`\n Eroare token: ${err.message}`);
        console.error('Asigura-te ca docker compose ruleaza si ca DB are date seed.');
        process.exit(1);
      }
    }
  }

  const results: ResultEntry[] = [];
  let correct = 0, partial = 0, wrong = 0, errors = 0;

  for (const query of QUERIES) {
    const prefix = `[${String(query.id).padStart(2, '0')}/20]`;
    process.stdout.write(`${prefix} [${query.domain.toUpperCase().padEnd(12)}] ${query.question.slice(0, 60)}...`);

    const start = Date.now();
    let response = '';
    let autoRating: Rating = 'EROARE';
    let matchedKeywords: string[] = [];
    let missedKeywords: string[] = [];
    let foundForbidden: string[] = [];

    try {
      response = await callChat(query.question, query.screen, jwtToken);
    } catch (err: any) {
      // Re-autentificare automată la token expirat
      if (err.message === 'TOKEN_EXPIRED') {
        process.stdout.write(' 🔄 token expirat, re-login...');
        try {
          jwtToken = await getValidToken();
          response = await callChat(query.question, query.screen, jwtToken);
        } catch (retryErr: any) {
          response   = `EROARE: ${retryErr.message}`;
          autoRating = 'EROARE';
          errors++;
        }
      // Retry la socket hang up (nodemon restart)
      } else if (err.message?.includes('hang up') || err.message?.includes('ECONNRESET')) {
        process.stdout.write(' ⏳ backend restart, aștept 5s...');
        await new Promise(r => setTimeout(r, 5000));
        try {
          response = await callChat(query.question, query.screen, jwtToken);
        } catch (retryErr: any) {
          response   = `EROARE: ${retryErr.message}`;
          autoRating = 'EROARE';
          errors++;
        }
      // Retry la suprasolicitare API Gemini (503 Rate Limit)
      } else if (err.message?.includes('suprasolicitat') || err.message?.includes('503')) {
        process.stdout.write(' ⏳ API Gemini suprasolicitat, aștept 35s...');
        await new Promise(r => setTimeout(r, 35000));
        try {
          response = await callChat(query.question, query.screen, jwtToken);
        } catch (retryErr: any) {
          response   = `EROARE: ${retryErr.message}`;
          autoRating = 'EROARE';
          errors++;
        }
      } else {
        response   = `EROARE: ${err.message}`;
        autoRating = 'EROARE';
        errors++;
      }
    }

    // Evaluează răspunsul pentru orice cale de succes (normal sau după retry)
    if (response && !response.startsWith('EROARE:')) {
      const evaluation = evaluateResponse(query, response);
      autoRating      = evaluation.autoRating;
      matchedKeywords = evaluation.matchedKeywords;
      missedKeywords  = evaluation.missedKeywords;
      foundForbidden  = evaluation.foundForbidden;
    }

    const durationMs = Date.now() - start;

    // Contorizare statistici (pe baza evaluării automate)
    if (autoRating === 'CORECT') correct++;
    else if (autoRating === 'PARTIAL') partial++;
    else if (autoRating === 'GRESIT') wrong++;

    // Culori în terminal (ANSI)
    const colorMap: Record<Rating, string> = {
      CORECT:  '\x1b[32m',  // verde
      PARTIAL: '\x1b[33m',  // galben
      GRESIT:  '\x1b[31m',  // roșu
      EROARE:  '\x1b[35m',  // mov
    };
    const reset = '\x1b[0m';
    const color = colorMap[autoRating];

    console.log(` → ${color}AUTO:${autoRating}${reset} (${durationMs}ms)`);
    if (autoRating !== 'CORECT' && autoRating !== 'EROARE') {
      if (missedKeywords.length) console.log(`         Lipsesc kw: ${missedKeywords.join(', ')}`);
      if (foundForbidden.length) console.log(`         Interzise: ${foundForbidden.join(', ')}`);
    }

    results.push({
      id: query.id,
      domain: query.domain,
      question: query.question,
      response,
      autoRating,
      manualRating: '', // de completat în Excel
      manualNote:   '', // justificare pentru PARTIAL / GRESIT
      matchedKeywords,
      missedKeywords,
      foundForbidden,
      durationMs,
    });

    // Pauză obligatorie de 15 secunde între cereri pentru a respecta
    // limita de 15 RPM (Requests Per Minute) a API-ului Gemini (Free Tier)
    await new Promise(res => setTimeout(res, 15000));
  }

  // ── SUMAR ──────────────────────────────────────────────────
  const total = QUERIES.length;
  const accuracy = ((correct + partial * 0.5) / total * 100).toFixed(1);

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║        SUMAR VALIDARE — EVALUARE AUTOMATĂ        ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Total interogări:      ${String(total).padEnd(20)}║`);
  console.log(`║  ✅ CORECT (auto):      ${String(correct).padEnd(20)}║`);
  console.log(`║  🟡 PARȚIAL (auto):     ${String(partial).padEnd(20)}║`);
  console.log(`║  ❌ GREȘIT (auto):      ${String(wrong).padEnd(20)}║`);
  console.log(`║  💥 EROARE:             ${String(errors).padEnd(20)}║`);
  console.log(`║  📊 Scor auto ponderat: ${(accuracy + '%').padEnd(20)}║`);
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  ⚠️  Completează coloana Rating Manual în CSV!    ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // ── SALVARE FIȘIERE ────────────────────────────────────────
  const outDir = path.resolve(__dirname, '../../validation_output');
  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, 'validation_results.json');
  const csvPath = path.join(outDir, 'validation_results.csv');
  const summaryPath = path.join(outDir, 'validation_summary.txt');

  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      { summary: { total, correct, partial, wrong, errors, accuracyAuto: accuracy }, results },
      null, 2
    )
  );
  fs.writeFileSync(csvPath, exportCSV(results));
  fs.writeFileSync(summaryPath, [
    'ZIDARIO AI — Raport de Validare Semantică',
    `Data: ${new Date().toLocaleString('ro-RO')}`,
    '',
    '=== EVALUARE AUTOMATĂ (keyword matching) ===',
    `Total interogări : ${total}`,
    `CORECT   (auto)  : ${correct} (${(correct / total * 100).toFixed(1)}%)`,
    `PARȚIAL  (auto)  : ${partial} (${(partial / total * 100).toFixed(1)}%)`,
    `GREȘIT   (auto)  : ${wrong} (${(wrong / total * 100).toFixed(1)}%)`,
    `EROARE           : ${errors}`,
    `Scor auto ponderat: ${accuracy}%`,
    '',
    '=== EVALUARE MANUALĂ ===',
    'Deschide validation_results.csv în Excel și completează:',
    '  - Coloana E (Rating Manual): CORECT / PARTIAL / GRESIT',
    '  - Coloana F (Nota): justificare scurtă pentru PARTIAL / GRESIT',
    '',
    'Metodologie: Hibrid automat + manual (standard NLP evaluation)',
  ].join('\n'));

  console.log(`📁 Rezultate salvate în: ${outDir}`);
  console.log(`   ├── ${path.basename(jsonPath)}`);
  console.log(`   ├── ${path.basename(csvPath)}`);
  console.log(`   └── ${path.basename(summaryPath)}`);
}

main().catch(async err => {
  console.error('\n❌ Eroare fatală:', err.message);
  process.exit(1);
});
