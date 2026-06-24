const fs = require('fs');

let formulas = JSON.parse(fs.readFileSync('src/data/bom-formulas.json', 'utf-8'));

const map = {
  "Terasamente": "Săpătură și Terasamente",
  "FOUNDATION_FORMWORK": "Cofraj Fundație",
  "EXTERIOR_WALL_25CM": "Zidărie BCA",
  "EXTERIOR_WALL_BRICK_30CM": "Zidărie Cărămidă",
  "EXTERIOR_WALL_BRICK_38CM": "Zidărie Cărămidă",
  "INTERIOR_WALL_12CM": "Zidărie BCA",
  "Pereți exteriori": "Zidărie BCA",
  "Pereți interiori": "Zidărie BCA",
  "Învelitoare": "Învelitoare Metalică",
  "Structură": "Structură Lemn Acoperiș",
  "FLOOR_SCREED": "Șapă",
  "Uși exterior": "Ușă Exterior",
  "Uși interior": "Uși Interior",
  "Ferestre": "Fereastră PVC",
  "WINDOW_PVC_STANDARD": "Fereastră PVC",
  "WINDOW_PVC_TRIPLE": "Fereastră PVC",
  "WINDOW_ALUMINIUM": "Fereastră Aluminiu",
  "INSULATION_EPS_10CM": "Polistiren (EPS/XPS)",
  "Acoperiș": "Vată Minerală",
  "INSULATION_MW_15CM": "Vată Minerală",
  "INSULATION_MW_20CM": "Vată Minerală",
  "Hidroizolație": "Hidroizolație Fundație",
  "Mortar": "Mortar Zidărie",
  "ADHESIVE_MASONRY": "Mortar Zidărie",
  "Sistem pluvial": "Învelitoare Metalică",
  "ETICS": "Polistiren (EPS/XPS)",
  "Glet": "Glet",
  "Vopsea": "Vopsea Lavabilă",
  "Cabluri": "Instalații Electrice",
  "Protecție": "Instalații Electrice",
  "Alimentare apă": "Instalații Sanitare",
  "Canalizare": "Instalații Sanitare",
  "Tencuială": "Tencuială"
};

for (const key in formulas) {
  if (key === '_meta') continue;
  
  if (formulas[key].materialQuery && formulas[key].materialQuery.subcategory) {
    let old = formulas[key].materialQuery.subcategory;
    if (key === 'roof_underlay') formulas[key].materialQuery.subcategory = 'Hidroizolație Acoperiș';
    else if (map[old]) formulas[key].materialQuery.subcategory = map[old];
  }
  
  if (formulas[key].defaultRoleCode && map[formulas[key].defaultRoleCode]) {
    formulas[key].defaultRoleCode = map[formulas[key].defaultRoleCode];
  }

  if (formulas[key].upgrades) {
    formulas[key].upgrades.forEach(u => {
      if (map[u.roleCode]) u.roleCode = map[u.roleCode];
    });
  }
}

fs.writeFileSync('src/data/bom-formulas.json', JSON.stringify(formulas, null, 2));
console.log('Fixed bom-formulas.json');
