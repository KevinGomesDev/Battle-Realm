// src/lib/auth/validators.ts

/**
 * Valida formato de email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida username
 * - 3-20 caracteres
 * - Apenas letras, números e underscore
 */
export function isValidUsername(username: string): {
  valid: boolean;
  error?: string;
} {
  if (!username || username.length < 3) {
    return { valid: false, error: "Username deve ter no mínimo 3 caracteres" };
  }
  if (username.length > 20) {
    return { valid: false, error: "Username deve ter no máximo 20 caracteres" };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return {
      valid: false,
      error: "Username pode conter apenas letras, números e underscore",
    };
  }
  return { valid: true };
}

/**
 * Valida senha
 * - Mínimo 6 caracteres
 */
export function isValidPassword(password: string): {
  valid: boolean;
  error?: string;
} {
  if (!password || password.length < 6) {
    return { valid: false, error: "Senha deve ter no mínimo 6 caracteres" };
  }
  if (password.length > 100) {
    return { valid: false, error: "Senha muito longa" };
  }
  return { valid: true };
}

/**
 * Sanitiza string removendo caracteres perigosos
 */
export function sanitizeString(str: string): string {
  if (!str) return "";
  return str.trim().replace(/[<>]/g, "");
}
