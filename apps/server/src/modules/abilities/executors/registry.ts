// server/src/modules/abilities/executors/registry.ts
// Registry unificado de todos os executores de abilities

import type { ExecutorRegistry } from "./types";

// Ability executors (unificado)
import {
  executeAttackSkill,
  executeDash,
  executeSecondWind,
  executeActionSurge,
  executeTotalDestruction,
  executeHeal,
  executeBless,
  executeDivineFavor,
  executeCureWounds,
  executeTurnUndead,
  executeCelestialExpulsion,
  executeMagicWeapon,
  executeArcaneShield,
  executeHuntersMark,
  executeVolley,
  executeEidolonResistance,
  executeTeleport,
  executeFire,
  executeEmpower,
} from "./abilities";

/**
 * Registry unificado de todos os executores de abilities
 * Adicione novos executores aqui
 */
export const ABILITY_EXECUTORS: ExecutorRegistry = {
  // Ações Comuns
  executeAttackSkill,
  executeDash,

  // Guerreiro
  executeSecondWind,
  executeActionSurge,

  // Bárbaro
  executeTotalDestruction,

  // Clérigo
  executeHeal,
  executeBless,
  executeDivineFavor,
  executeCureWounds,
  executeTurnUndead,
  executeCelestialExpulsion,

  // Mago
  executeMagicWeapon,
  executeArcaneShield,
  executeFire,
  executeTeleport,

  // Ranger
  executeHuntersMark,
  executeVolley,

  // Invocador
  executeEidolonResistance,
  executeEmpower,
};

/**
 * Busca um executor por functionName
 */
export function getAbilityExecutor(functionName: string) {
  return ABILITY_EXECUTORS[functionName];
}
