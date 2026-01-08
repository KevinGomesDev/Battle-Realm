// server/src/logic/movement-actions.ts
// Lógica de movimento de unidades em batalha

import {
  scanConditionsForAction,
  applyConditionScanResult,
} from "../conditions/conditions";
import type {
  BattleObstacle,
  BattleUnit,
} from "../../../../shared/types/battle.types";
import { validateMove } from "../../../../shared/utils/engagement.utils";

// =============================================================================
// TIPOS
// =============================================================================

export interface MoveActionResult {
  success: boolean;
  error?: string;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  movesLeft?: number;
  moveCost?: number;
}

// =============================================================================
// FUNÇÕES DE MOVIMENTO
// =============================================================================

/**
 * Calcula movimento base: retorna Velocidade completa (mínimo 1)
 */
export function calculateBaseMovement(speed: number): number {
  return Math.max(1, speed);
}

/**
 * Executa ação de movimento de uma unidade
 */
export function executeMoveAction(
  unit: BattleUnit,
  toX: number,
  toY: number,
  gridWidth: number,
  gridHeight: number,
  allUnits: BattleUnit[],
  obstacles: BattleObstacle[] = []
): MoveActionResult {
  // Movimentação é uma mecânica base, não uma skill - não precisa verificar features
  if (!unit.isAlive) {
    return { success: false, error: "Dead unit cannot move" };
  }

  // Varredura de condições
  const scan = scanConditionsForAction(unit.conditions, "move");
  if (!scan.canPerform) {
    return { success: false, error: scan.blockReason };
  }

  // Validação centralizada de movimento (custo, caminho, ocupação, obstáculos)
  const moveValidation = validateMove(
    unit,
    toX,
    toY,
    allUnits,
    obstacles,
    gridWidth,
    gridHeight
  );

  if (!moveValidation.valid) {
    return { success: false, error: moveValidation.error };
  }

  const fromX = unit.posX;
  const fromY = unit.posY;

  unit.posX = toX;
  unit.posY = toY;
  unit.movesLeft -= moveValidation.totalCost;

  // Aplicar expiração de condições
  unit.conditions = applyConditionScanResult(unit.conditions, scan);

  return {
    success: true,
    fromX,
    fromY,
    toX,
    toY,
    movesLeft: unit.movesLeft,
    moveCost: moveValidation.totalCost,
  };
}
