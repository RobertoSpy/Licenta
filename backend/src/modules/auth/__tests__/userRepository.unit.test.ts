import { userRepository } from '../userRepository';
import { prisma } from '../../../lib/prisma';

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

describe('userRepository', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('findByEmail returns user', async () => {
    const mockUser = { id: 1, email: 'test@test.com' };
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

    const result = await userRepository.findByEmail('test@test.com');
    expect(result).toEqual(mockUser);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'test@test.com' } });
  });

  it('findByRefreshToken returns user', async () => {
    const mockUser = { id: 1, refreshToken: 'token123' };
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

    const result = await userRepository.findByRefreshToken('token123');
    expect(result).toEqual(mockUser);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({ where: { refreshToken: 'token123' } });
  });

  it('create user', async () => {
    const mockData = { email: 'new@test.com', password: 'hash', name: 'John' };
    const mockUser = { id: 2, ...mockData };
    (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

    const result = await userRepository.create(mockData);
    expect(result).toEqual(mockUser);
    expect(prisma.user.create).toHaveBeenCalledWith({ data: mockData });
  });

  it('updateRefreshToken updates the token', async () => {
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: 1 });
    await userRepository.updateRefreshToken(1, 'newtoken');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { refreshToken: 'newtoken' }
    });
  });

  it('clearRefreshToken clears tokens globally by string', async () => {
    (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    await userRepository.clearRefreshToken('oldtoken');
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { refreshToken: 'oldtoken' },
      data: { refreshToken: null }
    });
  });

  it('saveResetToken updates token and expiry', async () => {
    const expires = new Date();
    await userRepository.saveResetToken(1, 'hashedReset', expires);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { passwordResetToken: 'hashedReset', passwordResetExpires: expires }
    });
  });

  it('findByResetToken checks for token and expiry', async () => {
    await userRepository.findByResetToken('hashedReset');
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        passwordResetToken: 'hashedReset',
        passwordResetExpires: { gt: expect.any(Date) }
      }
    });
  });

  it('clearResetToken updates password and clears tokens', async () => {
    await userRepository.clearResetToken(1, 'newHashedPass');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        password: 'newHashedPass',
        passwordResetToken: null,
        passwordResetExpires: null,
      }
    });
  });

  it('saveVerificationToken updates verification token and expiry', async () => {
    const expires = new Date();
    await userRepository.saveVerificationToken(1, 'verifHash', expires);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { verificationToken: 'verifHash', verificationExpires: expires }
    });
  });

  it('findByVerificationToken checks for token and expiry', async () => {
    await userRepository.findByVerificationToken('verifHash');
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        verificationToken: 'verifHash',
        verificationExpires: { gt: expect.any(Date) }
      }
    });
  });

  it('markAsVerified sets isVerified to true and clears tokens', async () => {
    await userRepository.markAsVerified(1);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        isVerified: true,
        verificationToken: null,
        verificationExpires: null,
      }
    });
  });
});
