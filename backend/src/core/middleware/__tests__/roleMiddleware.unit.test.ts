import { requireRole } from '../roleMiddleware';
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../authMiddleware';

describe('requireRole middleware', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction = jest.fn();

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
    const middleware = requireRole('CLIENT');
    
    middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);
    
    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('returns 403 if user does not have the correct role', () => {
    mockRequest.user = { id: 1, role: 'CLIENT' };
    const middleware = requireRole('CONTRACTOR');
    
    middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);
    
    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Acces interzis pentru rolul: CLIENT. Necesită: CONTRACTOR' });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('returns 401 if req.user is missing completely', () => {
    mockRequest.user = undefined;
    const middleware = requireRole('CLIENT');
    
    middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);
    
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Neautorizat, utilizator inexistent în request' });
    expect(nextFunction).not.toHaveBeenCalled();
  });
});
