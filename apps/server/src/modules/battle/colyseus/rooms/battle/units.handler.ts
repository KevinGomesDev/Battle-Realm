// units.handler.ts - Criação de unidades de batalha
import type { BattleSessionState } from "../../schemas";
import { BattleUnitSchema } from "../../schemas";
import { prisma } from "../../../../../lib/prisma";
import { createBattleUnitsForBattle } from "../../../../units/battle-unit.factory";

/**
 * Cria unidades para todos os jogadores
 */
export async function createBattleUnits(
  state: BattleSessionState
): Promise<void> {
  // Coletar posições ocupadas por obstáculos
  const obstaclePositions = new Set<string>();
  for (const obstacle of state.obstacles) {
    // Obstáculos podem ocupar múltiplas células
    const { getObstacleSizeDefinition, getObstacleOccupiedCells } =
      await import("@boundless/shared/config");
    const sizeDef = getObstacleSizeDefinition(obstacle.size);
    const cells = getObstacleOccupiedCells(
      obstacle.posX,
      obstacle.posY,
      obstacle.size
    );
    for (const cell of cells) {
      obstaclePositions.add(`${cell.x},${cell.y}`);
    }
  }

  // Coletar posições já ocupadas por unidades
  const unitPositions = new Set<string>();

  for (const player of state.players) {
    const kingdom = await prisma.kingdom.findUnique({
      where: { id: player.kingdomId },
      include: { regent: true },
    });

    if (!kingdom) {
      continue;
    }

    const units = await createBattleUnitsForBattle(
      { ...kingdom },
      player.oderId,
      player.playerIndex,
      state.gridWidth,
      state.gridHeight,
      obstaclePositions,
      unitPositions
    );

    // Adicionar posições das unidades criadas ao set de ocupadas
    for (const unit of units) {
      unitPositions.add(`${unit.posX},${unit.posY}`);
    }

    units.forEach((unit) => {
      const schema = BattleUnitSchema.fromBattleUnit(unit);
      state.units.set(unit.id, schema);
      state.actionOrder.push(unit.id);
    });
  }
}
