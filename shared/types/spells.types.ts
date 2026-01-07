import { type BattleUnit } from "./battle.types";
import {
  type AbilityRange,
  type AbilityTargetType,
  type AbilityEffectType,
  type DynamicValue,
  DEFAULT_RANGE_DISTANCE,
} from "./ability.types";

// Re-exportar tipos de ability para compatibilidade
export type {
  AbilityRange,
  AbilityTargetType,
  AbilityEffectType,
  DynamicValue,
};
export { DEFAULT_RANGE_DISTANCE };

// Tipos legados (mantidos para compatibilidade)
export type SpellRange = AbilityRange | "ADJACENT"; // ADJACENT é legado, usar MELEE
export type SpellTargetType = AbilityTargetType;

export interface SpellDefinition {
  code: string;
  name: string;
  description: string;
  range: SpellRange;
  targetType: SpellTargetType;
  functionName: string;

  // Tipo de efeito da spell (usado pela IA para decisões)
  effectType?: AbilityEffectType;

  manaCost?: number; // Custo de mana
  cooldown?: number; // Turnos de recarga
  icon?: string;
  color?: string;

  // === ALCANCE ===
  rangeDistance?: DynamicValue; // Distância máxima para escolher alvo (padrão: DEFAULT_RANGE_DISTANCE)

  // === ÁREA ===
  areaSize?: DynamicValue; // Tamanho da área de efeito (ex: 3 = 3x3)

  // === DANO/CURA ===
  baseDamage?: DynamicValue; // Dano base da spell (pode ser número ou ATTRIBUTE.FOCUS)
  damageMultiplier?: number; // Multiplicador de atributo para dano (ex: 0.5 = +50% do Focus)
  healing?: DynamicValue; // Cura base (se aplicável)

  // === CONDIÇÕES ===
  conditionApplied?: string; // Condição aplicada pelo spell
  conditionDuration?: DynamicValue; // Duração da condição em turnos
}

export interface SpellExecutionResult {
  success: boolean;
  error?: string;
  damageDealt?: number;
  rawDamage?: number;
  damageReduction?: number;
  targetIds?: string[];
  targetHpAfter?: number;
  targetDefeated?: boolean;
  /** Dados de esquiva por alvo (para spells de área ou single target) */
  dodgeResults?: Array<{
    targetId: string;
    targetName: string;
    dodged: boolean;
    dodgeChance: number;
    dodgeRoll: number;
  }>;
  conditionsApplied?: Array<{
    targetId: string;
    conditionId: string;
  }>;
  conditionsRemoved?: Array<{
    targetId: string;
    conditionId: string;
  }>;
  unitsMoved?: Array<{
    unitId: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
  }>;
}

export type SpellExecutorFn = (
  caster: BattleUnit,
  target: BattleUnit | { x: number; y: number } | null,
  allUnits: BattleUnit[],
  spell: SpellDefinition,
  battleId?: string
) => SpellExecutionResult;
