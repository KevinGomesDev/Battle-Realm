// shared/data/regents.data.ts
// Templates de Regentes pré-definidos (vinculados aos Templates de Reinos)
// Regentes são unidades especiais que lideram o Reino
// Re-exporta templates e fornece funções utilitárias

import type { Alignment } from "../types/kingdom.types";
import type { RegentTemplate } from "../types/units.types";

// Re-exportar tipos e templates
export type { RegentTemplate } from "../types/units.types";
export { SERAPHINA, MALACHAR, IGNATHARAX } from "./Templates/RegentTemplates";

import { SERAPHINA, MALACHAR, IGNATHARAX } from "./Templates/RegentTemplates";

// =============================================================================
// LISTA DE TODOS OS REGENTES
// =============================================================================

export const REGENT_TEMPLATES: RegentTemplate[] = [
  SERAPHINA,
  MALACHAR,
  IGNATHARAX,
];

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Busca um regente pelo código
 */
export function getRegentTemplate(code: string): RegentTemplate | undefined {
  return REGENT_TEMPLATES.find((r) => r.code === code);
}

/**
 * Lista regentes por alinhamento
 */
export function getRegentsByAlignment(alignment: Alignment): RegentTemplate[] {
  return REGENT_TEMPLATES.filter((r) => r.alignment === alignment);
}

/**
 * Retorna os atributos totais do regente (soma)
 * Regentes devem ter soma = 36
 */
export function getRegentTotalAttributes(regent: RegentTemplate): number {
  return (
    regent.combat +
    regent.speed +
    regent.focus +
    regent.resistance +
    regent.will +
    regent.vitality
  );
}

/**
 * Valida se os atributos do regente estão corretos
 */
export function validateRegentAttributes(regent: RegentTemplate): {
  valid: boolean;
  total: number;
  expected: number;
} {
  const total = getRegentTotalAttributes(regent);
  const expected = 36; // Regentes têm 36 pontos de atributo (6 atributos)
  return { valid: total === expected, total, expected };
}
