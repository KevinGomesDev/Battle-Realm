// units.handler.ts - Criação de unidades de batalha
import type { BattleSessionState, BattlePlayerSchema } from "../../schemas";
import { BattleUnitSchema } from "../../schemas";
import { prisma } from "../../../../../lib/prisma";
import {
  createBattleUnitsForBattle,
  createBotUnitsFromTemplate,
  createBattleUnit,
} from "../../../../units/battle-unit.factory";
import {
  KINGDOM_TEMPLATES,
  resolveKingdomTemplate,
} from "@boundless/shared/data/kingdoms.data";

/**
 * Cria unidades para todos os jogadores
 */
export async function createBattleUnits(
  state: BattleSessionState,
  createBotUnitsFn: (botPlayer: BattlePlayerSchema) => Promise<void>
): Promise<void> {
  for (const player of state.players) {
    if (player.isBot) {
      await createBotUnitsFn(player);
      continue;
    }

    const kingdom = await prisma.kingdom.findUnique({
      where: { id: player.kingdomId },
      include: { regent: true },
    });

    if (!kingdom) continue;

    const units = await createBattleUnitsForBattle(
      { ...kingdom },
      player.oderId,
      player.playerIndex,
      state.gridWidth,
      state.gridHeight
    );

    units.forEach((unit) => {
      const schema = BattleUnitSchema.fromBattleUnit(unit);
      state.units.set(unit.id, schema);
      state.actionOrder.push(unit.id);
    });
  }
}

/**
 * Cria unidades para o bot
 */
export async function createBotUnits(
  state: BattleSessionState,
  botPlayer: BattlePlayerSchema
): Promise<void> {
  console.log(
    `[BattleRoom] 🤖 createBotUnits chamado para player:`,
    botPlayer.oderId
  );

  const randomTemplate =
    KINGDOM_TEMPLATES[Math.floor(Math.random() * KINGDOM_TEMPLATES.length)];
  const resolvedTemplate = resolveKingdomTemplate(randomTemplate);

  if (!resolvedTemplate) {
    console.error(
      `[BattleRoom] ❌ Falha ao resolver template ${randomTemplate.id}`
    );
    return;
  }

  console.log(
    `[BattleRoom] 🤖 Bot usando template: ${resolvedTemplate.name} (${resolvedTemplate.race})`
  );

  botPlayer.kingdomName = `🤖 ${resolvedTemplate.name}`;

  const botKingdom = {
    id: botPlayer.kingdomId,
    name: resolvedTemplate.name,
    race: resolvedTemplate.race,
  };

  const dbUnits = createBotUnitsFromTemplate(
    randomTemplate,
    botPlayer.oderId,
    botKingdom
  );

  if (dbUnits.length === 0) {
    console.error(`[BattleRoom] ❌ Nenhuma unidade criada para o bot`);
    return;
  }

  const startX = state.gridWidth - 2;
  const startY = Math.floor(state.gridHeight / 2);

  dbUnits.forEach((dbUnit, index) => {
    const position = { x: startX, y: startY + index };

    const battleUnit = createBattleUnit(
      dbUnit,
      botPlayer.oderId,
      botKingdom,
      position,
      "battle"
    );

    battleUnit.isAIControlled = true;

    const schema = BattleUnitSchema.fromBattleUnit(battleUnit);
    state.units.set(battleUnit.id, schema);
    state.actionOrder.push(battleUnit.id);

    console.log(`[BattleRoom] 🤖 Bot unit criado:`, {
      id: battleUnit.id,
      name: battleUnit.name,
      race: battleUnit.race,
      combat: battleUnit.combat,
      speed: battleUnit.speed,
      maxHp: battleUnit.maxHp,
      spells: battleUnit.spells,
      features: battleUnit.features,
      isAIControlled: battleUnit.isAIControlled,
      posX: position.x,
      posY: position.y,
    });
  });

  console.log(
    `[BattleRoom] 🤖 Total de unidades bot criadas: ${dbUnits.length}`
  );
}

/**
 * Adiciona um jogador bot ao lobby
 */
export function addBotPlayer(state: BattleSessionState): BattlePlayerSchema {
  console.log(`[BattleRoom] addBotPlayer() chamado`);
  const { BattlePlayerSchema: PlayerSchema } = require("../schemas");
  const { PLAYER_COLORS } = require("./types");

  const botPlayer = new PlayerSchema();
  botPlayer.oderId = `bot_${Date.now()}`;
  botPlayer.kingdomId = `bot_kingdom_${Date.now()}`;
  botPlayer.kingdomName = "Reino do Bot";
  botPlayer.username = "Bot";
  botPlayer.playerIndex = state.players.length;
  botPlayer.playerColor =
    PLAYER_COLORS[botPlayer.playerIndex % PLAYER_COLORS.length];
  botPlayer.isConnected = true;
  botPlayer.isBot = true;

  state.players.push(botPlayer);

  return botPlayer;
}
