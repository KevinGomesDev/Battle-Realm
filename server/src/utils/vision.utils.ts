// server/src/utils/vision.utils.ts
// Utilitários para cálculos de visibilidade em batalha

import { isCellVisibleByUnit } from "../../../shared/config/global.config";
import type { BattleUnit } from "../../../shared/types/battle.types";

/**
 * Retorna os IDs dos jogadores cujas unidades podem ver uma posição específica
 * @param allUnits - Todas as unidades da batalha
 * @param targetPosX - Posição X alvo
 * @param targetPosY - Posição Y alvo
 * @returns Array de IDs de jogadores com visão na posição
 */
export function getPlayersWithVisionAt(
  allUnits: BattleUnit[],
  targetPosX: number,
  targetPosY: number
): string[] {
  const playerIds = new Set<string>();

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

  return Array.from(playerIds);
}

/**
 * Retorna os IDs dos jogadores cujas unidades podem ver QUALQUER uma das posições fornecidas
 * Útil para eventos de movimento (posição origem OU destino)
 * @param allUnits - Todas as unidades da batalha
 * @param positions - Array de posições {x, y} para verificar
 * @returns Array de IDs de jogadores com visão em pelo menos uma posição
 */
export function getPlayersWithVisionAtAny(
  allUnits: BattleUnit[],
  positions: Array<{ x: number; y: number }>
): string[] {
  const playerIds = new Set<string>();

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
        break; // Já viu uma posição, não precisa verificar as outras
      }
    }
  }

  return Array.from(playerIds);
}

/**
 * Verifica se um jogador específico tem visão de uma posição
 * @param allUnits - Todas as unidades da batalha
 * @param playerId - ID do jogador para verificar
 * @param targetPosX - Posição X alvo
 * @param targetPosY - Posição Y alvo
 * @returns true se o jogador tem visão da posição
 */
export function playerHasVisionAt(
  allUnits: BattleUnit[],
  playerId: string,
  targetPosX: number,
  targetPosY: number
): boolean {
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

  return false;
}
