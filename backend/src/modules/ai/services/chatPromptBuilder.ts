import { AgentType } from '../../../data/normative-registry';
import { agentLabel } from './promptBuilder';

export interface ChatPromptInput {
  userQuestion: string;
  contextString: string;
  conversationHistory?: { role: string; text: string }[];
  screenContext?: string;
  historySummary?: string | null;
  activeAgents: AgentType[];
  statusDisclaimer: string;
  ragContext: string;
}

function buildScreenSpecificBlock(screen: string): string {
  if (screen.startsWith('screen')) {
    return `
CONTEXT SPECIAL — FAZA 1: WIZARD & TEREN
- Rolul tău este să îl înveți pe utilizator despre teren, fundație, zonă seismică și limitări generale (în funcție de pasul exact la care se află).
- LIMITĂ TEHNICĂ CALCULATĂ DETERMINIST (din context): Explică "Maximum tehnic etaje" pe baza CR6-2013 + P100-1/2013.
- OBLIGATORIU: Avertizează că Primăria locală poate impune restricții mai stricte prin PUG și recomandă obținerea Certificatului de Urbanism.
- Nu discuta despre arhitectura interioară sau costuri detaliate încă. Concentrează-te pe pasul curent.
`;
  }

  if (screen === 'editor') {
    return `
CONTEXT SPECIAL — FAZA 2: EDITOR 2D (COMPARTIMENTARE)
- Rolul tău este să îl înveți pe utilizator cum să deseneze corect o casă.
- Explică DE CE camerele sunt recomandate așa (orientare cardinală, relații funcționale, suprafețe minime).
- Semnalează greșeli frecvente la compartimentare (uși suprapuse, lipsă ferestre, garaj în centru) și cum se evită.
- NU aduce în discuție Certificatul de Urbanism, PUG sau structura solului decât dacă ești întrebat direct, deoarece aceste detalii au fost deja discutate în Faza 1.
`;
  }

  if (screen === 'bom') {
    return `
CONTEXT SPECIAL — FAZA 3: DEVIZ & MATERIALE (BOM)
- Rolul tău este să explici ingineria din spatele costurilor și a materialelor.
- Detaliază cantitățile de materiale: de ce este nevoie de anumită clasă de beton sau fier-beton pe baza zonei seismice.
- Oferă sfaturi de eficientizare a bugetului.
- NU vorbi despre compartimentarea camerelor sau reguli de urbanism, ești la etapa de bugetare și execuție.
`;
  }

  if (screen === 'energy') {
    return `
CONTEXT SPECIAL — EFICIENȚĂ ENERGETICĂ
- Rolul tău este să explici clasa energetică, izolația și consumul energetic al construcției.
`;
  }

  if (screen === 'market') {
    return `
CONTEXT SPECIAL — ANALIZĂ PIAȚĂ CONSTRUCȚII
- Ești Zidario în rolul de Analist Financiar specializat pe piața construcțiilor din România.
- Ai acces la date reale INSSE CNS107D (2005–2026) și la buletinele de cost statistice.
- Răspunde la întrebări despre: momentul optim de construire, evoluția inflației în materiale,
  impactul energiei și manoperei, comparații istorice (criză 2008, șoc energetic 2022), prognoze 2027-2028.
- Citează datele concrete din contextul furnizat (indici, procente, ani) — nu inventa cifre.
- NU discuta despre normative tehnice de structură, fundații sau autorizații în acest ecran.
- Explică conceptele financiare simplu, pentru un utilizator fără pregătire economică.
`;
  }

  return '';
}

export function buildOffTopicRefusalStream() {
  async function* refusalStream() {
    yield { text: 'Această întrebare nu pare legată de construcția sau amenajarea casei tale. ' };
    yield { text: 'Sunt specializat pe tot ce ține de casa ta: plan, camere, materiale, normative, costuri, autorizații, instalații, finisaje.' };
    yield { text: '\n\nCe te interesează legat de proiectul tău?' };
  }

  return refusalStream();
}

export function buildChatPrompt(input: ChatPromptInput): string {
  const historyStr = input.conversationHistory && input.conversationHistory.length > 0
    ? 'ISTORIC CONVERSAȚIE:\n' +
      input.conversationHistory
        .slice(-10)
        .map(msg => `[${msg.role === 'user' ? 'Utilizator' : 'Zidario'}]: ${msg.text}`)
        .join('\n') +
      '\n\n'
    : '';

  const historySummaryBlock = input.historySummary
    ? `=== CONTEXT PROIECT (din conversații anterioare) ===\n${input.historySummary}\n`
    : '';

  const screenSpecificBlock = buildScreenSpecificBlock(input.screenContext ?? 'screen1');
  const label = agentLabel(input.activeAgents);

  return `Ești Zidario, asistent tehnic AI și mentor educațional în construcții.
ROLUL TĂU STRICT: Utilizatorul tocmai a interacționat cu tine pe ecranul curent. Fii un Inginer Structurist și Arhitect Senior profesionist care îndrumă pas cu pas.
1. Analizează răspunsul utilizatorului. Confirmă și completează răspunsul.
2. EXPLICĂ DIRECT, CLAR și LA OBIECT doar implicațiile tehnice specifice ecranului curent (vezi CONTEXT SPECIAL).
3. FII CONCIS. Nu oferi informații nesolicitate despre PUG sau teren dacă te afli în Editorul 2D sau BOM, păstrează focusul pe faza curentă.
4. CRITIC: NU îi mai adresa sub nicio formă alte întrebări de verificare. După explicația clară, spune-i pur și simplu cum să continue munca pe ecranul curent.

Domenii active pentru această întrebare: **${label}**
${input.statusDisclaimer}
${historySummaryBlock}
CONTEXT CURENT UTILIZATOR (date preluate automat de pe ecran):
${input.contextString}

${screenSpecificBlock}


REGLEMENTĂRI RELEVANTE DIN NORMATIVE (RAG — Hybrid Search):
${input.ragContext}


${historyStr}ÎNTREBARE UTILIZATOR:
"${input.userQuestion}"

Răspunde profesional, dar FOARTE EXPLICIT pentru un începător. Dacă folosești termeni tehnici, coeficienți sau menționezi normative, EXPLICĂ-I PE ÎNȚELESUL TUTUROR (ex: ce înseamnă acel coeficient în practică). Explici DE CE înainte de CE.
Citează sursele exacte când menționezi normative (ex: Conform NP 112-2014, Art. 5.2), dar tradu regula în limbaj accesibil.
Folosește limbaj simplu, prietenos, paragrafe scurte. Markdown: doar bold și liste. NU pune întrebări suplimentare de verificare!`;
}
