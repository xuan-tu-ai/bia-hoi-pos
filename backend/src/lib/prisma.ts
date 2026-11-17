import { Prisma, PrismaClient } from '@prisma/client';

/** Prisma client dùng chung cho toàn bộ backend. */
export const prisma = new PrismaClient();

/** Kiểu của client bên trong `prisma.$transaction(async (tx) => ...)`. */
export type Tx = Prisma.TransactionClient;
