"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = void 0;
/**
 * Middleware pentru restricționarea accesului bazat pe rol.
 * Trebuie folosit DUPĂ middleware-ul `protect`.
 */
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ message: 'Neautorizat, utilizator inexistent în request' });
            return;
        }
        if (!roles.includes(req.user.role)) {
            res.status(403).json({ message: `Acces interzis pentru rolul: ${req.user.role}. Necesită: ${roles.join(', ')}` });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
