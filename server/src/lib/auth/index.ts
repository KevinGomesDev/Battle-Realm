// src/lib/auth/index.ts
// Barrel export para módulo de autenticação

// JWT
export { generateToken, verifyToken, decodeToken } from "./jwt";
export type { JwtPayload } from "./jwt";

// Rate Limiter
export { rateLimiter } from "./rate-limiter";

// Validators
export {
  isValidEmail,
  isValidUsername,
  isValidPassword,
  sanitizeString,
} from "./validators";
