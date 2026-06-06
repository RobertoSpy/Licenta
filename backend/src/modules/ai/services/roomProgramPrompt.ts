import conformityRules from '../../../data/conformity-rules.json';
import type { RoomSuggestion, SuggestRoomsInput, SuggestedRoom } from '../../../core/types/roomSuggestion';

export const VALID_ROOM_TYPES = ['hol', 'living', 'bucatarie', 'dormitor', 'baie', 'wc', 'camara', 'birou', 'sala_mese', 'terasa', 'debara'] as const;
export const VALID_ZONES = ['distributie', 'zi', 'noapte', 'tehnic'] as const;
export const VALID_FLOORS = ['parter', 'etaj1'] as const;

export function buildRoomProgramPrompt(params: {
  input: SuggestRoomsInput;
  ragContext: string;

  targetArea: number;
}): string {
  const { input, ragContext, targetArea } = params;

  const floorsDescription = [
    input.hasBasement ? 'subsol' : null,
    'parter',
    ...Array.from({ length: input.totalFloors - 1 }, (_, i) => `etaj${i + 1}`),
  ].filter(Boolean).join(' + ');

  return `Ești Zidario, expert în proiectare rezidențială română.
Recomandă programul funcțional optim pentru o locuință.
Răspunde EXCLUSIV în JSON valid, fără text suplimentar.

DATE PROIECT:
- Suprafață construită totală: ${targetArea} mp (OBLIGATORIU respectat)
- Suma suprafețelor camerelor: între ${Math.round(targetArea * 0.80)}–${Math.round(targetArea * 0.92)} mp
- Structura: ${floorsDescription}
- Număr persoane: ${input.familySize}
- Stil arhitectural: ${input.houseStyle}
- Categorie buget: ${input.budgetCategory}
- Orientare față de stradă: ${input.streetOrientation}

NORMATIVE ÎN VIGOARE (consultă și respectă obligatoriu):
${ragContext}

RESTRICȚII MINIME LEGALE (din Legea 114 / NP057-2002):
Te rugăm să respecți cu strictețe următoarele suprafețe minime pentru a nu genera un plan ilegal:
${(conformityRules as any).room_min_sqm.map((r: any) => `- ${r.targets.join('/')}: minim ${r.min_sqm} mp`).join('\n')}

REGULI STRICTE DE BUGET (${input.budgetCategory.toUpperCase()}):
${input.budgetCategory === 'economic' 
  ? "- Spațiile trebuie să fie EXTREM DE EFICIENTE. Folosește suprafețe individuale FOARTE APROPIATE de minimul legal prevăzut de normativele primite în context.\n- FĂRĂ camere extravagante (fără dressinguri mari, fără multiple băi en-suite, fără birouri uriașe).\n- Dacă ai o suprafață totală permisă mare, mai bine adaugi un dormitor util în plus decât să faci un living disproporționat de uriaș."
  : input.budgetCategory === 'mediu'
  ? "- Balans între eficiență și confort. Depășește minimele legale din context cu 20-30% pentru confort sporit.\n- Permis un birou și un dressing dedicat. Băi decente, compartimentare aerisită."
  : "- Fără restricții de eficiență extremă. Maximizează luxul și spațiul. Living-uri generoase care depășesc considerabil minimul legal, dormitoare matrimoniale cu baie și dressing propriu (en-suite).\n- Poți adăuga spații de relaxare, spălătorie, terase generoase."}

RĂSPUNDE DOAR CU JSON. ESTE STRICT OBLIGATORIU SĂ INCLUZI TOATE CÂMPURILE PENTRU FIECARE CAMERĂ (dacă nu ai o valoare, folosește null sau []):
{
  "rooms": [
    {
      "type": "hol",
      "label": "Hol Intrare",
      "weightRatio": 1.0,
      "zone": "distributie",
      "floor": "parter",
      "isCirculation": true,
      "hasStaircase": false,
      "minSqm": null,
      "maxSqm": null,
      "mustAdjacentTo": [],
      "hasDoorTo": ["living", "bucatarie"],
      "naturalLight": true,
      "orientation": [],
      "reasoning": "explică regula / normativul pe înțelesul unui om non-tehnic, evitând termeni tehnici rigizi, explicând ce este coeficientul respectiv și de ce este important"
    }
  ],
  "totalEstimatedSqm": 900,
  "layoutAdvice": "...",
  "normativeNote": "..."
}

Tipuri valide 'type': ${VALID_ROOM_TYPES.join(', ')}
Zone valide: ${VALID_ZONES.join(', ')}
Floor valide: ${VALID_FLOORS.join(', ')}
weightRatio: 0.5 (mic) → 4.0 (mare)`;
}

function normalizeLabel(label?: string): string {
  return (label ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

export function validateRoomSuggestion(parsed: RoomSuggestion, targetArea: number): RoomSuggestion {
  if (!parsed.rooms || !Array.isArray(parsed.rooms) || parsed.rooms.length === 0) {
    throw new Error('JSON invalid: câmpul "rooms" lipsește sau e gol.');
  }

  if (parsed.totalEstimatedSqm < targetArea * 0.75) {
    throw new Error(`Validare eșuată: AI a generat doar ${parsed.totalEstimatedSqm}mp din ${targetArea}mp ceruți.`);
  }

  for (const room of parsed.rooms as SuggestedRoom[]) {
    const rule = (conformityRules as any).room_min_sqm.find((r: any) => r.targets.includes(normalizeLabel(room.type)));
    if (rule && (room.minSqm === null || room.minSqm < rule.min_sqm)) {
      room.minSqm = rule.min_sqm;
    }
  }

  return parsed;
}
