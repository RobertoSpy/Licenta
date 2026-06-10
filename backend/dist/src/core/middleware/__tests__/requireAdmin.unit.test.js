"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const requireAdmin_1 = require("../requireAdmin");
const client_1 = require("@prisma/client");
describe('requireAdmin (unit)', () => {
    let req;
    let res;
    let next;
    beforeEach(() => {
        req = { user: undefined };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        next = jest.fn();
    });
    it('returns 401 when req.user is not set (authMiddleware not applied first)', () => {
        req.user = undefined; // Fără authMiddleware
        (0, requireAdmin_1.requireAdmin)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });
    it('returns 403 for CLIENT role', () => {
        req.user = { id: 1, role: client_1.UserRole.CLIENT };
        (0, requireAdmin_1.requireAdmin)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
    it('returns 403 for CONTRACTOR role', () => {
        req.user = { id: 1, role: client_1.UserRole.CONTRACTOR };
        (0, requireAdmin_1.requireAdmin)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
    it('returns 403 when role is undefined (user without role)', () => {
        req.user = { id: 1, role: undefined };
        (0, requireAdmin_1.requireAdmin)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
    it('calls next() for ADMIN role', () => {
        req.user = { id: 1, role: client_1.UserRole.ADMIN };
        (0, requireAdmin_1.requireAdmin)(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });
    it('does not modify req object on success', () => {
        req.user = { id: 1, role: client_1.UserRole.ADMIN };
        const initialReqKeys = Object.keys(req);
        (0, requireAdmin_1.requireAdmin)(req, res, next);
        expect(Object.keys(req)).toEqual(initialReqKeys);
    });
});
