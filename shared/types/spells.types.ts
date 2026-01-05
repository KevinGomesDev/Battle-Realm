import { type BattleUnit } from "./battle.types";

export type SpellRange = "SELF" | "ADJACENT" | "RANGED" | "AREA";
export type SpellTargetType =
  | "SELF"
  | "ALLY"
  | "ENEMY"
  | "ALL"
  | "GROUND"
  | "POSITION";

export interface SpellDefinition {
  code: string;
  name: string;
  description: string;
  range: SpellRange;
  targetType: SpellTargetType;
  functionName: string;
  manaCost?: number; // Custo de mana (opcional, pode ser implementado futuramente)
  cooldown?: number; // Turnos de recarga
  icon?: string;
  color?: string;
}

export interface SpellExecutionResult {
  success: boolean;
  error?: string;
  damageDealt?: number;
  targetIds?: string[];
  targetHpAfter?: number;
  targetDefeated?: boolean;
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
  spell: SpellDefinition
) => SpellExecutionResult;
