// Validation Library - Barrel Export
export * from "./kingdom.schemas";

// ============ VALIDATION HELPERS ============

import { ZodError, ZodSchema } from "zod";

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Valida dados usando um schema Zod
 */
export function validate<T>(
  schema: ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (err) {
    if (err instanceof ZodError) {
      const firstError = err.issues[0];
      const path = firstError.path.join(".");
      const message = path
        ? `${path}: ${firstError.message}`
        : firstError.message;
      return { success: false, error: message };
    }
    return { success: false, error: "Erro de validação desconhecido" };
  }
}
