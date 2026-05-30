export const SCREEN_TUTORIALS: Record<string, { introMessage: string, questionMessage?: string }> = {
  step1: {
    introMessage: "Bună! Sunt Zidario, asistentul tău tehnic pentru construcție. Primul pas este să identificăm terenul tău.\n\nDă click pe hartă sau introdu coordonatele Stereo 70. Zona în care construiești dictează adâncimea de îngheț și cerințele seismice (conform P100-1/2013).",
    // questionMessage is handled dynamically in Step1Location.tsx
  },
  step2: {
    introMessage: "Acum trebuie să înțelegem ce e sub pământ!\n\nTipul de sol determină cât de adâncă și complexă va fi fundația ta (studiul geotehnic este vital aici). Configurează detaliile în formularul din stânga.",
    // questionMessage is handled dynamically in Step2Terrain.tsx
  },
  step3: {
    introMessage: "Înainte să proiectăm casa, trebuie să știm ce îți PERMITE legea să construiești.\n\nCertificatul de Urbanism este primul document oficial pe care trebuie să-l obții. El îți spune retragerile obligatorii față de vecini și regimul maxim de înălțime (ex: P+1 sau P+2).",
    questionMessage: "Ai apucat să soliciți Certificatul de Urbanism de la primăria locală? Știai că PUG-ul local poate fi mai strict decât normativul național pe care ți l-am afișat?",
  },
  step4: {
    introMessage: "Acum vine partea frumoasă — alegem cum va arăta casa ta!\n\nStilul arhitectural și compartimentarea influențează costul total cu 15-30%. De exemplu, o casă Mediteraneană costă diferit față de una Modernă.",
    questionMessage: "Ai configurat regimul de înălțime și stilul! Te pot ajuta să înțelegi ce impact are adăugarea unui etaj sau a unui subsol asupra bugetului tău. Ai înțeles cum îți va afecta alegerile bugetul final?",
  },
  editor2d: {
    introMessage: "Acesta este planul casei tale! Eu am generat o propunere automată, dar poți modifica orice detaliu pe planșă.\n\n**Regula de aur în arhitectură:** Camerele de zi (living, bucătărie) trebuie orientate spre Sud/Sud-Vest pentru a beneficia de lumină naturală, în timp ce dormitoarele sunt mai confortabile pe Nord sau Est.",
    questionMessage: "Vrei să analizăm împreună suprafața utilă a camerelor tale în raport cu Legea Locuinței 114/1996, sau ești sigur de compartimentarea pe care ai ales-o?",
  },
  bom: {
    introMessage: "Bine ai venit la Devizul casei tale! Aici calculăm de ce materiale ai nevoie și cât costă, etapă cu etapă.\n\nO casă se construiește într-o ordine strictă: Fundație → Structură → Planșeu & Coroană → Termoizolație & Hidroizolație → Acoperiș → Tâmplărie → Instalații → Finisaje → Amenajări Exterioare.",
    questionMessage: "Analizăm materialele recomandate pentru prima etapă (Fundația). Ai vreo nelămurire despre motivul pentru care am ales aceste soluții bazate pe zona ta seismică și adâncimea de îngheț?",
  }
};
