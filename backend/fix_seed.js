const fs = require('fs');

let content = fs.readFileSync('src/scripts/seedBaselineMaterials.ts', 'utf-8');

// Fix Vopsea Lavabilă
content = content.replace(/category:\s*'Finisaje Brute',\s*subcategory:\s*'Vopsea'/g, "category: 'Finisaje Fine', subcategory: 'Vopsea Lavabilă'");

// Fix Instalații Electrice (Category was Instalații Electrice, Subcategory was Cabluri etc)
content = content.replace(/category:\s*'Instalații Electrice',\s*subcategory:\s*'[^']+'/g, "category: 'Instalații', subcategory: 'Instalații Electrice'");

// Fix Instalații Sanitare (Category was Instalații Sanitare, Subcategory was Alimentare apă etc)
content = content.replace(/category:\s*'Instalații Sanitare',\s*subcategory:\s*'[^']+'/g, "category: 'Instalații', subcategory: 'Instalații Sanitare'");

fs.writeFileSync('src/scripts/seedBaselineMaterials.ts', content);
console.log('Fixed seedBaselineMaterials.ts');
