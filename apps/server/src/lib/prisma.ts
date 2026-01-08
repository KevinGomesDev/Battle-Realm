// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

// Evita múltiplas instâncias em desenvolvimento devido ao hot-reload
declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
