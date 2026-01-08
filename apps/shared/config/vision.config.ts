// shared/config/vision.config.ts
// Configuração do sistema de visão para batalha

import {
  hasLineOfSight,
  type ObstacleForLoS,
  type UnitForLoS,
  obstaclesToBlockers,
  unitsToBlockers,
} from "../utils/line-of-sight.utils";
import { UNIT_SIZE_CONFIG, type UnitSize } from "./unit-size.config";

// =============================================================================
// CONFIGURAÇÃO DE VISÃO
// =============================================================================

export const VISION_CONFIG = {
  /** Visão mínima garantida para todas as unidades */
  minVision: 10,
  /** Usar Focus como base de visão (se maior que minVision) */
  usesFocus: true,
} as const;

// =============================================================================
// FUNÇÕES DE VISÃO BÁSICA
// =============================================================================

/**
 * Calcula o alcance de visão de uma unidade
 * Visão = max(VISION_CONFIG.minVision, focus)
 */
export function calculateUnitVision(focus: number): number {
  return Math.max(VISION_CONFIG.minVision, focus);
}

/**
 * Verifica se uma célula está dentro do alcance de visão de uma unidade
 * Usa distância de Manhattan (estilo grid)
 */
export function isCellVisible(
  unitX: number,
  unitY: number,
  cellX: number,
  cellY: number,
  visionRange: number
): boolean {
  const distance = Math.abs(cellX - unitX) + Math.abs(cellY - unitY);
  return distance <= visionRange;
}

/**
 * Verifica se uma célula está dentro do alcance de visão de uma unidade (com tamanho)
 * Para unidades grandes, considera a visão a partir de qualquer célula ocupada
 */
export function isCellVisibleByUnit(
  unitPosX: number,
  unitPosY: number,
  unitSize: UnitSize,
  unitFocus: number,
  cellX: number,
  cellY: number
): boolean {
  const visionRange = calculateUnitVision(unitFocus);
  const dimension = UNIT_SIZE_CONFIG[unitSize].dimension;

  for (let dx = 0; dx < dimension; dx++) {
    for (let dy = 0; dy < dimension; dy++) {
      const checkX = unitPosX + dx;
      const checkY = unitPosY + dy;
      if (isCellVisible(checkX, checkY, cellX, cellY, visionRange)) {
        return true;
      }
    }
  }

  return false;
}

// =============================================================================
// FUNÇÕES DE VISÃO COM LINE OF SIGHT (BLOQUEADORES)
// =============================================================================

/**
 * Verifica se uma célula está visível considerando Line of Sight
 * Leva em conta distância E bloqueadores (obstáculos + unidades)
 */
export function isCellVisibleWithLoS(
  unitX: number,
  unitY: number,
  cellX: number,
  cellY: number,
  visionRange: number,
  obstacles: ObstacleForLoS[],
  units: UnitForLoS[],
  observerId?: string
): boolean {
  const distance = Math.abs(cellX - unitX) + Math.abs(cellY - unitY);
  if (distance > visionRange) return false;

  const obstacleBlockers = obstaclesToBlockers(obstacles);
  const unitBlockers = unitsToBlockers(units, observerId ? [observerId] : []);
  const allBlockers = [...obstacleBlockers, ...unitBlockers];

  return hasLineOfSight(unitX, unitY, cellX, cellY, allBlockers);
}

/**
 * Verifica se uma célula está visível por uma unidade (considerando tamanho e LoS)
 * Para unidades grandes, verifica a partir de qualquer célula ocupada
 */
export function isCellVisibleByUnitWithLoS(
  unitPosX: number,
  unitPosY: number,
  unitSize: UnitSize,
  unitFocus: number,
  cellX: number,
  cellY: number,
  obstacles: ObstacleForLoS[],
  units: UnitForLoS[],
  observerId?: string
): boolean {
  const visionRange = calculateUnitVision(unitFocus);
  const dimension = UNIT_SIZE_CONFIG[unitSize].dimension;

  for (let dx = 0; dx < dimension; dx++) {
    for (let dy = 0; dy < dimension; dy++) {
      const checkX = unitPosX + dx;
      const checkY = unitPosY + dy;
      if (
        isCellVisibleWithLoS(
          checkX,
          checkY,
          cellX,
          cellY,
          visionRange,
          obstacles,
          units,
          observerId
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

// Re-exportar tipos de LoS para conveniência
export type { ObstacleForLoS, UnitForLoS };
