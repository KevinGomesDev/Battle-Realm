import { prisma } from "../../lib/prisma";
import { getConditionColorsMap } from "../../logic/conditions";
import {
  ARENA_COLORS,
  HP_CONFIG,
  MAGICAL_PROTECTION_CONFIG,
  PHYSICAL_PROTECTION_CONFIG,
} from "../../../../shared/config/global.config";
import type { ArenaConfig } from "../../../../shared/types/arena.types";
import type {
  BattleObstacle,
  BattleTerrainType,
  TerritorySize,
  WeatherType,
} from "../../../../shared/types/battle.types";
import {
  BATTLE_TERRAIN_DEFINITIONS,
  WEATHER_DEFINITIONS,
} from "../../../../shared/types/battle.types";
import type { BattleUnit } from "../../utils/battle-unit.factory";
import { activeBattles, battleLobbies, userToLobby } from "./battle-state";
import type { Battle, BattleLobby } from "./battle-types";
import { TURN_TIMER_SECONDS } from "./battle-types";

export function createBaseArenaConfig(): Omit<ArenaConfig, "grid" | "map"> {
  return {
    colors: ARENA_COLORS,
    conditionColors: getConditionColorsMap(),
  };
}

export function reconstructArenaConfig(dbBattle: {
  gridWidth: number;
  gridHeight: number;
  weather: string;
  terrainType: string;
  territorySize: string;
  obstacles: string;
}): ArenaConfig {
  const weather = dbBattle.weather as WeatherType;
  const terrainType = dbBattle.terrainType as BattleTerrainType;
  const territorySize = dbBattle.territorySize as TerritorySize;
  const obstacles: BattleObstacle[] = JSON.parse(dbBattle.obstacles || "[]");

  const weatherDef = WEATHER_DEFINITIONS[weather] || WEATHER_DEFINITIONS.SUNNY;
  const terrainDef =
    BATTLE_TERRAIN_DEFINITIONS[terrainType] ||
    BATTLE_TERRAIN_DEFINITIONS.PLAINS;

  return {
    ...createBaseArenaConfig(),
    grid: { width: dbBattle.gridWidth, height: dbBattle.gridHeight },
    map: {
      weather,
      weatherEmoji: weatherDef.emoji,
      weatherName: weatherDef.name,
      weatherEffect: weatherDef.effect,
      weatherCssFilter: weatherDef.cssFilter,
      terrainType,
      terrainName: terrainDef.name,
      territorySize,
      obstacles,
    },
  };
}

export async function saveBattleToDB(battle: Battle): Promise<void> {
  try {
    const mapConfig = battle.config?.map;

    await prisma.battle.upsert({
      where: { id: battle.id },
      update: {
        status: battle.status,
        round: battle.round,
        currentTurnIndex: battle.currentTurnIndex,
        actionOrder: JSON.stringify(battle.actionOrder),
        obstacles: JSON.stringify(mapConfig?.obstacles || []),
        updatedAt: new Date(),
      },
      create: {
        id: battle.id,
        isArena: true,
        lobbyId: battle.lobbyId,
        hostUserId: battle.hostUserId,
        guestUserId: battle.guestUserId,
        hostKingdomId: battle.hostKingdomId,
        guestKingdomId: battle.guestKingdomId,
        status: battle.status,
        gridWidth: battle.gridWidth,
        gridHeight: battle.gridHeight,
        round: battle.round,
        currentTurnIndex: battle.currentTurnIndex,
        actionOrder: JSON.stringify(battle.actionOrder),
        weather: mapConfig?.weather || "SUNNY",
        terrainType: mapConfig?.terrainType || "PLAINS",
        territorySize: mapConfig?.territorySize || "MEDIUM",
        obstacles: JSON.stringify(mapConfig?.obstacles || []),
      },
    });

    for (const unit of battle.units) {
      await prisma.battleUnit.upsert({
        where: { id: unit.id },
        update: {
          posX: unit.posX,
          posY: unit.posY,
          currentHp: unit.currentHp,
          movesLeft: unit.movesLeft,
          actionsLeft: unit.actionsLeft,
          isAlive: unit.isAlive,
          actionMarks: unit.actionMarks,
          protection: unit.physicalProtection,
          protectionBroken: false,
          conditions: JSON.stringify(unit.conditions),
          hasStartedAction: unit.hasStartedAction,
        },
        create: {
          id: unit.id,
          battleId: battle.id,
          userId: unit.ownerId,
          kingdomId: unit.ownerKingdomId,
          name: unit.name,
          avatar: unit.avatar,
          category: unit.category,
          troopSlot: unit.troopSlot,
          level: unit.level,
          classCode: unit.classCode,
          classFeatures: JSON.stringify(unit.classFeatures),
          equipment: JSON.stringify(unit.equipment),
          combat: unit.combat,
          acuity: unit.acuity,
          focus: unit.focus,
          armor: unit.armor,
          vitality: unit.vitality,
          damageReduction: unit.damageReduction || 0,
          currentHp: unit.currentHp,
          posX: unit.posX,
          posY: unit.posY,
          movesLeft: unit.movesLeft,
          actionsLeft: unit.actionsLeft,
          isAlive: unit.isAlive,
          actionMarks: unit.actionMarks,
          protection: unit.physicalProtection,
          protectionBroken: false,
          conditions: JSON.stringify(unit.conditions),
          hasStartedAction: unit.hasStartedAction,
          actions: JSON.stringify(unit.actions),
          size: unit.size || "NORMAL",
          visionRange: unit.visionRange || 10,
        },
      });
    }

    console.log(`[ARENA] Batalha ${battle.id} salva no banco`);
  } catch (err) {
    console.error("[ARENA] Erro ao salvar batalha no banco:", err);
  }
}

export async function saveLobbyToDB(lobby: BattleLobby): Promise<void> {
  try {
    const hostKingdom = await prisma.kingdom.findUnique({
      where: { id: lobby.hostKingdomId },
      include: { owner: true },
    });

    let guestKingdom = null;
    if (lobby.guestKingdomId) {
      guestKingdom = await prisma.kingdom.findUnique({
        where: { id: lobby.guestKingdomId },
        include: { owner: true },
      });
    }

    await prisma.arenaLobby.upsert({
      where: { id: lobby.lobbyId },
      update: {
        hostSocketId: lobby.hostSocketId,
        guestUserId: lobby.guestUserId,
        guestSocketId: lobby.guestSocketId || null,
        guestKingdomId: lobby.guestKingdomId,
        guestUsername: guestKingdom?.owner?.username,
        guestKingdomName: guestKingdom?.name,
        status: lobby.status,
        updatedAt: new Date(),
      },
      create: {
        id: lobby.lobbyId,
        hostUserId: lobby.hostUserId,
        hostSocketId: lobby.hostSocketId,
        hostKingdomId: lobby.hostKingdomId,
        hostUsername: hostKingdom?.owner?.username || "",
        hostKingdomName: hostKingdom?.name || "",
        guestUserId: lobby.guestUserId,
        guestSocketId: lobby.guestSocketId,
        guestKingdomId: lobby.guestKingdomId,
        guestUsername: guestKingdom?.owner?.username,
        guestKingdomName: guestKingdom?.name,
        status: lobby.status,
        createdAt: lobby.createdAt,
      },
    });
    console.log(`[ARENA] Lobby ${lobby.lobbyId} salvo no banco`);
  } catch (err) {
    console.error("[ARENA] Erro ao salvar lobby no banco:", err);
  }
}

export async function deleteLobbyFromDB(lobbyId: string): Promise<void> {
  try {
    await prisma.arenaLobby.delete({ where: { id: lobbyId } });
    console.log(`[ARENA] Lobby ${lobbyId} deletado do banco`);
  } catch (err) {
    if ((err as any).code !== "P2025") {
      console.error("[ARENA] Erro ao deletar lobby do banco:", err);
    }
  }
}

export async function loadLobbiesFromDB(): Promise<void> {
  try {
    const dbLobbies = await prisma.arenaLobby.findMany({
      where: { status: { in: ["WAITING", "READY", "BATTLING"] } },
    });

    for (const dbLobby of dbLobbies) {
      const lobby: BattleLobby = {
        lobbyId: dbLobby.id,
        hostUserId: dbLobby.hostUserId,
        hostSocketId: dbLobby.hostSocketId,
        hostKingdomId: dbLobby.hostKingdomId,
        guestUserId: dbLobby.guestUserId || undefined,
        guestSocketId: dbLobby.guestSocketId || undefined,
        guestKingdomId: dbLobby.guestKingdomId || undefined,
        status: dbLobby.status as "WAITING" | "READY" | "BATTLING" | "ENDED",
        createdAt: dbLobby.createdAt,
      };

      battleLobbies.set(lobby.lobbyId, lobby);
      userToLobby.set(lobby.hostUserId, lobby.lobbyId);
      if (lobby.guestUserId) {
        userToLobby.set(lobby.guestUserId, lobby.lobbyId);
      }
    }

    console.log(`[ARENA] ${dbLobbies.length} lobbies carregados do banco`);
  } catch (err) {
    console.error("[ARENA] Erro ao carregar lobbies do banco:", err);
  }
}

export async function deleteBattleFromDB(battleId: string): Promise<void> {
  try {
    // Primeiro deletar as unidades associadas
    await prisma.battleUnit.deleteMany({ where: { battleId } });

    // Usar deleteMany ao invés de delete para evitar erro se não existir
    const result = await prisma.battle.deleteMany({ where: { id: battleId } });

    if (result.count > 0) {
      console.log(`[ARENA] Batalha ${battleId} deletada do banco`);
    } else {
      console.log(
        `[ARENA] Batalha ${battleId} não encontrada no banco (já deletada ou nunca persistida)`
      );
    }
  } catch (err) {
    console.error("[ARENA] Erro ao deletar batalha do banco:", err);
  }
}

export async function updateUserStats(
  winnerId: string | null | undefined,
  loserId: string | null | undefined,
  isArena: boolean
): Promise<void> {
  try {
    if (winnerId && loserId && winnerId === loserId) {
      console.error(
        `[STATS] ❌ ERRO: winnerId e loserId são iguais! (${winnerId})`
      );
      return;
    }

    if (winnerId) {
      if (isArena) {
        await prisma.user.update({
          where: { id: winnerId },
          data: { arenaWins: { increment: 1 } },
        });
      } else {
        await prisma.user.update({
          where: { id: winnerId },
          data: { matchWins: { increment: 1 } },
        });
      }
      console.log(`[STATS] ${winnerId} ganhou +1 vitória (arena=${isArena})`);
    }

    if (loserId) {
      if (isArena) {
        await prisma.user.update({
          where: { id: loserId },
          data: { arenaLosses: { increment: 1 } },
        });
      } else {
        await prisma.user.update({
          where: { id: loserId },
          data: { matchLosses: { increment: 1 } },
        });
      }
      console.log(`[STATS] ${loserId} ganhou +1 derrota (arena=${isArena})`);
    }
  } catch (err) {
    console.error("[STATS] Erro ao atualizar estatísticas:", err);
  }
}

export async function loadBattlesFromDB(): Promise<void> {
  try {
    const dbActiveBattles = await prisma.battle.findMany({
      where: { isArena: true, status: "ACTIVE" },
      include: { units: true },
    });

    for (const dbBattle of dbActiveBattles) {
      const units: BattleUnit[] = dbBattle.units.map((u) => ({
        id: u.id,
        sourceUnitId: u.unitId || "",
        ownerId: u.userId || "",
        ownerKingdomId: u.kingdomId || "",
        name: u.name,
        avatar: u.avatar ?? undefined,
        category: u.category,
        troopSlot: u.troopSlot ?? undefined,
        level: u.level,
        classCode: u.classCode ?? undefined,
        classFeatures: JSON.parse(u.classFeatures || "[]"),
        equipment: JSON.parse(u.equipment || "[]"),
        combat: u.combat,
        acuity: u.acuity,
        focus: u.focus,
        armor: u.armor,
        vitality: u.vitality,
        damageReduction: u.damageReduction,
        currentHp: u.currentHp,
        maxHp: u.vitality * HP_CONFIG.multiplier,
        posX: u.posX,
        posY: u.posY,
        initiative: u.initiative,
        movesLeft: u.movesLeft,
        actionsLeft: u.actionsLeft,
        isAlive: u.isAlive,
        actionMarks: u.actionMarks,
        physicalProtection:
          u.protection || u.armor * PHYSICAL_PROTECTION_CONFIG.multiplier,
        maxPhysicalProtection: u.armor * PHYSICAL_PROTECTION_CONFIG.multiplier,
        magicalProtection: u.focus * MAGICAL_PROTECTION_CONFIG.multiplier,
        maxMagicalProtection: u.focus * MAGICAL_PROTECTION_CONFIG.multiplier,
        conditions: JSON.parse(u.conditions),
        hasStartedAction: u.hasStartedAction,
        actions: JSON.parse(u.actions),
        // Campos de tamanho e visão (lidos do banco ou default)
        size:
          (u.size as "NORMAL" | "LARGE" | "HUGE" | "GARGANTUAN") || "NORMAL",
        visionRange: u.visionRange ?? Math.max(10, u.focus),
      }));

      const battle: Battle = {
        id: dbBattle.id,
        lobbyId: dbBattle.lobbyId || "",
        gridWidth: dbBattle.gridWidth,
        gridHeight: dbBattle.gridHeight,
        round: dbBattle.round,
        currentTurnIndex: dbBattle.currentTurnIndex,
        status: dbBattle.status as "ACTIVE" | "ENDED",
        turnTimer: TURN_TIMER_SECONDS,
        actionOrder: JSON.parse(dbBattle.actionOrder),
        units,
        createdAt: dbBattle.createdAt,
        config: reconstructArenaConfig(dbBattle),
        roundActionsCount: new Map<string, number>([
          [dbBattle.hostUserId || "", 0],
          [dbBattle.guestUserId || "", 0],
        ]),
        hostUserId: dbBattle.hostUserId || "",
        guestUserId: dbBattle.guestUserId || "",
        hostKingdomId: dbBattle.hostKingdomId || "",
        guestKingdomId: dbBattle.guestKingdomId || "",
        isArena: true,
      };

      activeBattles.set(battle.id, battle);

      if (dbBattle.lobbyId) {
        const lobbyId = dbBattle.lobbyId;
        if (!battleLobbies.has(lobbyId)) {
          const lobby: BattleLobby = {
            lobbyId,
            hostUserId: battle.hostUserId,
            hostSocketId: "",
            hostKingdomId: battle.hostKingdomId,
            guestUserId: battle.guestUserId,
            guestSocketId: "",
            guestKingdomId: battle.guestKingdomId,
            status: "BATTLING",
            createdAt: battle.createdAt,
          };
          battleLobbies.set(lobbyId, lobby);
        }
        if (battle.hostUserId) {
          userToLobby.set(battle.hostUserId, lobbyId);
        }
        if (battle.guestUserId) {
          userToLobby.set(battle.guestUserId, lobbyId);
        }
      }

      console.log(`[ARENA] Batalha ${battle.id} carregada do banco`);
    }

    console.log(`[ARENA] ${activeBattles.size} batalhas carregadas do banco`);
    console.log(`[ARENA] ${battleLobbies.size} lobbies recriados`);
    console.log(`[ARENA] ${userToLobby.size} usuários mapeados para lobbies`);
  } catch (err) {
    console.error("[ARENA] Erro ao carregar batalhas do banco:", err);
  }
}

export async function cleanupDuplicateBattles(): Promise<void> {
  try {
    const activeBattlesDB = await prisma.battle.findMany({
      where: { isArena: true, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });

    const battlesByUserPair = new Map<string, typeof activeBattlesDB>();

    for (const battle of activeBattlesDB) {
      const users = [battle.hostUserId, battle.guestUserId]
        .filter(Boolean)
        .sort();
      const key = users.join("_");

      if (!battlesByUserPair.has(key)) {
        battlesByUserPair.set(key, []);
      }
      battlesByUserPair.get(key)!.push(battle);
    }

    let deletedCount = 0;
    for (const battles of battlesByUserPair.values()) {
      if (battles.length > 1) {
        const toDelete = battles.slice(1);
        for (const battle of toDelete) {
          console.log(
            `[ARENA] Deletando batalha duplicada ${battle.id} (usuários: ${[
              battle.hostUserId,
              battle.guestUserId,
            ]})`
          );
          await prisma.battleUnit.deleteMany({
            where: { battleId: battle.id },
          });
          await prisma.battle.delete({ where: { id: battle.id } });
          deletedCount++;
        }
      }
    }

    if (deletedCount > 0) {
      console.log(`[ARENA] ${deletedCount} batalhas duplicadas removidas`);
    }
  } catch (err) {
    console.error("[ARENA] Erro ao limpar batalhas duplicadas:", err);
  }
}

export async function bootstrapArenaPersistence(): Promise<void> {
  await cleanupDuplicateBattles();
  await loadLobbiesFromDB();
  await loadBattlesFromDB();
}
