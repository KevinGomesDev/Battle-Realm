// server/src/logic/weather-effects.ts
// Lógica para aplicar efeitos de clima quando uma ação falha

import type {
  WeatherType,
  BattleObstacle,
} from "../../../shared/types/battle.types";
import { findRandomFreePosition } from "./battle-map";
import type { CombatUnit } from "./combat-actions";

// =============================================================================
// TIPOS
// =============================================================================

export interface WeatherEffectResult {
  applied: boolean;
  effectType: string;
  message: string;
  damage?: number;
  conditionApplied?: string;
  teleported?: { fromX: number; fromY: number; toX: number; toY: number };
}

// =============================================================================
// APLICAÇÃO DE EFEITOS
// =============================================================================

/**
 * Aplica efeito de clima quando uma unidade FALHA em uma ação
 * Retorna o resultado do efeito aplicado
 */
export function applyWeatherEffect(
  weather: WeatherType,
  unit: CombatUnit,
  gridWidth: number,
  gridHeight: number,
  obstacles: BattleObstacle[],
  allUnits: CombatUnit[]
): WeatherEffectResult {
  switch (weather) {
    case "SUNNY":
      return {
        applied: false,
        effectType: "NONE",
        message: "",
      };

    case "RAIN":
      return applyRainEffect(unit);

    case "STORM":
      return applyStormEffect(unit);

    case "SNOW":
      return applySnowEffect(unit);

    case "BLIZZARD":
      return applyBlizzardEffect(unit);

    case "FALLING_LEAVES":
      return applyFallingLeavesEffect(
        unit,
        gridWidth,
        gridHeight,
        obstacles,
        allUnits
      );

    default:
      return {
        applied: false,
        effectType: "NONE",
        message: "",
      };
  }
}

// =============================================================================
// EFEITOS INDIVIDUAIS
// =============================================================================

/**
 * CHUVA: Unidade fica Derrubada
 */
function applyRainEffect(unit: CombatUnit): WeatherEffectResult {
  if (!unit.conditions.includes("DERRUBADA")) {
    unit.conditions.push("DERRUBADA");
  }

  return {
    applied: true,
    effectType: "KNOCKDOWN",
    message: `${unit.name} escorregou no chão molhado e foi derrubado!`,
    conditionApplied: "DERRUBADA",
  };
}

/**
 * TEMPESTADE: Unidade fica Derrubada + precisa gastar ação para levantar
 * (DERRUBADA já requer ação para levantar na lógica de condições)
 */
function applyStormEffect(unit: CombatUnit): WeatherEffectResult {
  if (!unit.conditions.includes("DERRUBADA")) {
    unit.conditions.push("DERRUBADA");
  }
  // Adicionar marcador de tempestade para forçar gasto de ação
  if (!unit.conditions.includes("STORM_KNOCKDOWN")) {
    unit.conditions.push("STORM_KNOCKDOWN");
  }

  return {
    applied: true,
    effectType: "STORM_KNOCKDOWN",
    message: `${unit.name} foi derrubado pelos ventos poderosos da tempestade!`,
    conditionApplied: "DERRUBADA",
  };
}

/**
 * NEVE: Unidade recebe 2 de Dano Verdadeiro
 */
function applySnowEffect(unit: CombatUnit): WeatherEffectResult {
  const damage = 2;
  unit.currentHp = Math.max(0, unit.currentHp - damage);

  if (unit.currentHp <= 0) {
    unit.isAlive = false;
  }

  return {
    applied: true,
    effectType: "TRUE_DAMAGE",
    message: `${unit.name} sofreu ${damage} de dano do frio ancestral!`,
    damage,
  };
}

/**
 * NEVASCA: Unidade recebe 4 de Dano Verdadeiro
 */
function applyBlizzardEffect(unit: CombatUnit): WeatherEffectResult {
  const damage = 4;
  unit.currentHp = Math.max(0, unit.currentHp - damage);

  if (unit.currentHp <= 0) {
    unit.isAlive = false;
  }

  return {
    applied: true,
    effectType: "TRUE_DAMAGE",
    message: `${unit.name} sofreu ${damage} de dano da nevasca devastadora!`,
    damage,
  };
}

/**
 * FOLHAS CAINDO: Unidade é teleportada para posição aleatória
 */
function applyFallingLeavesEffect(
  unit: CombatUnit,
  gridWidth: number,
  gridHeight: number,
  obstacles: BattleObstacle[],
  allUnits: CombatUnit[]
): WeatherEffectResult {
  const fromX = unit.posX;
  const fromY = unit.posY;

  // Posições ocupadas por outras unidades vivas
  const occupiedPositions = allUnits
    .filter((u) => u.isAlive && u.id !== unit.id)
    .map((u) => ({ x: u.posX, y: u.posY }));

  const newPos = findRandomFreePosition(
    gridWidth,
    gridHeight,
    obstacles,
    occupiedPositions,
    { x: fromX, y: fromY }
  );

  if (!newPos) {
    return {
      applied: false,
      effectType: "TELEPORT_FAILED",
      message: `Uma força misteriosa tenta mover ${unit.name}, mas não há espaço!`,
    };
  }

  unit.posX = newPos.x;
  unit.posY = newPos.y;

  return {
    applied: true,
    effectType: "TELEPORT",
    message: `Uma força misteriosa moveu ${unit.name} para outro lugar do campo de batalha!`,
    teleported: {
      fromX,
      fromY,
      toX: newPos.x,
      toY: newPos.y,
    },
  };
}

// =============================================================================
// VERIFICAÇÃO DE FALHA
// =============================================================================

/**
 * Determina se uma ação "falhou" para efeitos de clima
 * Uma ação falha quando:
 * - Ataque errou (dodge, miss)
 * - Movimento foi bloqueado
 * - Skill falhou
 */
export function didActionFail(actionResult: {
  success: boolean;
  missed?: boolean;
  error?: string;
}): boolean {
  // Se a ação não foi bem sucedida, falhou
  if (!actionResult.success) return true;

  // Se atacou mas errou (dodge), falhou
  if (actionResult.missed) return true;

  return false;
}
