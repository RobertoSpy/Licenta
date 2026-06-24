const fs = require('fs');

let content = fs.readFileSync('src/scripts/seedBaselineMaterials.ts', 'utf-8');

// Fix double storeNames
content = content.replace(/storeName:\s*'Dedeman',\s*storeName:\s*'Dedeman',/g, "storeName: 'Dedeman',");

fs.writeFileSync('src/scripts/seedBaselineMaterials.ts', content);
console.log('Fixed double storeNames');
