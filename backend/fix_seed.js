const fs = require('fs');
const file = 'c:/Users/Roberto/OneDrive/Desktop/Licenta/backend/src/scripts/seedBaselineMaterials.ts';
let content = fs.readFileSync(file, 'utf8');

// Replace known bad sequences
content = content.replace(/FundaE>ie/g, 'Fundație');
content = content.replace(/HidroizolaE>ie/g, 'Hidroizolație');
content = content.replace(/PereE>i exteriori/g, 'Pereți exteriori');
content = content.replace(/PereE>i interiori/g, 'Pereți interiori');
content = content.replace(/TermoizolaE>ie/g, 'Termoizolație');
content = content.replace(/AcoperiE>/g, 'Acoperiș');
content = content.replace(/Eseav[a-z]/g, 'Țeavă');
content = content.replace(/Alimentare ap/g, 'Alimentare apă');
content = content.replace(/TAmplArie/g, 'Tâmplărie');
content = content.replace(/TAmplrie/g, 'Tâmplărie');
content = content.replace(/ap/g, 'apă');
content = content.replace(/faE>ad/g, 'fațadă');
content = content.replace(/faE>ade/g, 'fațade');
content = content.replace(/A~/g, 'Ø');
content = content.replace(/E>i/g, 'ți');
content = content.replace(/E>e/g, 'țe');
content = content.replace(/UETi exterior/g, 'Uși exterior');
content = content.replace(/UETi interior/g, 'Uși interior');
content = content.replace(/UET exterior/g, 'Ușă exterior');
content = content.replace(/UET metalic/g, 'Ușă metalică');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed seedBaselineMaterials.ts');
