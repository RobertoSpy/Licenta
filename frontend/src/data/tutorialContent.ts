export const SCREEN_TUTORIALS: Record<string, { introMessage: string, questionMessage?: string }> = {
  step1: {
    introMessage: "Bună! Sunt Zidario, asistentul tău tehnic pentru construcție. Primul pas este să identificăm terenul tău.\n\nDă click pe hartă sau introdu coordonatele Stereo 70. Zona în care construiești dictează adâncimea de îngheț și cerințele seismice (conform P100-1/2013).\n\nCând locația este setată corect, scrie **„Gata”** în chat pentru a valida și a debloca pasul următor.",
  },
  step2: {
    introMessage: "Acum trebuie să înțelegem terenul tău! Nu îți face griji dacă nu ești expert — te ghidez eu pas cu pas.\n\n**Tipul de sol** — cel mai simplu test: ia un pumn de pământ din grădină și udă-l puțin.\n• Se lipește și se modelează ca plastilina? → Argilos\n• Se sfărâmă și nu se lipește? → Nisipos\n• Dai de pietriș sau piatră la câțiva centimetri? → Pietros\n• Nu ești sigur? Bifează Necunoscut — vom aplica un calcul de siguranță.\n\n**Panta terenului** — măsoară-o simplu: pune o scândură dreaptă de 1 metru pe teren. Ridică capătul mai jos până e perfect orizontal (folosește o nivelă sau aplicația „Nivel” de pe telefon). Distanța de la capătul ridicat până la pământ, în centimetri, este panta ta procentuală.\n• 0–5 cm → pantă mică, teren practic plat\n• 5–15 cm → pantă medie, vor fi necesare unele nivelări\n• peste 15 cm → pantă mare, fundația va fi în trepte\n\n**Orientarea față de stradă** — deschide busola de pe telefon și îndreaptă-te spre stradă. Unghiul afișat îți spune orientarea. Sau mai simplu: observă unde răsare soarele dimineața față de parcelă.\n• Soarele răsare în fața parcelei? → Est\n• Soarele apune în fața parcelei? → Vest\n• Soarele e la amiază în fața parcelei? → Sud (ideal pentru camere de zi)\n\n**Observații** — notează orice ai observat: dacă după ploaie apa stagnează pe teren, dacă există copaci mari cu rădăcini adânci, dacă terenul a fost folosit ca groapă de gunoi sau umplutură. Orice detaliu contează pentru siguranța fundației.\n\nCând ai completat toate datele, scrie **„Gata”** în chat pentru a le valida și a debloca următorul pas.",
  },
  step4: {
    introMessage: "Acum vine partea frumoasă — alegem cum va arăta casa ta!\n\nStilul arhitectural și compartimentarea influențează costul total cu 15-30%. De exemplu, o casă Mediteraneană costă diferit față de una Modernă.\n\nCând ai terminat de configurat, scrie **„Gata”** în chat pentru a primi o scurtă analiză a deciziilor tale și a debloca pasul următor.",
  },
  editor2d: {
    introMessage: "Acesta este planul casei tale! Eu am generat o propunere automată, dar poți modifica orice detaliu pe planșă.\n\n**Regula de aur în arhitectură:** Camerele de zi (living, bucătărie) trebuie orientate spre Sud/Sud-Vest pentru a beneficia de lumină naturală, în timp ce dormitoarele sunt mai confortabile pe Nord sau Est.\n\nCând ești mulțumit de compartimentare, scrie **„Gata”** în chat.",
  },
  bom: {
    introMessage: "Bine ai venit la Devizul casei tale! Aici calculăm de ce materiale ai nevoie și cât costă, etapă cu etapă.\n\nO casă se construiește într-o ordine strictă: Fundație → Structură → Planșeu & Coroană → Termoizolație & Hidroizolație → Acoperiș → Tâmplărie → Instalații → Finisaje → Amenajări Exterioare.\n\nCând vrei să discutăm despre o anumită etapă, scrie-mi un mesaj!",
  }
};
