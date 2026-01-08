// src/lib/auth/jwt.ts
import jwt from "jsonwebtoken";

// Em produção, use uma variável de ambiente segura
const JWT_SECRET = process.env.JWT_SECRET || "battle-realm-dev-secret";
const JWT_EXPIRES_IN = "7d"; // Token expira em 7 dias

export interface JwtPayload {
  userId: string;
  username: string;
  iat?: number;
  exp?: number;
}

/**
 * Gera um token JWT para o usuário
 */
export function generateToken(userId: string, username: string): string {
  return jwt.sign({ userId, username }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verifica e decodifica um token JWT
 * @returns payload do token ou null se inválido
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Decodifica um token sem verificar (útil para debug)
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch {
    return null;
  }
}
