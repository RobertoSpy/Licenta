export const ContractorSpecialization = {
  FUNDATII: 'FUNDATII',
  STRUCTURA: 'STRUCTURA',
  PLANSEU: 'PLANSEU',
  ACOPERIS: 'ACOPERIS',
  TAMPLARIE: 'TAMPLARIE',
  INSTALATII_ELECTRICE: 'INSTALATII_ELECTRICE',
  INSTALATII_SANITARE: 'INSTALATII_SANITARE',
  IZOLATII: 'IZOLATII',
  FINISAJE: 'FINISAJE',
  CONSTRUCTII_GENERALE: 'CONSTRUCTII_GENERALE',
} as const;

export type ContractorSpecialization = typeof ContractorSpecialization[keyof typeof ContractorSpecialization];

export const SPECIALIZATION_LABELS: Record<ContractorSpecialization, string> = {
  [ContractorSpecialization.FUNDATII]: "Fundație",
  [ContractorSpecialization.STRUCTURA]: "Structură",
  [ContractorSpecialization.PLANSEU]: "Planșeu",
  [ContractorSpecialization.ACOPERIS]: "Acoperiș",
  [ContractorSpecialization.FINISAJE]: "Finisaje",
  [ContractorSpecialization.TAMPLARIE]: "Tâmplărie",
  [ContractorSpecialization.IZOLATII]: "Termoizolație",
  [ContractorSpecialization.INSTALATII_ELECTRICE]: "Instalații Electrice",
  [ContractorSpecialization.INSTALATII_SANITARE]: "Instalații Sanitare și Termice",
  [ContractorSpecialization.CONSTRUCTII_GENERALE]: "Construcții Generale",
};
