const fs = require('fs');

let content = fs.readFileSync('src/scripts/seedBaselineMaterials.ts', 'utf-8');

const map = {
  "'EXCAVATION'": "'Săpătură și Terasamente'",
  "'Terasamente'": "'Săpătură și Terasamente'",
  "'CONCRETE_C20_25'": "'Beton Fundație'",
  "'CONCRETE_C25_30'": "'Beton Fundație'",
  "'CONCRETE_C30_37'": "'Beton Fundație'",
  "'REBAR_10MM'": "'Oțel Beton Fundație'",
  "'REBAR_12MM'": "'Oțel Beton Fundație'",
  "'REBAR_14MM'": "'Oțel Beton Fundație'",
  "'FOUNDATION_WATERPROOFING'": "'Hidroizolație Fundație'",
  "'FOUNDATION_FORMWORK'": "'Cofraj Fundație'",
  "'EXTERIOR_WALL_25CM'": "'Zidărie BCA'",
  "'EXTERIOR_WALL_30CM'": "'Zidărie BCA'",
  "'EXTERIOR_WALL_BRICK_30CM'": "'Zidărie Cărămidă'",
  "'EXTERIOR_WALL_BRICK_38CM'": "'Zidărie Cărămidă'",
  "'INTERIOR_WALL_12CM'": "'Zidărie BCA'",
  "'Mortar'": "'Mortar Zidărie'",
  "'INSULATION_EPS_10CM'": "'Polistiren (EPS/XPS)'",
  "'INSULATION_MW_15CM'": "'Vată Minerală'",
  "'INSULATION_MW_20CM'": "'Vată Minerală'",
  "'ROOF_CERAMIC'": "'Învelitoare Ceramică'",
  "'ROOF_METAL'": "'Învelitoare Metalică'",
  "'ROOF_WOOD_STRUCTURE'": "'Structură Lemn Acoperiș'",
  "'WINDOW_PVC_STANDARD'": "'Fereastră PVC'",
  "'WINDOW_PVC_TRIPLE'": "'Fereastră PVC'",
  "'WINDOW_ALUMINIUM'": "'Fereastră Aluminiu'",
  "'DOOR_EXTERIOR'": "'Ușă Exterior'",
  "'FLOOR_SCREED'": "'Șapă'",
  "'Tencuială'": "'Tencuială'",
  "'PLASTER_FINISH'": "'Tencuială'",
  "'Pardoseli calde'": "'Parchet'",
  "'Pardoseli reci'": "'Gresie'",
  "'Uși interior'": "'Uși Interior'",
};

for (const [oldVal, newVal] of Object.entries(map)) {
    content = content.replace(new RegExp(`subcategory:\\s*${oldVal}`, 'g'), `subcategory: ${newVal}`);
}

content = content.replace(/category: 'Fundație', subcategory: 'Beton'/g, "category: 'Fundație', subcategory: 'Beton Fundație'");
content = content.replace(/category: 'Structură', subcategory: 'Beton'/g, "category: 'Structură', subcategory: 'Beton Structură'");
content = content.replace(/category: 'Fundație', subcategory: 'Hidroizolație'/g, "category: 'Fundație', subcategory: 'Hidroizolație Fundație'");
content = content.replace(/category: 'Acoperiș', subcategory: 'Hidroizolație'/g, "category: 'Acoperiș', subcategory: 'Hidroizolație Acoperiș'");
content = content.replace(/category: 'Acoperiș', subcategory: 'Structură'/g, "category: 'Acoperiș', subcategory: 'Structură Lemn Acoperiș'");

// Add packagingValue and packagingUnit to type
content = content.replace(/storeUrl\?: string \| null;/g, "storeUrl?: string | null;\n  packagingUnit?: string | null;\n  packagingValue?: number | null;");

fs.writeFileSync('src/scripts/seedBaselineMaterials.ts', content);
console.log('done');
