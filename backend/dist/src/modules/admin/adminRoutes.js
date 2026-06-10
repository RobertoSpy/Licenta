"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const adminController_1 = require("./adminController");
const authMiddleware_1 = require("../../core/middleware/authMiddleware");
const requireAdmin_1 = require("../../core/middleware/requireAdmin");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ dest: 'uploads/' });
// Toate rutele de aici necesită autentificare
router.use(authMiddleware_1.protect);
// Rute accesibile pentru orice utilizator logat
router.post('/scrape/add', adminController_1.addMaterialFromUrl);
// Toate rutele de aici în jos necesită rol de admin
router.use(requireAdmin_1.requireAdmin);
router.get('/users', adminController_1.getUsers);
router.get('/materials', adminController_1.getAllMaterials);
router.post('/materials/manual', adminController_1.addMaterialManual);
router.post('/materials/import-csv', upload.single('csvFile'), adminController_1.importMaterialsCsv);
router.put('/materials/:id', adminController_1.updateMaterial);
router.delete('/materials/:id', adminController_1.deleteMaterial);
router.post('/scrape/sync', adminController_1.syncDedemanMaterials);
router.post('/normatives/reseed', adminController_1.reseedNormatives);
exports.default = router;
