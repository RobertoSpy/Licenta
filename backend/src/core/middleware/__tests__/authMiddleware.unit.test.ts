import { protect } from '../authMiddleware';
import { prismaMock } from '../../../../tests/setup';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

jest.mock('jsonwebtoken');

describe('authMiddleware (unit)', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('returns 401 when Authorization header exists but token is malformed (not JWT format)', async () => {
    req.headers.authorization = 'Bearer malformed_token_string';
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Neautorizat, token invalid' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token signature is valid but userId does not exist in DB', async () => {
    req.headers.authorization = 'Bearer valid_token';
    (jwt.verify as jest.Mock).mockReturnValue({ id: 999 });
    prismaMock.user.findUnique.mockResolvedValue(null);

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Neautorizat, utilizatorul nu mai există' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is valid but user has been deactivated/deleted since issue', async () => {
    // Același comportament: user-ul nu mai este în baza de date.
    req.headers.authorization = 'Bearer valid_token';
    (jwt.verify as jest.Mock).mockReturnValue({ id: 1 });
    prismaMock.user.findUnique.mockResolvedValue(null);

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('does not call next() on any 401 path', async () => {
    req.headers.authorization = undefined; // No token
    await protect(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() exactly once on success, not twice', async () => {
    req.headers.authorization = 'Bearer valid_token';
    (jwt.verify as jest.Mock).mockReturnValue({ id: 1 });
    prismaMock.user.findUnique.mockResolvedValue({ id: 1, role: UserRole.CLIENT, email: 'test@test.com' } as any);

    await protect(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('sets req.user with id, email, role — not full user object with password hash', async () => {
    req.headers.authorization = 'Bearer valid_token';
    (jwt.verify as jest.Mock).mockReturnValue({ id: 1 });
    // Simulăm ce returnează Prisma prin select-ul restrâns
    const selectedData = { id: 1, role: UserRole.CLIENT, email: 'test@test.com' };
    prismaMock.user.findUnique.mockResolvedValue(selectedData as any);

    await protect(req, res, next);

    expect(req.user).toEqual(selectedData);
    expect(req.user.passwordHash).toBeUndefined(); // Nu vrem expunerea parolei!
    expect(next).toHaveBeenCalled();
  });
});
