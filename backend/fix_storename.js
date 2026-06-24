const fs = require('fs');

let content = fs.readFileSync('src/scripts/seedBaselineMaterials.ts', 'utf-8');

// The regex will look for material objects and if they have storeUrl with dedeman and no storeName, inject storeName: 'Dedeman'
content = content.replace(/(storeUrl:\s*'https:\/\/www\.dedeman\.ro[^']+')/g, "storeName: 'Dedeman', $1");

// Clean up if there are double storeNames (if it already had it)
// We will do a smarter parsing

const lines = content.split('\n');
let fixedLines = [];
let inObject = false;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  if (line.includes('storeUrl:') && line.includes('dedeman.ro') && !line.includes('storeName:')) {
    line = line.replace('storeUrl:', "storeName: 'Dedeman', storeUrl:");
  }
  fixedLines.push(line);
}

fs.writeFileSync('src/scripts/seedBaselineMaterials.ts', fixedLines.join('\n'));
console.log('Fixed storeName in seedBaselineMaterials.ts');
