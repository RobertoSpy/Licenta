import conformityRules from '../../../data/conformity-rules.json';
import roomTaxonomy from '../../../data/room-taxonomy.json';
import budgetRules from '../../../data/budget-rules.json';
import type { RoomSuggestion, SuggestRoomsInput, SuggestedRoom } from '../../../core/types/roomSuggestion';
import { normalizeLabel } from '../../../core/services/layout/layoutUtils';
import { findRoomMinRule } from '../../../core/services/conformityLookup';

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

  // Calcul estimativ matematic pentru spațiul util
  // Presupunem pereți exteriori de 30cm (0.3m) și o formă aproximativ pătrată pentru a găsi latura
  const side = Math.sqrt(targetArea);
  const innerSide = Math.max(0, side - 0.6); // 2 * 0.3m (pereți exteriori)
  const roughInnerArea = innerSide * innerSide;
  // Scădem aproximativ 10% pentru amprenta pereților interiori (15cm grosime)
  const targetUsableArea = Math.round(roughInnerArea * 0.90);

  const budgetRuleText = (budgetRules as any)[input.budgetCategory] || (budgetRules as any).mediu;

  return `Ești Zidario, expert în proiectare rezidențială română.
Recomandă programul funcțional optim pentru o locuință.
Răspunde EXCLUSIV în JSON valid, fără text suplimentar.

DATE PROIECT:
- Suprafață construită totală (țintă absolută): ${targetArea} mp (OBLIGATORIU de respectat cu strictețe în totalEstimatedSqm)
- Suma suprafețelor camerelor (util): trebuie să fie fix ${targetUsableArea} mp (valoare calculată deja matematic pe baza grosimii pereților de 30cm exterior și 15cm interior). Împarte acești ${targetUsableArea} mp între camere.
- Structura: ${floorsDescription}
- Număr persoane: ${input.familySize}
- Stil arhitectural: ${input.houseStyle || 'nespecificat'}
- Categorie buget: ${input.budgetCategory}
- Orientare față de stradă: ${input.streetOrientation || 'nespecificat'}

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
  "totalEstimatedSqm": ${targetArea},
  "layoutAdvice": "...",
  "normativeNote": "..."
}

Tipuri de bază recunoscute: ${roomTaxonomy.valid_types.join(', ')}
Poți adăuga și alte tipuri funcționale specifice stilului arhitectural ales (ex: dressing, sala_sport, spalatorie, wine_cellar, home_cinema si altele) dacă sunt justificate de profilul clientului și bugetul ${input.budgetCategory}.
Orice tip nou trebuie să aibă zona validă din: ${roomTaxonomy.valid_zones.join(', ')}
Floor valide: ${roomTaxonomy.valid_floors.join(', ')}
weightRatio: 0.5 (mic) → 4.0 (mare) — proporția relativă față de celelalte camere

${input.userRefinementText && input.previousRooms ? `
CONTEXT PROIECT ANTERIOR:
${JSON.stringify(input.previousRooms, null, 2)}

CERINȚĂ DE CORECȚIE DE LA UTILIZATOR:
"${input.userRefinementText}"

CONSTRÂNGERI ABSOLUTE (GĂRZI DE CORP):
1. Trebuie să respecți în continuare Categoria de Buget, Suprafața Totală și Numărul de Persoane.
2. Ești OBLIGAT să verifici ca cerințele utilizatorului să NU încalce taxonomia ("valid_types", "valid_zones") și regulile de conformitate.
3. Dacă utilizatorul cere ceva ilegal (ex: "Vreau un dormitor de 5 mp" sau "Vreau o baie open-space în mijlocul livingului"), IGNORĂ acea parte a cererii, păstrează dimensiunile legale din "conformity-rules.json" și explică-i politicos în câmpul "normativeNote" de ce nu i-ai putut îndeplini acea dorință (ex: "Conform Legii 114/1996, suprafața minimă...").
` : ''}

ATENȚIE MAJORĂ:
- Câmpul "totalEstimatedSqm" din JSON-ul tău TREBUIE SĂ FIE EXACT ${targetArea}. Nu genera o altă valoare!
- Pentru camera cu tipul "hol" (sau "hol_intrare") care deservește intrarea, EȘTI OBLIGAT să incluzi mereu o orientare validă în array-ul "orientation" care să coincidă cu orientarea străzii (${input.streetOrientation}). NU lăsa array-ul "orientation" gol pentru Holul de Intrare!`;
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
    const rule = findRoomMinRule(room.type, room.label);
    if (rule && (room.minSqm === null || room.minSqm < rule.min_sqm)) {
      room.minSqm = rule.min_sqm;
    }
  }

  return parsed;
}
