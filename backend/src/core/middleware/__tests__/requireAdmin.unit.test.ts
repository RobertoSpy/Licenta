import { requireAdmin } from '../requireAdmin';
import { UserRole } from '@prisma/client';

describe('requireAdmin (unit)', () => {
  let req: any;
  let res: any;
  let next: any;

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
    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for CLIENT role', () => {
    req.user = { id: 1, role: UserRole.CLIENT };
    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for CONTRACTOR role', () => {
    req.user = { id: 1, role: UserRole.CONTRACTOR };
    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when role is undefined (user without role)', () => {
    req.user = { id: 1, role: undefined };
    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for ADMIN role', () => {
    req.user = { id: 1, role: UserRole.ADMIN };
    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('does not modify req object on success', () => {
    req.user = { id: 1, role: UserRole.ADMIN };
    const initialReqKeys = Object.keys(req);
    requireAdmin(req, res, next);

    expect(Object.keys(req)).toEqual(initialReqKeys);
  });
});
