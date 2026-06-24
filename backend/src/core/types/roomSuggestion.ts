// backend/src/core/types/roomSuggestion.ts
//
// Tipuri pentru răspunsul Gemini la suggestRoomProgram.
// Sunt folosite atât în agentOrchestrator.ts cât și în aiController.ts.

export interface SuggestedRoom {
  type: string;                                          // hol | living | bucatarie | dormitor | baie | wc | camara | birou | sala_mese | terasa | debara
  label: string;                                         // Ex: "Dormitor Principal", "Baie 1"
  weightRatio: number;                                   // 0.5 – 4.0 — direct folosit în layoutPartitioner.ts ca ratioValue
  zone: 'distributie' | 'zi' | 'noapte' | 'tehnic';
  floor: 'parter' | 'etaj1';
  reasoning: string;                                     // Motivare scurtă per cameră (citată din normativ)
  minSqm: number;          // minim legal din Legea 114 / NP057
  maxSqm: number;          // limită superioară rezonabilă
  mustAdjacentTo: string[]; // ['hol'] — obligatoriu perete comun
  hasDoorTo: string[];      // ['hol', 'baie'] — unde se pun uși automat
  isCirculation: boolean;   // true = hol/coridor → fără limită uși, alungit
  hasStaircase: boolean;    // true = în această cameră se plasează scara
  naturalLight: boolean;    // true = trebuie fereastră exterioară (NP057)
  orientation: string[];    
}

export interface RoomSuggestion {
  rooms: SuggestedRoom[];
  totalEstimatedSqm: number;
  layoutAdvice: string;    // sfat scurt despre orientare sau organizare
  normativeNote: string;   // baza legală principală
}

export interface SuggestRoomsInput {
  houseAreaSqm: number;
  plotAreaSqm?: number | null;
  houseStyle?: string | null;
  totalFloors: number;
  hasBasement?: boolean | null;
  streetOrientation?: string | null;
  familySize: number;
  budgetCategory: 'economic' | 'mediu';
  /** (Opțional) Destinația finală (ex: "residential") */
  buildingPurpose?: string;
  userRefinementText?: string;
  previousRooms?: SuggestedRoom[];
}
