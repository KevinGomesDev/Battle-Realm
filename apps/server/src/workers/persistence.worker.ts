// workers/persistence.worker.ts
// Worker de persistência periódica de batalhas e partidas
// Roda a cada 30 segundos e persiste todas as sessões ativas que tiveram mudanças

import { matchMaker } from "@colyseus/core";
import { prisma } from "../lib/prisma";
import type { BattleSessionState } from "../modules/battle/colyseus/schemas";
import type {
  BattlePlayerSchema,
  BattleUnitSchema,
  BattleObstacleSchema,
} from "../modules/battle/colyseus/schemas";

// Intervalo de persistência (30 segundos)
const PERSISTENCE_INTERVAL = 30000;

// Cache de hashes para detectar mudanças
const battleStateHashes = new Map<string, string>();

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

/**
 * Gera um hash simples do estado da batalha para detectar mudanças
 */
function generateBattleStateHash(state: BattleSessionState): string {
  const stateSnapshot = {
    status: state.status,
    round: state.round,
    currentTurnIndex: state.currentTurnIndex,
    activeUnitId: state.activeUnitId,
    currentPlayerId: state.currentPlayerId,
    winnerId: state.winnerId,
    unitLocked: state.unitLocked,
    // Hash das unidades (posições, HP, mana, condições, etc.)
    units: Array.from(state.units.values()).map((u: BattleUnitSchema) => ({
      id: u.id,
      posX: u.posX,
      posY: u.posY,
      currentHp: u.currentHp,
      currentMana: u.currentMana,
      movesLeft: u.movesLeft,
      actionsLeft: u.actionsLeft,
      isAlive: u.isAlive,
      conditions: Array.from(u.conditions || []).join(","),
      physicalProtection: u.physicalProtection,
      magicalProtection: u.magicalProtection,
    })),
    // Hash dos obstáculos
    obstacles: Array.from(state.obstacles)
      .filter((o): o is BattleObstacleSchema => !!o)
      .map((o) => ({
        id: o.id,
        hp: o.hp,
        destroyed: o.destroyed,
      })),
  };

  return JSON.stringify(stateSnapshot);
}

/**
 * Serializa completamente uma unidade para persistência
 */
function serializeUnit(unit: BattleUnitSchema): Record<string, any> {
  // Converter cooldowns de MapSchema para objeto
  const cooldowns: Record<string, number> = {};
  unit.unitCooldowns?.forEach((value: number, key: string) => {
    cooldowns[key] = value;
  });

  // Converter activeEffects de MapSchema para objeto
  const activeEffects: Record<string, any> = {};
  unit.activeEffects?.forEach((effect: any, key: string) => {
    activeEffects[key] = {
      key: effect.key,
      value: effect.value,
      sources: effect.sources,
    };
  });

  return {
    unitBattleId: unit.id, // ID da unidade na batalha
    unitId: unit.sourceUnitId || null, // Prisma usa unitId, não sourceUnitId
    userId: unit.ownerId || null,
    kingdomId: unit.ownerKingdomId || null,
    ownerId: null,
    name: unit.name,
    avatar: unit.avatar || null,
    category: unit.category,
    troopSlot: unit.troopSlot >= 0 ? unit.troopSlot : null,
    level: unit.level,
    race: unit.race || null,
    classCode: unit.classCode || null,
    features: JSON.stringify(Array.from(unit.features || [])),
    equipment: JSON.stringify(Array.from(unit.equipment || [])),
    spells: JSON.stringify(Array.from(unit.spells || [])),
    combat: unit.combat,
    speed: unit.speed,
    focus: unit.focus,
    resistance: unit.resistance,
    will: unit.will,
    vitality: unit.vitality,
    damageReduction: unit.damageReduction || 0,
    maxHp: unit.maxHp,
    currentHp: unit.currentHp,
    maxMana: unit.maxMana || 0,
    currentMana: unit.currentMana || 0,
    posX: unit.posX,
    posY: unit.posY,
    movesLeft: unit.movesLeft,
    actionsLeft: unit.actionsLeft,
    attacksLeftThisTurn: unit.attacksLeftThisTurn || 0,
    isAlive: unit.isAlive,
    actionMarks: unit.actionMarks || 0,
    physicalProtection: unit.physicalProtection || 0,
    maxPhysicalProtection: unit.maxPhysicalProtection || 0,
    magicalProtection: unit.magicalProtection || 0,
    maxMagicalProtection: unit.maxMagicalProtection || 0,
    conditions: JSON.stringify(Array.from(unit.conditions || [])),
    grabbedByBattleUnitId: unit.grabbedByUnitId || null,
    hasStartedAction: unit.hasStartedAction || false,
    isAIControlled: unit.isAIControlled || false,
    aiBehavior: unit.aiBehavior || "AGGRESSIVE",
    size: unit.size || "MEDIUM",
    visionRange: unit.visionRange || 10,
    unitCooldowns: JSON.stringify(cooldowns),
    activeEffects: JSON.stringify(activeEffects),
    // === NEMESIS SYSTEM ===
    nemesisId: unit.nemesisId || null,
    isNemesis: unit.isNemesis || false,
    nemesisRank: unit.nemesisRank || null,
    nemesisPowerLevel: unit.nemesisPowerLevel || 0,
    nemesisTraits: JSON.stringify(Array.from(unit.nemesisTraits || [])),
    nemesisFears: JSON.stringify(Array.from(unit.nemesisFears || [])),
    nemesisStrengths: JSON.stringify(Array.from(unit.nemesisStrengths || [])),
    nemesisScars: JSON.stringify(Array.from(unit.nemesisScars || [])),
    nemesisTitle: unit.nemesisTitle || null,
    nemesisKillCount: unit.nemesisKillCount || 0,
    nemesisTargetPlayer: unit.nemesisTargetPlayer || null,
  };
}

/**
 * Serializa completamente os obstáculos para persistência
 */
function serializeObstacles(obstacles: any[]): any[] {
  return obstacles.map((obs: BattleObstacleSchema) => ({
    id: obs.id,
    posX: obs.posX,
    posY: obs.posY,
    type: obs.type,
    size: obs.size || "SMALL",
    hp: obs.hp,
    maxHp: obs.maxHp,
    destroyed: obs.destroyed,
  }));
}

/**
 * Serializa os jogadores para persistência
 */
function serializePlayers(players: any[]): {
  playerIds: string[];
  kingdomIds: string[];
  playerColors: string[];
} {
  const playerIds: string[] = [];
  const kingdomIds: string[] = [];
  const playerColors: string[] = [];

  players.forEach((player: BattlePlayerSchema) => {
    playerIds.push(player.oderId);
    kingdomIds.push(player.kingdomId);
    playerColors.push(player.playerColor);
  });

  return { playerIds, kingdomIds, playerColors };
}

/**
 * Persiste uma batalha completamente no banco de dados
 * Exportada para ser usada pelo BattleRoom no onDispose e na criação inicial
 * @param battleId - ID da batalha
 * @param state - Estado da batalha
 * @param statusOverride - Status opcional (default: "PAUSED" para persistência periódica, "ACTIVE" para criação inicial)
 */
export async function persistBattle(
  battleId: string,
  state: BattleSessionState,
  statusOverride?: "ACTIVE" | "PAUSED" | "FINISHED"
): Promise<void> {
  const { playerIds, kingdomIds, playerColors } = serializePlayers(
    Array.from(state.players)
  );

  const unitsData = Array.from(state.units.values()).map(serializeUnit);
  const obstaclesData = serializeObstacles(Array.from(state.obstacles));

  // Usar status do state ou o override, default para "PAUSED"
  const status = statusOverride || "PAUSED";

  // Upsert da batalha
  await prisma.battle.upsert({
    where: { id: battleId },
    create: {
      id: battleId,
      isPvP: true,
      lobbyId: state.lobbyId || null,
      matchId: state.matchId || null,
      status,
      gridWidth: state.gridWidth,
      gridHeight: state.gridHeight,
      round: state.round,
      currentTurnIndex: state.currentTurnIndex || 0,
      actionOrder: JSON.stringify(Array.from(state.actionOrder || [])),
      activeUnitId: state.activeUnitId || null,
      currentPlayerId: state.currentPlayerId || null,
      turnTimer: state.turnTimer || 60,
      winnerId: state.winnerId || null,
      winReason: state.winReason || null,
      ransomPrice: state.ransomPrice || null,
      ransomResource: state.ransomResource || null,
      terrainType: state.config?.map?.terrainType || "PLAINS",
      territorySize: "MEDIUM",
      obstacles: JSON.stringify(obstaclesData),
      maxPlayers: state.maxPlayers || 2,
      playerIds: JSON.stringify(playerIds),
      kingdomIds: JSON.stringify(kingdomIds),
      playerColors: JSON.stringify(playerColors),
    },
    update: {
      status,
      round: state.round,
      currentTurnIndex: state.currentTurnIndex || 0,
      actionOrder: JSON.stringify(Array.from(state.actionOrder || [])),
      activeUnitId: state.activeUnitId || null,
      currentPlayerId: state.currentPlayerId || null,
      turnTimer: state.turnTimer || 60,
      winnerId: state.winnerId || null,
      winReason: state.winReason || null,
      ransomPrice: state.ransomPrice || null,
      ransomResource: state.ransomResource || null,
      obstacles: JSON.stringify(obstaclesData),
      playerIds: JSON.stringify(playerIds),
      kingdomIds: JSON.stringify(kingdomIds),
      playerColors: JSON.stringify(playerColors),
      updatedAt: new Date(),
    },
  });

  // Atualizar unidades: deletar antigas e criar novas
  await prisma.battleUnit.deleteMany({ where: { battleId } });
  if (unitsData.length > 0) {
    await prisma.battleUnit.createMany({
      data: unitsData.map((u) => ({ ...u, battleId })),
    });
  }
}

/**
 * Persiste todas as batalhas ativas que tiveram mudanças
 */
async function persistAllBattles(): Promise<void> {
  try {
    const battleRooms = await matchMaker.query({ name: "battle" });

    let persistedCount = 0;
    let skippedCount = 0;
    let unchangedCount = 0;

    for (const roomListing of battleRooms) {
      try {
        const room = matchMaker.getRoomById(roomListing.roomId);
        if (!room) {
          skippedCount++;
          continue;
        }

        const state = room.state as BattleSessionState;

        // Só persistir batalhas ativas (não lobbies ou finalizadas)
        if (state.status !== "ACTIVE" || state.winnerId) {
          skippedCount++;
          continue;
        }

        // Verificar se houve mudanças desde a última persistência
        const currentHash = generateBattleStateHash(state);
        const previousHash = battleStateHashes.get(roomListing.roomId);

        if (previousHash === currentHash) {
          unchangedCount++;
          continue;
        }

        // Persistir a batalha
        await persistBattle(roomListing.roomId, state);

        // Atualizar o hash
        battleStateHashes.set(roomListing.roomId, currentHash);

        persistedCount++;
      } catch (error) {
        console.error(
          `[PersistenceWorker] Erro ao persistir batalha ${roomListing.roomId}:`,
          error
        );
      }
    }

    // Limpar hashes de batalhas que não existem mais
    const activeRoomIds = new Set(battleRooms.map((r) => r.roomId));
    for (const roomId of battleStateHashes.keys()) {
      if (!activeRoomIds.has(roomId)) {
        battleStateHashes.delete(roomId);
      }
    }

    if (persistedCount > 0 || unchangedCount > 0) {
    }
  } catch (error) {
    console.error("[PersistenceWorker] Erro ao buscar batalhas:", error);
  }
}

/**
 * Persiste todas as partidas (matches) ativas
 * Match já usa o banco diretamente como fonte de verdade,
 * então não precisa de persistência adicional aqui
 */
async function persistAllMatches(): Promise<void> {
  // Match usa o banco diretamente, não precisa de persistência adicional
  // Os handlers de Match já chamam prisma.match.update quando necessário
}

/**
 * Executa um ciclo de persistência
 */
async function runPersistenceCycle(): Promise<void> {
  if (!isRunning) return;

  const startTime = Date.now();

  await Promise.all([persistAllBattles(), persistAllMatches()]);

  const duration = Date.now() - startTime;
  if (duration > 5000) {
    console.warn(
      `[PersistenceWorker] Ciclo de persistência demorou ${duration}ms`
    );
  }
}

/**
 * Inicia o worker de persistência
 */
export function startPersistenceWorker(): void {
  if (isRunning) {
    console.warn("[PersistenceWorker] Worker já está rodando");
    return;
  }

  isRunning = true;

  // Configurar intervalo (não executa imediatamente para dar tempo do servidor estabilizar)
  intervalId = setInterval(() => {
    runPersistenceCycle();
  }, PERSISTENCE_INTERVAL);
}

/**
 * Para o worker de persistência
 */
export function stopPersistenceWorker(): void {
  if (!isRunning) return;

  isRunning = false;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Força uma persistência imediata de todas as sessões (ignora cache de hash)
 * Útil para chamar antes de desligar o servidor
 */
export async function forcePeristAll(): Promise<void> {
  // Limpar cache de hashes para forçar persistência
  battleStateHashes.clear();

  await Promise.all([persistAllBattles(), persistAllMatches()]);
}
