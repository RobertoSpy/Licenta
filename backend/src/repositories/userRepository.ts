import { PrismaClient, User, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

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
  }
};
