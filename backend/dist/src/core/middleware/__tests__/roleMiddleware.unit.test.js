"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const roleMiddleware_1 = require("../roleMiddleware");
describe('requireRole middleware', () => {
    let mockRequest;
    let mockResponse;
    let nextFunction = jest.fn();
    beforeEach(() => {
        mockRequest = {};
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        nextFunction = jest.fn();
    });
    it('calls next() if user has the correct role', () => {
        mockRequest.user = { id: 1, role: 'CLIENT' };
        const middleware = (0, roleMiddleware_1.requireRole)('CLIENT');
        middleware(mockRequest, mockResponse, nextFunction);
        expect(nextFunction).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
    });
    it('returns 403 if user does not have the correct role', () => {
        mockRequest.user = { id: 1, role: 'CLIENT' };
        const middleware = (0, roleMiddleware_1.requireRole)('CONTRACTOR');
        middleware(mockRequest, mockResponse, nextFunction);
        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Acces interzis pentru rolul: CLIENT. Necesită: CONTRACTOR' });
        expect(nextFunction).not.toHaveBeenCalled();
    });
    it('returns 401 if req.user is missing completely', () => {
        mockRequest.user = undefined;
        const middleware = (0, roleMiddleware_1.requireRole)('CLIENT');
        middleware(mockRequest, mockResponse, nextFunction);
        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Neautorizat, utilizator inexistent în request' });
        expect(nextFunction).not.toHaveBeenCalled();
    });
});
