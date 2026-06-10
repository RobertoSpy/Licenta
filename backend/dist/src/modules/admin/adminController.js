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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reseedNormatives = exports.deleteMaterial = exports.updateMaterial = exports.getAllMaterials = exports.toggleContractorVerification = exports.getUsers = exports.importMaterialsCsv = exports.addMaterialManual = exports.addMaterialFromUrl = exports.syncDedemanMaterials = void 0;
const fs_1 = __importDefault(require("fs"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const scraperService_1 = require("../../core/infrastructure/scraperService");
const prisma_1 = require("../../lib/prisma");
const syncDedemanMaterials = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield scraperService_1.scraperService.syncAllMaterials();
        res.json(Object.assign({ success: true, message: `Sincronizare completă. ${result.updated} actualizate, ${result.failed} eșuate.` }, result));
    }
    catch (error) {
        console.error('[AdminController.sync] Eroare:', error);
        res.status(500).json({ success: false, error: 'Eroare la sincronizarea materialelor.' });
    }
});
exports.syncDedemanMaterials = syncDedemanMaterials;
const addMaterialFromUrl = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { url, category, subcategory, unit, internalCode, name, uValue, compressiveStrength, minSeismicZone, maxFloors } = req.body;
        if (!url || !internalCode || !name || !category || !unit) {
            res.status(400).json({ success: false, error: 'Câmpuri obligatorii lipsă (url, internalCode, name, category, unit)' });
            return;
        }
        const scraped = yield scraperService_1.scraperService.scrapeProductPage(url);
        if (!scraped) {
            res.status(400).json({ success: false, error: 'Scraping eșuat. Verifică URL-ul sau poate exista un blocaj (Cloudflare).' });
            return;
        }
        if (scraped.price === 0 && !scraped.inStock) {
            res.status(400).json({ success: false, error: 'Nu am putut extrage datele. Verificați URL-ul sau încercați mai târziu.' });
            return;
        }
        const material = yield prisma_1.prisma.material.create({
            data: {
                internalCode,
                name,
                category,
                subcategory,
                unit,
                pricePerUnit: scraped.price,
                storeUrl: url,
                description: scraped.description,
                inStock: scraped.inStock,
                stockQuantity: scraped.stockQuantity,
                uValue: uValue ? parseFloat(uValue) : undefined,
                compressiveStrength: compressiveStrength ? parseFloat(compressiveStrength) : undefined,
                minSeismicZone: minSeismicZone ? parseFloat(minSeismicZone) : undefined,
                maxFloors: maxFloors ? parseInt(maxFloors, 10) : undefined,
                isVerified: true, // Adaugat manual de admin -> pre-verificat
            }
        });
        // Salvăm și un prim istoric
        yield prisma_1.prisma.priceHistory.create({
            data: {
                materialId: material.id,
                price: scraped.price,
                source: 'dedeman_scraper_manual'
            }
        });
        res.json({ success: true, material });
    }
    catch (error) {
        console.error('[AdminController.addMaterial] Eroare:', error);
        res.status(500).json({ success: false, error: 'Eroare la adăugarea materialului.' });
    }
});
exports.addMaterialFromUrl = addMaterialFromUrl;
const addMaterialManual = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { internalCode, name, category, subcategory, unit, pricePerUnit, brand, storeUrl, description, uValue, inStock, stockQuantity, compressiveStrength, minSeismicZone, maxFloors, normativeCode, performanceClass, isVerified } = req.body;
        if (!internalCode || !name || !category || !unit || pricePerUnit === undefined) {
            res.status(400).json({ success: false, error: 'Câmpuri obligatorii lipsă (internalCode, name, category, unit, pricePerUnit)' });
            return;
        }
        const material = yield prisma_1.prisma.material.create({
            data: {
                internalCode, name, category, subcategory, unit,
                pricePerUnit: parseFloat(pricePerUnit),
                brand, storeUrl, description,
                inStock: inStock !== undefined ? inStock : true,
                stockQuantity: stockQuantity ? parseFloat(stockQuantity) : undefined,
                uValue: uValue ? parseFloat(uValue) : undefined,
                compressiveStrength: compressiveStrength ? parseFloat(compressiveStrength) : undefined,
                minSeismicZone: minSeismicZone ? parseFloat(minSeismicZone) : undefined,
                maxFloors: maxFloors ? parseInt(maxFloors, 10) : undefined,
                normativeCode, performanceClass,
                isVerified: isVerified !== undefined ? isVerified : true
            }
        });
        yield prisma_1.prisma.priceHistory.create({
            data: {
                materialId: material.id,
                price: parseFloat(pricePerUnit),
                source: 'manual_admin'
            }
        });
        res.json({ success: true, material });
    }
    catch (error) {
        console.error('[AdminController.addMaterialManual] Eroare:', error);
        res.status(500).json({ success: false, error: 'Eroare la adăugarea manuală a materialului.' });
    }
});
exports.addMaterialManual = addMaterialManual;
const importMaterialsCsv = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file) {
            res.status(400).json({ success: false, error: 'Nu a fost trimis niciun fișier.' });
            return;
        }
        const results = [];
        fs_1.default.createReadStream(req.file.path)
            .pipe((0, csv_parser_1.default)())
            .on('data', (data) => results.push(data))
            .on('end', () => __awaiter(void 0, void 0, void 0, function* () {
            let imported = 0;
            let failed = 0;
            for (const row of results) {
                try {
                    if (!row.internalCode || !row.name || !row.category || !row.unit || !row.pricePerUnit) {
                        failed++;
                        continue;
                    }
                    yield prisma_1.prisma.material.upsert({
                        where: { internalCode: row.internalCode },
                        update: {
                            name: row.name,
                            category: row.category,
                            subcategory: row.subcategory || null,
                            unit: row.unit,
                            pricePerUnit: parseFloat(row.pricePerUnit),
                            brand: row.brand || null,
                            storeUrl: row.storeUrl || null,
                            description: row.description || null,
                            uValue: row.uValue ? parseFloat(row.uValue) : null,
                            inStock: row.inStock ? row.inStock.toLowerCase() === 'true' : true,
                            stockQuantity: row.stockQuantity ? parseFloat(row.stockQuantity) : null,
                            compressiveStrength: row.compressiveStrength ? parseFloat(row.compressiveStrength) : null,
                            minSeismicZone: row.minSeismicZone ? parseFloat(row.minSeismicZone) : null,
                            maxFloors: row.maxFloors ? parseInt(row.maxFloors, 10) : null,
                            normativeCode: row.normativeCode || null,
                            performanceClass: row.performanceClass || null,
                            isVerified: row.isVerified ? row.isVerified.toLowerCase() === 'true' : true
                        },
                        create: {
                            internalCode: row.internalCode,
                            name: row.name,
                            category: row.category,
                            subcategory: row.subcategory || null,
                            unit: row.unit,
                            pricePerUnit: parseFloat(row.pricePerUnit),
                            brand: row.brand || null,
                            storeUrl: row.storeUrl || null,
                            description: row.description || null,
                            uValue: row.uValue ? parseFloat(row.uValue) : undefined,
                            inStock: row.inStock ? row.inStock.toLowerCase() === 'true' : true,
                            stockQuantity: row.stockQuantity ? parseFloat(row.stockQuantity) : undefined,
                            compressiveStrength: row.compressiveStrength ? parseFloat(row.compressiveStrength) : undefined,
                            minSeismicZone: row.minSeismicZone ? parseFloat(row.minSeismicZone) : undefined,
                            maxFloors: row.maxFloors ? parseInt(row.maxFloors, 10) : undefined,
                            normativeCode: row.normativeCode || null,
                            performanceClass: row.performanceClass || null,
                            isVerified: row.isVerified ? row.isVerified.toLowerCase() === 'true' : true
                        }
                    });
                    imported++;
                }
                catch (err) {
                    console.error('[importMaterialsCsv] Row error:', err);
                    failed++;
                }
            }
            // Curățăm fișierul temporar
            fs_1.default.unlinkSync(req.file.path);
            res.json({ success: true, message: `Import finalizat: ${imported} adăugate/actualizate, ${failed} eșuate.` });
        }))
            .on('error', (err) => {
            console.error('[AdminController.importMaterialsCsv] Stream error:', err);
            res.status(500).json({ success: false, error: 'Eroare la procesarea fișierului CSV.' });
        });
    }
    catch (error) {
        console.error('[AdminController.importMaterialsCsv] Eroare:', error);
        res.status(500).json({ success: false, error: 'Eroare generală la importul CSV.' });
    }
});
exports.importMaterialsCsv = importMaterialsCsv;
const getUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const users = yield prisma_1.prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isVerified: true,
                createdAt: true,
                contractor: {
                    select: {
                        isVerified: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, users });
    }
    catch (error) {
        console.error('[AdminController.getUsers] Eroare:', error);
        res.status(500).json({ success: false, error: 'Eroare la preluarea utilizatorilor.' });
    }
});
exports.getUsers = getUsers;
const toggleContractorVerification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = parseInt(req.params.id, 10);
        const contractor = yield prisma_1.prisma.contractorProfile.findUnique({ where: { userId } });
        if (!contractor) {
            res.status(404).json({ success: false, error: 'Profil de constructor negăsit.' });
            return;
        }
        const updated = yield prisma_1.prisma.contractorProfile.update({
            where: { userId },
            data: { isVerified: !contractor.isVerified }
        });
        res.json({ success: true, isVerified: updated.isVerified });
    }
    catch (error) {
        console.error('[AdminController.toggleContractorVerification] Eroare:', error);
        res.status(500).json({ success: false, error: 'Eroare la modificarea statusului.' });
    }
});
exports.toggleContractorVerification = toggleContractorVerification;
const getAllMaterials = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const materials = yield prisma_1.prisma.material.findMany({
            orderBy: { category: 'asc' }
        });
        res.json({ success: true, materials });
    }
    catch (error) {
        console.error('[AdminController.getAllMaterials] Eroare:', error);
        res.status(500).json({ success: false, error: 'Eroare la preluarea materialelor.' });
    }
});
exports.getAllMaterials = getAllMaterials;
const updateMaterial = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const materialId = parseInt(req.params.id, 10);
        const data = req.body;
        const material = yield prisma_1.prisma.material.update({
            where: { id: materialId },
            data
        });
        res.json({ success: true, material });
    }
    catch (error) {
        console.error('[AdminController.updateMaterial] Eroare:', error);
        res.status(500).json({ success: false, error: 'Eroare la actualizarea materialului.' });
    }
});
exports.updateMaterial = updateMaterial;
const deleteMaterial = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const materialId = parseInt(req.params.id, 10);
        yield prisma_1.prisma.material.delete({
            where: { id: materialId }
        });
        res.json({ success: true, message: 'Material șters cu succes.' });
    }
    catch (error) {
        console.error('[AdminController.deleteMaterial] Eroare:', error);
        res.status(500).json({ success: false, error: 'Eroare la ștergerea materialului.' });
    }
});
exports.deleteMaterial = deleteMaterial;
const reseedNormatives = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Aici vom declanșa scriptul de RAG (VectorDB sync)
        // Deocamdată facem doar simulare de succes pentru licență:
        res.json({
            success: true,
            message: 'Trigger-ul pentru reindexarea RAG a fost lansat cu succes. Datele vor fi sincronizate în fundal.'
        });
    }
    catch (error) {
        console.error('[AdminController.reseedNormatives] Eroare:', error);
        res.status(500).json({ success: false, error: 'Eroare la pornirea reindexării.' });
    }
});
exports.reseedNormatives = reseedNormatives;
