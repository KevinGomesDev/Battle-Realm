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
  console.log(
    `[units.handler] Criando unidades para ${state.players.length} jogadores`
  );

  for (const player of state.players) {
    console.log(`[units.handler] Processando player:`, {
      oderId: player.oderId,
      kingdomId: player.kingdomId,
      playerIndex: player.playerIndex,
    });

    const kingdom = await prisma.kingdom.findUnique({
      where: { id: player.kingdomId },
      include: { regent: true },
    });

    if (!kingdom) {
      console.log(
        `[units.handler] Kingdom não encontrado: ${player.kingdomId}`
      );
      continue;
    }

    console.log(`[units.handler] Kingdom encontrado:`, {
      id: kingdom.id,
      name: kingdom.name,
      hasRegent: !!kingdom.regent,
    });

    const units = await createBattleUnitsForBattle(
      { ...kingdom },
      player.oderId,
      player.playerIndex,
      state.gridWidth,
      state.gridHeight
    );

    console.log(
      `[units.handler] Unidades criadas para ${player.oderId}:`,
      units.map((u) => ({ id: u.id, name: u.name, ownerId: u.ownerId }))
    );

    units.forEach((unit) => {
      const schema = BattleUnitSchema.fromBattleUnit(unit);
      state.units.set(unit.id, schema);
      state.actionOrder.push(unit.id);
    });
  }

  console.log(`[units.handler] Total unidades: ${state.units.size}`);
  console.log(`[units.handler] ActionOrder: ${state.actionOrder.length} IDs`);
}
