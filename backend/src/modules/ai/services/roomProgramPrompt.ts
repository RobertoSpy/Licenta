import conformityRules from '../../../data/conformity-rules.json';
import roomTaxonomy from '../../../data/room-taxonomy.json';
import budgetRules from '../../../data/budget-rules.json';
import type { RoomSuggestion, SuggestRoomsInput, SuggestedRoom } from '../../../core/types/roomSuggestion';
import { normalizeLabel } from '../../../core/services/layout/layoutUtils';

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

  const budgetRuleText = (budgetRules as any)[input.budgetCategory] || (budgetRules as any).mediu;

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

RESTRICȚII MINIME LEGALE:
Te rugăm să respecți cu strictețe următoarele suprafețe minime pentru a nu genera un plan ilegal:
${(conformityRules as any).room_min_sqm.map((r: any) => `- ${r.targets.join('/')}: minim ${r.min_sqm} mp`).join('\n')}

REGULI STRICTE DE BUGET (${input.budgetCategory.toUpperCase()}):
${budgetRuleText}

RĂSPUNDE DOAR CU JSON. ESTE STRICT OBLIGATORIU SĂ INCLUZI TOATE CÂMPURILE PENTRU FIECARE CAMERĂ (dacă nu ai o valoare, folosește null sau []):
{
  "rooms": [
    {
      "type": "TIP_CAMERA_AICI",
      "label": "Nume Afișat",
      "weightRatio": 2.5,
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

Tipuri de bază recunoscute: ${roomTaxonomy.valid_types.join(', ')}
Poți adăuga și alte tipuri funcționale specifice stilului arhitectural ales (ex: dressing, sala_sport, spalatorie, wine_cellar, home_cinema si altele) dacă sunt justificate de stilul ${input.houseStyle} și bugetul ${input.budgetCategory}.
Orice tip nou trebuie să aibă zona validă din: ${roomTaxonomy.valid_zones.join(', ')}
Floor valide: ${roomTaxonomy.valid_floors.join(', ')}
weightRatio: 0.5 (mic) → 4.0 (mare) — proporția relativă față de celelalte camere`;
}


export function validateRoomSuggestion(parsed: RoomSuggestion, targetArea: number): RoomSuggestion {
  if (!parsed.rooms || !Array.isArray(parsed.rooms) || parsed.rooms.length === 0) {
    throw new Error('JSON invalid: câmpul "rooms" lipsește sau e gol.');
  }

  if (parsed.totalEstimatedSqm < targetArea * 0.75) {
    throw new Error(`Validare eșuată: AI a generat doar ${parsed.totalEstimatedSqm}mp din ${targetArea}mp ceruți.`);
  }

  for (const room of parsed.rooms as SuggestedRoom[]) {
    // 1. Clampare weightRatio
    room.weightRatio = Math.min(Math.max(room.weightRatio ?? 1, 0.5), 4.0);

    // 2. Validare open-world: Nu mai suprascriem tipul dacă e o cameră nouă
    // Verificăm doar ca zona funcțională să fie corectă, indiferent de tip.
    if (!roomTaxonomy.valid_zones.includes(room.zone as any)) {
      room.zone = 'zi'; // fallback safe doar pentru zonă
    }

    // 4. Validare minim legal
    const rule = (conformityRules as any).room_min_sqm.find((r: any) => r.targets.includes(normalizeLabel(room.type)));
    if (rule && (room.minSqm === null || room.minSqm < rule.min_sqm)) {
      room.minSqm = rule.min_sqm;
    }
  }

  return parsed;
}
