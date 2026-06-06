/**
 * WIZARD_MESSAGES — Mesaje predefinite Zidario per ecran.
 * 
 * Acestea sunt afișate INSTANT la deschiderea chat-ului, fără apel backend.
 * Zero cost API, zero latență. Mesajele sunt educaționale și ghidează
 * utilizatorul prin fiecare pas al wizard-ului.
 */

export interface WizardLink {
  label: string;
  url: string;
}

export interface WizardMessage {
  text: string;
  links?: WizardLink[];
}

export const WIZARD_MESSAGES: Record<string, WizardMessage> = {
  screen1: {
    text: `Bună ziua! Sunt **Zidario**, asistentul tău tehnic pentru construcții.\n\nPrimul pas este să localizăm terenul tău. Dacă ai coordonatele exacte din planul de amplasament (Stereo 70), le poți introduce direct. Dacă nu, caută localitate în modul Manual.\n\nDe ce contează locația?\n• Fiecare județ are o **zonă seismică** diferită conform P100-1/2013\n• Adâncimea minimă de fundare variază pe județ conform NP112-2014\n• Le calculez automat pe baza locației selectate.`,
    links: []
  },

  screen2: {
    text: `Acum identificăm **tipul de sol** al terenului tău.\n\n🟤 **Argilos** — se umflă la umezeală, necesită fundație mai adâncă și eventual dren\n🟡 **Nisipos** — drenaj bun, dar instabil la încărcări mari\n⚫ **Pietros** — portanță bună, ideal pentru fundații directe\n🔵 **Stâncos** — cel mai bun, dar necesită echipamente speciale la săpare\n❓ **Necunoscut** — recomand studiu geotehnic înainte de proiectare\n\nNu știi sigur ce tip de sol ai? Descrie-mi cum arată pământul (culoare, consistență, cum se comportă la ploaie) și te ajut să îl identifici.`,
    links: [
      { label: 'Cum recunosc tipul de sol?', url: 'https://www.utcb.ro/geotehnica' },
      { label: 'Ce este un studiu geotehnic?', url: 'https://inspectiadestat.ro' }
    ]
  },

  screen3: {
    text: `Pe baza locației și solului tău, calculez acum **reglementările aplicabile**.\n\nAceste date vin direct din normativele românești — nu sunt estimări:\n• **Numărul maxim de etaje** permis pe zona seismică\n• **Adâncimea minimă a fundației** conform NP112-2014\n• **Restricțiile de zonare** din PUG local\n\nDacă ai nelămuriri despre o reglementare specifică, întreabă-mă și îți explic articolul exact din normativ.`,
    links: []
  },

  screen4: {
    text: `Alege **stilul arhitectural** al casei tale.\n\nStilul influențează costul finisajelor și complexitatea șarpantei, dar **nu afectează rezistența structurală** — aceasta este determinată de zona seismică și tipul de sol.\n\n💡 **Sfat:** Subsolul adaugă aprox. 30% la costul structurii.\n\nAi întrebări despre diferențele de cost între stiluri sau configurații? Scrie-mi mai jos.`,
    links: [
      { label: 'Case moderne — exemple reale', url: 'https://www.archdaily.com/tag/residential' },
      { label: 'Case clasice românești', url: 'https://igloo.ro' }
    ]
  },

  // Mesaje pentru Faza 2+ (pregătite anticipat)
  editor: {
    text: `Editorul 2D este activ. Pot verifica planul tău față de:\n• **Legea 114/1996** — suprafețe minime camere\n• **CR6-2013** — reguli structuri zidărie\n• **Regulamentul urbanistic local** — distanțe față de vecini și stradă\n\nDraw planul și întreabă-mă dacă respectă normativele.`,
    links: []
  },

  bom: {
    text: `Generez **devizul estimativ** pe baza configurației casei tale.\n\nCosturile se bazează pe:\n• **P91-INCERC** — coeficienți orientativi per mc construcție\n• **Zone climatice** — influențează costul izolației\n• **Tipul structurii** — beton armat vs. zidărie portantă\n\nAcestea sunt estimări. Un deviz definitiv necesită proiect tehnic complet.`,
    links: []
  }
};
