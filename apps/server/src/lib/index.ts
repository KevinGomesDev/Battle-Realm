// src/lib/index.ts
// Barrel export para todos os módulos de lib

// Prisma
export { prisma } from "./prisma";

// Auth (JWT, Rate Limiter, Validators, Middleware)
export * from "./auth";

// Validation (Zod schemas and helpers)
export * from "./validation";
