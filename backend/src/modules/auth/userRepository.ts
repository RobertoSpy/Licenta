import { User, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export const userRepository = {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  },
  async findByRefreshToken(refreshToken: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { refreshToken } });
  },
  async create(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({ data });
  },
  async updateRefreshToken(id: number, refreshToken: string | null): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { refreshToken }
    });
  },
  async clearRefreshToken(refreshToken: string): Promise<void> {
    await prisma.user.updateMany({
      where: { refreshToken },
      data: { refreshToken: null }
    });
  },
  async saveResetToken(userId: number, hashedToken: string, expires: Date): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: expires,
      },
    });
  },

  async findByResetToken(hashedToken: string): Promise<import('@prisma/client').User | null> {
    return prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { gt: new Date() }, // token-ul nu a expirat
      },
    });
  },

  async clearResetToken(userId: number, newHashedPassword: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: newHashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
  },

  async saveVerificationToken(userId: number, hashedToken: string, expires: Date): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        verificationToken: hashedToken,
        verificationExpires: expires,
      },
    });
  },

  async findByVerificationToken(hashedToken: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        verificationToken: hashedToken,
        verificationExpires: { gt: new Date() },
      },
    });
  },

  async markAsVerified(userId: number): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isVerified: true,
        verificationToken: null,
        verificationExpires: null,
      },
    });
  },
};

