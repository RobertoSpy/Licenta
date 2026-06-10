"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = void 0;
const client_1 = require("@prisma/client");
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ message: 'Neautorizat, middleware-ul de autentificare nu a fost aplicat.' });
        return;
    }
    if (req.user.role !== client_1.UserRole.ADMIN) {
        res.status(403).json({ message: 'Acces interzis. Această acțiune necesită permisiuni de administrator.' });
        return;
    }
    next();
};
exports.requireAdmin = requireAdmin;
