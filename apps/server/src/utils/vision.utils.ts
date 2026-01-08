// server/src/utils/vision.utils.ts
// Utilitários para cálculos de visibilidade em batalha
// Considera Line of Sight (obstáculos e unidades bloqueiam visão)

import {
  isCellVisibleByUnit,
  isCellVisibleByUnitWithLoS,
} from "../../../shared/config";
import type {
  BattleUnit,
  BattleObstacle,
} from "../../../shared/types/battle.types";
import type {
  ObstacleForLoS,
  UnitForLoS,
} from "../../../shared/utils/line-of-sight.utils";

/**
 * Converte BattleUnit para UnitForLoS
 */
function toUnitForLoS(unit: BattleUnit): UnitForLoS {
  return {
    id: unit.id,
    posX: unit.posX,
    posY: unit.posY,
    isAlive: unit.isAlive,
    size: unit.size,
  };
}

/**
 * Converte BattleObstacle para ObstacleForLoS
 */
function toObstacleForLoS(obstacle: BattleObstacle): ObstacleForLoS {
  return {
    posX: obstacle.posX,
    posY: obstacle.posY,
    destroyed: obstacle.destroyed,
  };
}

/**
 * Retorna os IDs dos jogadores cujas unidades podem ver uma posição específica
 * Considera Line of Sight quando obstáculos são fornecidos
 * @param allUnits - Todas as unidades da batalha
 * @param targetPosX - Posição X alvo
 * @param targetPosY - Posição Y alvo
 * @param obstacles - Obstáculos da batalha (opcional - se não fornecido, não considera LoS)
 * @returns Array de IDs de jogadores com visão na posição
 */
export function getPlayersWithVisionAt(
  allUnits: BattleUnit[],
  targetPosX: number,
  targetPosY: number,
  obstacles?: BattleObstacle[]
): string[] {
  const playerIds = new Set<string>();

  // Se obstáculos fornecidos, usar LoS completo
  if (obstacles) {
    const unitsForLoS = allUnits.map(toUnitForLoS);
    const obstaclesForLoS = obstacles.map(toObstacleForLoS);

    for (const unit of allUnits) {
      if (!unit.isAlive) continue;

      const canSee = isCellVisibleByUnitWithLoS(
        unit.posX,
        unit.posY,
        unit.size,
        unit.focus,
        targetPosX,
        targetPosY,
        obstaclesForLoS,
        unitsForLoS,
        unit.id
      );

      if (canSee) {
        playerIds.add(unit.ownerId);
      }
    }
  } else {
    // Fallback sem LoS (compatibilidade)
    for (const unit of allUnits) {
      if (!unit.isAlive) continue;

      const canSee = isCellVisibleByUnit(
        unit.posX,
        unit.posY,
        unit.size,
        unit.focus,
        targetPosX,
        targetPosY
      );

      if (canSee) {
        playerIds.add(unit.ownerId);
      }
    }
  }

  return Array.from(playerIds);
}

/**
 * Retorna os IDs dos jogadores cujas unidades podem ver QUALQUER uma das posições fornecidas
 * Útil para eventos de movimento (posição origem OU destino)
 * Considera Line of Sight quando obstáculos são fornecidos
 * @param allUnits - Todas as unidades da batalha
 * @param positions - Array de posições {x, y} para verificar
 * @param obstacles - Obstáculos da batalha (opcional - se não fornecido, não considera LoS)
 * @returns Array de IDs de jogadores com visão em pelo menos uma posição
 */
export function getPlayersWithVisionAtAny(
  allUnits: BattleUnit[],
  positions: Array<{ x: number; y: number }>,
  obstacles?: BattleObstacle[]
): string[] {
  const playerIds = new Set<string>();

  // Se obstáculos fornecidos, usar LoS completo
  if (obstacles) {
    const unitsForLoS = allUnits.map(toUnitForLoS);
    const obstaclesForLoS = obstacles.map(toObstacleForLoS);

    for (const unit of allUnits) {
      if (!unit.isAlive) continue;

      for (const pos of positions) {
        const canSee = isCellVisibleByUnitWithLoS(
          unit.posX,
          unit.posY,
          unit.size,
          unit.focus,
          pos.x,
          pos.y,
          obstaclesForLoS,
          unitsForLoS,
          unit.id
        );

        if (canSee) {
          playerIds.add(unit.ownerId);
          break;
        }
      }
    }
  } else {
    // Fallback sem LoS (compatibilidade)
    for (const unit of allUnits) {
      if (!unit.isAlive) continue;

      for (const pos of positions) {
        const canSee = isCellVisibleByUnit(
          unit.posX,
          unit.posY,
          unit.size,
          unit.focus,
          pos.x,
          pos.y
        );

        if (canSee) {
          playerIds.add(unit.ownerId);
          break;
        }
      }
    }
  }

  return Array.from(playerIds);
}

/**
 * Verifica se um jogador específico tem visão de uma posição
 * Considera Line of Sight quando obstáculos são fornecidos
 * @param allUnits - Todas as unidades da batalha
 * @param playerId - ID do jogador para verificar
 * @param targetPosX - Posição X alvo
 * @param targetPosY - Posição Y alvo
 * @param obstacles - Obstáculos da batalha (opcional - se não fornecido, não considera LoS)
 * @returns true se o jogador tem visão da posição
 */
export function playerHasVisionAt(
  allUnits: BattleUnit[],
  playerId: string,
  targetPosX: number,
  targetPosY: number,
  obstacles?: BattleObstacle[]
): boolean {
  // Se obstáculos fornecidos, usar LoS completo
  if (obstacles) {
    const unitsForLoS = allUnits.map(toUnitForLoS);
    const obstaclesForLoS = obstacles.map(toObstacleForLoS);

    for (const unit of allUnits) {
      if (!unit.isAlive || unit.ownerId !== playerId) continue;

      const canSee = isCellVisibleByUnitWithLoS(
        unit.posX,
        unit.posY,
        unit.size,
        unit.focus,
        targetPosX,
        targetPosY,
        obstaclesForLoS,
        unitsForLoS,
        unit.id
      );

      if (canSee) {
        return true;
      }
    }
  } else {
    // Fallback sem LoS (compatibilidade)
    for (const unit of allUnits) {
      if (!unit.isAlive || unit.ownerId !== playerId) continue;

      const canSee = isCellVisibleByUnit(
        unit.posX,
        unit.posY,
        unit.size,
        unit.focus,
        targetPosX,
        targetPosY
      );

      if (canSee) {
        return true;
      }
    }
  }

  return false;
}
