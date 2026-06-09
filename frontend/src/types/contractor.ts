export const ContractorSpecialization = {
  FUNDATII: 'FUNDATII',
  STRUCTURA: 'STRUCTURA',
  PLANSEU: 'PLANSEU',
  ACOPERIS: 'ACOPERIS',
  TAMPLARIE: 'TAMPLARIE',
  INSTALATII_ELECTRICE: 'INSTALATII_ELECTRICE',
  INSTALATII_SANITARE: 'INSTALATII_SANITARE',
  INSTALATII_TERMICE: 'INSTALATII_TERMICE',
  FINISAJE: 'FINISAJE',
  CONSTRUCTII_GENERALE: 'CONSTRUCTII_GENERALE',
} as const;

export type ContractorSpecialization = typeof ContractorSpecialization[keyof typeof ContractorSpecialization];

export const SPECIALIZATION_LABELS: Record<ContractorSpecialization, string> = {
  [ContractorSpecialization.FUNDATII]: "Fundații",
  [ContractorSpecialization.STRUCTURA]: "Structură & Zidărie",
  [ContractorSpecialization.PLANSEU]: "Planșeu & Coroană",
  [ContractorSpecialization.ACOPERIS]: "Acoperiș & Șarpantă",
  [ContractorSpecialization.TAMPLARIE]: "Tâmplărie",
  [ContractorSpecialization.INSTALATII_ELECTRICE]: "Instalații Electrice",
  [ContractorSpecialization.INSTALATII_SANITARE]: "Instalații Sanitare",
  [ContractorSpecialization.INSTALATII_TERMICE]: "Instalații Termice",
  [ContractorSpecialization.FINISAJE]: "Finisaje",
  [ContractorSpecialization.CONSTRUCTII_GENERALE]: "Construcții Generale",
};
