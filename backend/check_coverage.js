const fs = require('fs');

const formulas = JSON.parse(fs.readFileSync('src/data/bom-formulas.json', 'utf8'));
const seedContent = fs.readFileSync('src/scripts/seedBaselineMaterials.ts', 'utf8');

const requiredSubcategories = new Set();
for (const key in formulas) {
  if (key === '_meta') continue;
  const f = formulas[key];
  if (f.materialQuery && f.materialQuery.subcategory) {
    requiredSubcategories.add(f.materialQuery.subcategory);
  }
}

// Manually add the structural upgrades if any
requiredSubcategories.add('Zidărie Cărămidă');

console.log('--- REQUIRED SUBCATEGORIES IN BOM ---');
Array.from(requiredSubcategories).forEach(s => console.log(s));

const missing = [];
const counts = {};

Array.from(requiredSubcategories).forEach(subcat => {
  // Simple regex to count occurrences of `subcategory: '...'`
  // Because it might be formatted differently, we will just search for the string
  const regex = new RegExp(`subcategory:\\s*['"]${subcat}['"]`, 'g');
  const matches = seedContent.match(regex);
  counts[subcat] = matches ? matches.length : 0;
  if (!matches) {
    missing.push(subcat);
  }
});

console.log('\n--- COVERAGE IN SEED ---');
for (const [subcat, count] of Object.entries(counts)) {
  console.log(`${subcat}: ${count} material(e) găsit(e)`);
}

if (missing.length > 0) {
  console.log('\n[!] LIPSEȘTE COMPLET DIN SEED:');
  missing.forEach(m => console.log('- ' + m));
} else {
  console.log('\n[V] Toate subcategoriile din BOM sunt acoperite în seed!');
}
