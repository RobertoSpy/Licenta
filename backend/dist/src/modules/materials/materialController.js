"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAlternatives = exports.getAllMaterials = void 0;
const materialRepository_1 = require("./materialRepository");
const getAllMaterials = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const materials = yield materialRepository_1.materialRepository.findAll();
        const payload = materials.map((material) => (Object.assign(Object.assign({}, material), { price: material.pricePerUnit })));
        res.json(payload);
    }
    catch (error) {
        console.error('[MaterialController] Eroare la preluarea materialelor:', error);
        res.status(500).json({ error: 'Eroare la preluarea materialelor' });
    }
});
exports.getAllMaterials = getAllMaterials;
const getAlternatives = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const internalCode = req.params.internalCode;
        const baseMaterial = yield materialRepository_1.materialRepository.findByInternalCodeWithAlternatives(internalCode);
        if (!baseMaterial) {
            res.status(404).json({ error: 'Materialul de bază nu a fost găsit' });
            return;
        }
        res.json(baseMaterial.alternatives || []);
    }
    catch (error) {
        console.error('[MaterialController] Eroare preluare alternative:', error);
        res.status(500).json({ error: 'Eroare la preluarea alternativelor' });
    }
});
exports.getAlternatives = getAlternatives;
