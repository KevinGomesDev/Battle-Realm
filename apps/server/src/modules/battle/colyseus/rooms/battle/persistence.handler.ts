// persistence.handler.ts - Persistência e restauração de batalhas
import type { BattleSessionState, BattlePlayerSchema } from "../../schemas";
import {
  BattleObstacleSchema,
  BattleUnitSchema,
  BattleConfigSchema,
  BattleMapConfigSchema,
  BattlePlayerSchema as PlayerSchema,
} from "../../schemas";
import { prisma } from "../../../../../lib/prisma";
import {
  saveBattleSession,
  loadBattle,
  deleteBattle,
} from "../../../../match/services/battle-persistence.service";
import { PLAYER_COLORS } from "./types";

/**
 * Restaura uma batalha do banco de dados
 */
export async function restoreFromDatabase(
  battleId: string,
  state: BattleSessionState,
  setMetadata: (metadata: Record<string, any>) => void
): Promise<boolean> {
  try {
    const persistedBattle = await loadBattle(battleId);
    if (!persistedBattle) {
      return false;
    }

    // Inicializar estado
    state.battleId = battleId;
    state.lobbyId = persistedBattle.lobbyId || battleId;
    state.status = "ACTIVE";
    state.round = persistedBattle.round;
    state.gridWidth = persistedBattle.gridWidth;
    state.gridHeight = persistedBattle.gridHeight;
    state.maxPlayers = persistedBattle.maxPlayers;
    state.currentTurnIndex = persistedBattle.currentTurnIndex;

    // Restaurar actionOrder
    persistedBattle.actionOrder.forEach((id) => {
      state.actionOrder.push(id);
    });

    // Restaurar config
    if (!state.config) {
      state.config = new BattleConfigSchema();
    }
    if (!state.config.map) {
      state.config.map = new BattleMapConfigSchema();
    }
    state.config.map.terrainType = persistedBattle.terrainType;

    // Restaurar obstáculos
    for (const obs of persistedBattle.obstacles) {
      const obstacle = new BattleObstacleSchema();
      obstacle.id = obs.id;
      obstacle.posX = obs.posX;
      obstacle.posY = obs.posY;
      obstacle.type = obs.type;
      obstacle.hp = obs.hp;
      obstacle.maxHp = obs.maxHp;
      obstacle.destroyed = obs.destroyed ?? false;
      state.obstacles.push(obstacle);
    }

    // Restaurar jogadores
    for (let i = 0; i < persistedBattle.playerIds.length; i++) {
      const player = new PlayerSchema();
      player.oderId = persistedBattle.playerIds[i];
      player.kingdomId = persistedBattle.kingdomIds[i] || "";
      player.playerIndex = i;
      player.playerColor = persistedBattle.playerColors[i] || PLAYER_COLORS[i];
      player.isConnected = false;
      player.isBot = player.oderId.startsWith("bot_");

      const kingdom = await prisma.kingdom.findUnique({
        where: { id: player.kingdomId },
        include: { owner: true },
      });
      player.kingdomName = kingdom?.name || "Reino";
      player.username = kingdom?.owner?.username || "Player";

      state.players.push(player);
    }

    // Restaurar unidades
    for (const unit of persistedBattle.units) {
      const battleUnit = new BattleUnitSchema();
      battleUnit.id = unit.id;
      battleUnit.sourceUnitId = unit.sourceUnitId || "";
      battleUnit.ownerId = unit.ownerId || "";
      battleUnit.ownerKingdomId = unit.ownerKingdomId || "";
      battleUnit.name = unit.name;
      battleUnit.avatar = unit.avatar || "";
      battleUnit.category = unit.category;
      battleUnit.troopSlot = unit.troopSlot ?? -1;
      battleUnit.level = unit.level;
      battleUnit.race = unit.race || "";
      battleUnit.classCode = unit.classCode || "";
      battleUnit.combat = unit.combat;
      battleUnit.speed = unit.speed;
      battleUnit.focus = unit.focus;
      battleUnit.resistance = unit.resistance;
      battleUnit.will = unit.will;
      battleUnit.vitality = unit.vitality;
      battleUnit.damageReduction = unit.damageReduction;
      battleUnit.maxHp = unit.maxHp;
      battleUnit.currentHp = unit.currentHp;
      battleUnit.maxMana = unit.maxMana;
      battleUnit.currentMana = unit.currentMana;
      battleUnit.posX = unit.posX;
      battleUnit.posY = unit.posY;
      battleUnit.movesLeft = unit.movesLeft;
      battleUnit.actionsLeft = unit.actionsLeft;
      battleUnit.attacksLeftThisTurn = unit.attacksLeftThisTurn;
      battleUnit.isAlive = unit.isAlive;
      battleUnit.actionMarks = unit.actionMarks;
      battleUnit.physicalProtection = unit.physicalProtection;
      battleUnit.maxPhysicalProtection = unit.maxPhysicalProtection;
      battleUnit.magicalProtection = unit.magicalProtection;
      battleUnit.maxMagicalProtection = unit.maxMagicalProtection;
      battleUnit.hasStartedAction = unit.hasStartedAction;
      battleUnit.grabbedByUnitId = unit.grabbedByUnitId || "";
      battleUnit.isAIControlled = unit.isAIControlled;
      battleUnit.aiBehavior = unit.aiBehavior || "AGGRESSIVE";
      battleUnit.size = unit.size;
      battleUnit.visionRange = unit.visionRange;

      unit.features.forEach((f) => battleUnit.features.push(f));
      unit.equipment.forEach((e) => battleUnit.equipment.push(e));
      unit.spells.forEach((s) => battleUnit.spells.push(s));
      unit.conditions.forEach((c) => battleUnit.conditions.push(c));

      Object.entries(unit.unitCooldowns).forEach(([key, value]) => {
        battleUnit.unitCooldowns.set(key, value);
      });

      state.units.set(battleUnit.id, battleUnit);
    }

    // Atualizar metadata
    setMetadata({
      hostUserId: persistedBattle.playerIds[0],
      maxPlayers: persistedBattle.maxPlayers,
      playerCount: persistedBattle.playerIds.length,
      players: persistedBattle.playerIds,
      vsBot: persistedBattle.playerIds.some((id) => id.startsWith("bot_")),
      status: "BATTLING",
    });

    // Deletar do banco (já está na memória agora)
    await deleteBattle(battleId);

    console.log(
      `[BattleRoom] Restauração completa: ${persistedBattle.units.length} unidades, ${persistedBattle.obstacles.length} obstáculos`
    );

    return true;
  } catch (error) {
    console.error(`[BattleRoom] Erro ao restaurar batalha:`, error);
    return false;
  }
}

/**
 * Persiste a batalha no banco de dados
 */
export async function persistBattleToDb(
  roomId: string,
  state: BattleSessionState
): Promise<void> {
  if (state.status !== "ACTIVE") {
    console.log(`[BattleRoom] Não persistindo - batalha não está ativa`);
    return;
  }

  try {
    const playerIds = state.players.map((p: BattlePlayerSchema) => p.oderId);
    const kingdomIds = state.players.map(
      (p: BattlePlayerSchema) => p.kingdomId
    );
    const playerColors = state.players.map(
      (p: BattlePlayerSchema) => p.playerColor
    );

    await saveBattleSession(roomId, state, playerIds, kingdomIds, playerColors);

    console.log(`[BattleRoom] Batalha ${roomId} persistida no banco de dados`);
  } catch (error) {
    console.error(`[BattleRoom] Erro ao persistir batalha:`, error);
  }
}

/**
 * Verifica se todos os jogadores humanos estão desconectados
 */
export function checkAllDisconnected(
  state: BattleSessionState,
  lobbyPhase: boolean,
  onAllDisconnected: () => void
): void {
  if (!lobbyPhase && state.status === "ACTIVE") {
    const humanPlayers = state.players.filter(
      (p: BattlePlayerSchema) => !p.isBot
    );
    const allDisconnected = humanPlayers.every(
      (p: BattlePlayerSchema) => !p.isConnected
    );

    if (allDisconnected && humanPlayers.length > 0) {
      console.log(
        `[BattleRoom] Todos os jogadores desconectaram. Persistindo batalha em 10s...`
      );
      onAllDisconnected();
    }
  }
}
