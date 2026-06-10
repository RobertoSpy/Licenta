"use strict";
// backend/src/services/contextMultiplierEngine.ts
//
// MODUL PUR DETERMINIST — zero side effects, zero apeluri externe.
// Calculează multiplicatorii contextuali injectați în formulele BOM.
//
// SURSĂ NORMATIVĂ pentru multiplicatorii seismici:
//   • P100-1/2013 Cap.8: cerințe ductilitate DCM/DCH per zonă seismică ag.
//     – DCM (ductilitate medie): 0.10g ≤ ag < 0.25g
//     – DCH (ductilitate înaltă): ag ≥ 0.25g
//   • NE012-1:2022 Cap.5, Tab.5.2: dozaje minime armătură (ρmin) per clasă DCM/DCH.
//     – DCH impune ρmin cu 30–60% mai mare față de DCM.
//   • GT 063-2013 „Ghid privind detalierea armăturilor în structuri de beton armat":
//     procente armătură recomandate per nivel seismic.
//   • Practică inginerească: devize reale din zone cu ag 0.10g vs 0.35g confirmă
//     surplus de 15–60% la cantitățile de armătură și ancoraje.
//
// IMPORTANT: Multiplicatorii sunt ESTIMĂRI ORIENTATIVE pentru devizare.
//   Armătura exactă se determină prin calcul structural detaliat (RDS/ETABS/SAFE).
//   Sursa: P100-1/2013 Art. 4.4.2 + NE012-1:2022 Tab. 5.2 + practică devizare.
//
// SURSĂ NORMATIVĂ pentru multiplicatorii de sol:
//   • NP112-2014 Cap.4: presiunea convențională de calcul pconv per tip sol.
//     – Argilă/loess pconvenienta < 150 kPa → fundație mai lată (mai mult beton).
//     – Stâncă/pietriș pconv > 300 kPa → fundație mai îngustă (mai puțin beton).
//   • NP112-2014 Tab.4.1: lățimi recomandate talpă fundație per tip sol și număr etaje.
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildContextMultipliers = buildContextMultipliers;
const SEISMIC_RULES = [
    {
        agMin: 0.35,
        ductilityClass: 'DCH',
        multiplier: 1.60,
        _normSource: 'P100-1/2013 Cap.8, ag≥0.35g → DCH; NE012-1:2022 Tab.5.2 ρmin(DCH) +60% față de static',
    },
    {
        agMin: 0.30,
        ductilityClass: 'DCH',
        multiplier: 1.45,
        _normSource: 'P100-1/2013 Cap.8, ag=0.30g → DCH; NE012-1:2022 Tab.5.2 ρmin(DCH) +45% față de static',
    },
    {
        agMin: 0.25,
        ductilityClass: 'DCH',
        multiplier: 1.30,
        _normSource: 'P100-1/2013 Cap.8, ag=0.25g → DCH limită; NE012-1:2022 Tab.5.2 ρmin(DCH) +30%',
    },
    {
        agMin: 0.20,
        ductilityClass: 'DCM',
        multiplier: 1.15,
        _normSource: 'P100-1/2013 Cap.8, ag=0.20g → DCM; NE012-1:2022 Tab.5.2 ρmin(DCM) +15%',
    },
    {
        agMin: 0.10,
        ductilityClass: 'DCM',
        multiplier: 1.05,
        _normSource: 'P100-1/2013 Cap.8, ag=0.10g → DCM; NE012-1:2022 Tab.5.2 ρmin(DCM) +5% față de static',
    },
    {
        agMin: 0,
        ductilityClass: 'DCL',
        multiplier: 1.00,
        _normSource: 'P100-1/2013 Cap.8, ag<0.10g → DCL; armătură structurală conform NE012-1:2022 minim absolut',
    },
];
const SOIL_RULES = [
    {
        pattern: /argi|lut|loess|loes|plastic|curgator|curgător/i,
        concreteMult: 1.35,
        label: 'Argilă/Loess',
        _normSource: 'NP112-2014 Tab.4.1: pconv<150kPa → talpă mai lată cu ~35%; risc tasare neuniformă',
    },
    {
        pattern: /praf|mlastin|mlaștinos|turb|umpl|umplut|compresibil/i,
        concreteMult: 1.25,
        label: 'Praf/Turbă',
        _normSource: 'NP112-2014 Tab.4.1: pconv<200kPa → talpă mai lată cu ~25%; sol compresibil',
    },
    {
        pattern: /nisip|nisipos/i,
        concreteMult: 1.10,
        label: 'Nisip',
        _normSource: 'NP112-2014 Tab.4.1: pconv~200kPa → talpă cu ~10% mai lată față de sol mediu',
    },
    {
        pattern: /pietri|bolovan|balast|granular/i,
        concreteMult: 1.00,
        label: 'Pietriș/Balast',
        _normSource: 'NP112-2014 Tab.4.1: pconv>300kPa → fundație standard; capacitate portantă bună',
    },
    {
        pattern: /stanc|stânc|roc|granit|calcar|bazalt/i,
        concreteMult: 0.90,
        label: 'Stâncă/Rocă',
        _normSource: 'NP112-2014 Tab.4.1: pconv>600kPa → talpă mai îngustă posibilă; fundație pe rocă',
    },
];
// ─────────────────────────────────────────────────────────────────
// FUNCȚII HELPER
// ─────────────────────────────────────────────────────────────────
function parseAg(seismicZone) {
    if (!seismicZone)
        return 0;
    const match = seismicZone.match(/(\d+\.?\d*)\s*g/i);
    return match ? parseFloat(match[1]) : 0;
}
function getSeismicRule(ag) {
    for (const rule of SEISMIC_RULES) {
        if (ag >= rule.agMin)
            return rule;
    }
    return SEISMIC_RULES[SEISMIC_RULES.length - 1];
}
function getSoilRule(soilType) {
    if (soilType) {
        for (const rule of SOIL_RULES) {
            if (rule.pattern.test(soilType))
                return rule;
        }
    }
    return {
        pattern: /.*/,
        concreteMult: 1.05,
        label: 'Sol mediu (necunoscut)',
        _normSource: 'NP112-2014: sol necunoscut → +5% față de standard (marjă de siguranță)',
    };
}
function calcFoundationWidth(floors, soilMult) {
    const baseWidthM = 0.50 + (floors - 1) * 0.10;
    const raw = baseWidthM * soilMult;
    return Math.round(raw * 20) / 20;
}
function calcConcreteClass(ag, frostDepthCm, soilType) {
    const isWeakSoil = soilType && /argi|nisip|lut/i.test(soilType);
    if (ag >= 0.30 && isWeakSoil) {
        return {
            code: 'STANDARD_BETON_C30_37',
            class: 'C30/37-XF4',
            note: `C30/37 aplicat automat: zonă seismică severă (${ag}g) + sol slab (${soilType})`,
        };
    }
    const needsUpgrade = ag >= 0.25 || frostDepthCm > 90;
    if (needsUpgrade) {
        const reasons = [];
        if (ag >= 0.25)
            reasons.push(`ag=${ag}g ≥ 0.25g`);
        if (frostDepthCm > 90)
            reasons.push(`îngheț ${frostDepthCm}cm > 90cm (XF2)`);
        return {
            code: 'STANDARD_BETON_C25_30',
            class: 'C25/30-XF2',
            note: `C25/30-XF2 aplicat automat: ${reasons.join(' + ')} — NE012-1:2022 Tab.E.1`,
        };
    }
    return {
        code: 'STANDARD_BETON_C20_25',
        class: 'C20/25-XC2',
        note: `C20/25-XC2: ag=${ag}g <0.25g și îngheț ${frostDepthCm}cm ≤90cm — NE012-1:2022 Tab.E.1`,
    };
}
// ─────────────────────────────────────────────────────────────────
// FUNCȚIA PRINCIPALĂ — EXPORT
// ─────────────────────────────────────────────────────────────────
function buildContextMultipliers(input, planMetrics) {
    var _a, _b, _c, _d, _e;
    const ag = parseAg(input.seismicZone);
    const frostDepthCm = (_a = input.frostDepthCm) !== null && _a !== void 0 ? _a : 80;
    const floors = Math.max(1, (_b = input.totalFloors) !== null && _b !== void 0 ? _b : 1);
    const seismicRule = getSeismicRule(ag);
    const soilRule = getSoilRule(input.soilType);
    const foundationWidthM = calcFoundationWidth(floors, soilRule.concreteMult);
    const concreteInfo = calcConcreteClass(ag, frostDepthCm, input.soilType);
    let frostDepthM = Math.max((frostDepthCm + 10) / 100, 0.80);
    if (input.hasBasement) {
        // Dacă avem subsol, adâncimea fundației / săpăturii crește considerabil
        frostDepthM = 2.80; // adâncime tipică subsol rezidențial
    }
    const interiorWallsM = (_c = planMetrics === null || planMetrics === void 0 ? void 0 : planMetrics.interiorWallsM) !== null && _c !== void 0 ? _c : 20 * floors;
    const countWindows = (_d = planMetrics === null || planMetrics === void 0 ? void 0 : planMetrics.countWindows) !== null && _d !== void 0 ? _d : 6 * floors;
    const countExtDoors = (_e = planMetrics === null || planMetrics === void 0 ? void 0 : planMetrics.countExteriorDoors) !== null && _e !== void 0 ? _e : 1;
    const count_corners_and_intersections = Math.round(4
        + Math.floor(interiorWallsM / 4.5)
        + countWindows
        + countExtDoors);
    // LOGICA INTELIGENTĂ MATERIALE
    let exteriorWallCode = 'STANDARD_BCA_25';
    let interiorWallCode = 'STANDARD_BCA_12';
    let insulationExteriorCode = 'polistiren-eps-10cm';
    let insulationRoofCode = 'vata-minerala-15cm';
    let windowsCode = 'STANDARD_FEREASTRA_PVC';
    let rebarCode = 'STANDARD_FIER_12';
    const isColdClimate = frostDepthCm > 90;
    const isHighSeismic = ag >= 0.25;
    const isWeakSoil = input.soilType && /argi|lut|loess|praf|turb|umpl/i.test(input.soilType);
    const isStableSoil = input.soilType && /nisip|pietri|bolovan|balast|stanc|roc/i.test(input.soilType);
    // ZIDĂRIE EXTERIOARĂ
    if (ag >= 0.30) {
        exteriorWallCode = 'CARAMIDA_POROTHERM_38'; // ag mare -> cărămidă groasă
        rebarCode = 'STANDARD_FIER_14'; // extra ductilitate
    }
    else if (ag >= 0.25) {
        exteriorWallCode = 'CARAMIDA_POROTHERM_30';
    }
    else if (ag <= 0.20 && isStableSoil) {
        exteriorWallCode = 'STANDARD_BCA_25';
    }
    else if (isColdClimate) {
        exteriorWallCode = 'BCA_YTONG_30';
    }
    else if (isWeakSoil) {
        exteriorWallCode = 'CARAMIDA_POROTHERM_30';
    }
    // FERESTRE
    const style = (input.houseStyle || '').toLowerCase();
    if (style === 'modern' || style === 'industrial') {
        windowsCode = 'FEREASTRA_ALUMINIU';
    }
    else if (input.energyClass === 'A') {
        windowsCode = 'FEREASTRA_PVC_3K';
    }
    else if (isColdClimate) {
        windowsCode = 'FEREASTRA_PVC_3K';
    }
    // TERMOIZOLAȚIE ACOPERIȘ
    if (isColdClimate) {
        insulationRoofCode = 'VATA_MINERALA_20';
    }
    const materials_note = `Selecții inteligente: PereteExt=${exteriorWallCode}, IzolExt=${insulationExteriorCode}, IzolAcoperis=${insulationRoofCode}, Tâmplărie=${windowsCode}, Armătură=${rebarCode}.`;
    const seismic_note = ag > 0
        ? `seismic_mult=${seismicRule.multiplier} (ag=${ag}g, ${seismicRule.ductilityClass} — ${seismicRule._normSource})`
        : 'seismic_mult=1.0 (ag nedeterminat — fără majorare)';
    const soil_note = `sol_mult=${soilRule.concreteMult} (${soilRule.label} — ${soilRule._normSource})`;
    if (input.hasBasement) {
        concreteInfo.note += ' [SĂPĂTURĂ/FUNDAȚIE ADÂNCĂ pt. SUBSOL (2.8m)]';
    }
    return {
        seismic_multiplier: seismicRule.multiplier,
        soil_concrete_multiplier: soilRule.concreteMult,
        foundation_width_m: foundationWidthM,
        base_rebar_kg_per_mc: 15,
        frost_depth_m: frostDepthM,
        concreteCode: concreteInfo.code,
        concreteClass: concreteInfo.class,
        count_corners_and_intersections,
        exteriorWallCode,
        interiorWallCode,
        insulationExteriorCode,
        insulationRoofCode,
        windowsCode,
        rebarCode,
        seismic_note,
        soil_note,
        concrete_note: concreteInfo.note,
        materials_note,
    };
}
