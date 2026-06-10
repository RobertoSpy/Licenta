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
exports.analyzeLocation = void 0;
const terrainService_1 = require("./terrainService");
const analyzeLocation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield terrainService_1.terrainService.analyzeLocation(req.body);
        return res.status(200).json({ status: 'success', data: result });
    }
    catch (error) {
        if ((error === null || error === void 0 ? void 0 : error.message) && error.message.includes('Unable to determine county')) {
            return res.status(400).json({ status: 'error', message: error.message });
        }
        console.error('Error analyzing location:', error);
        return res.status(500).json({ status: 'error', message: 'Internal server error.' });
    }
});
exports.analyzeLocation = analyzeLocation;
