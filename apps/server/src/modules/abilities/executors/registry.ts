// server/src/modules/abilities/executors/registry.ts
// Registry unificado de todos os executores de abilities (skills + spells)

import type { ExecutorRegistry } from "./types";

// Skills executors
import {
  executeAttackSkill,
  executeDash,
  executeDodge,
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
} from "./skills";

// Spells executors
import { executeTeleport, executeFire, executeEmpower } from "./spells";

/**
 * Mapa de functionName -> função executora (SKILLS)
 * Adicione novos executores aqui
 */
export const SKILL_EXECUTORS: ExecutorRegistry = {
  // Ações Comuns
  executeAttackSkill,
  executeDash,
  executeDodge,

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

  // Ranger
  executeHuntersMark,
  executeVolley,

  // Invocador
  executeEidolonResistance,
};

/**
 * Mapa de executores de spells
 */
export const SPELL_EXECUTORS: ExecutorRegistry = {
  executeTeleport,
  executeFire,
  executeEmpower,
};

/**
 * Mapa unificado de todos os executores (skills + spells)
 * Use este para buscar qualquer executor por functionName
 */
export const ALL_ABILITY_EXECUTORS: ExecutorRegistry = {
  ...SKILL_EXECUTORS,
  ...SPELL_EXECUTORS,
};

/**
 * Busca um executor por functionName
 */
export function getAbilityExecutor(functionName: string) {
  return ALL_ABILITY_EXECUTORS[functionName];
}
