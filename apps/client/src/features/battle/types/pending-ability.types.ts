// client/src/features/battle/types/pending-ability.types.ts
// Tipagem para ação pendente aguardando alvo

import type { AbilityDefinition } from "@shared/types";

/**
 * Tipo de ação pendente
 * - ATTACK: Ação de ataque básico (COMMON_ACTION_ATTACK)
 * - ABILITY: Qualquer outra ability (skill ou spell)
 */
export type PendingAbilityType = "ATTACK" | "ABILITY";

/**
 * Ação pendente aguardando seleção de alvo
 * Unifica skills, spells e ações comuns (todas são Abilities)
 */
export interface PendingAbility {
  /** Tipo da ação */
  type: PendingAbilityType;
  /** Código da ability */
  code: string;
  /** Definição completa da ability */
  ability: AbilityDefinition;
}

/**
 * Cria um PendingAbility a partir de uma AbilityDefinition
 */
export function createPendingAbility(
  ability: AbilityDefinition
): PendingAbility {
  // ATTACK é identificado pelo code, tratado como tipo especial
  const type: PendingAbilityType =
    ability.code === "ATTACK" ? "ATTACK" : "ABILITY";

  return {
    type,
    code: ability.code,
    ability,
  };
}

/**
 * Verifica se a ability pendente requer alvo
 */
export function pendingAbilityRequiresTarget(
  pending: PendingAbility | null
): boolean {
  if (!pending) return false;

  const { ability } = pending;

  // SELF não requer seleção de alvo
  if (ability.targetType === "SELF" || ability.range === "SELF") {
    return false;
  }

  return true;
}

/**
 * Obtém texto descritivo do tipo de alvo para UI
 */
export function getPendingAbilityTargetText(
  pending: PendingAbility | null
): string {
  if (!pending) return "um alvo";

  const { ability } = pending;

  if (ability.targetType === "POSITION" || ability.targetType === "GROUND") {
    return "uma posição no mapa";
  }

  if (ability.range === "MELEE") {
    return "um alvo adjacente";
  }

  if (ability.range === "RANGED") {
    return "um alvo no alcance";
  }

  if (ability.range === "AREA") {
    return "uma posição para a área";
  }

  if (ability.targetType === "UNIT") {
    return "uma unidade alvo";
  }

  return "um alvo";
}
