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
exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../../lib/prisma");
const protect = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    let token;
    console.log(`[protect] ${req.method} ${req.originalUrl} - Auth Header:`, req.headers.authorization ? 'PRESENT' : 'MISSING');
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_ACCESS_SECRET);
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: decoded.id },
                select: { id: true, role: true, email: true }
            });
            if (!user) {
                res.status(401).json({ message: 'Neautorizat, utilizatorul nu mai există' });
                return;
            }
            req.user = user;
            next();
        }
        catch (error) {
            res.status(401).json({ message: 'Neautorizat, token invalid' });
        }
    }
    else {
        res.status(401).json({ message: 'Neautorizat, nu există token în header' });
    }
});
exports.protect = protect;
