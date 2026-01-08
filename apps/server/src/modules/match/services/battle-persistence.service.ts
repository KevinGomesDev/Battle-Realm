// server/src/services/battle-persistence.service.ts
// Serviço para persistir e restaurar batalhas/partidas no banco de dados

import { prisma } from "../../../lib/prisma";
import type { BattleSessionState } from "../../battle/colyseus/schemas";
import type { Battle, BattleUnit } from "@prisma/client";

// ============================================
// Types
// ============================================

export interface PersistedBattleState {
  id: string;
  isPvP: boolean;
  lobbyId: string | null;
  matchId: string | null;
  status: string;
  gridWidth: number;
  gridHeight: number;
  round: number;
  currentTurnIndex: number;
  actionOrder: string[];
  winnerId: string | null;
  winReason: string | null;
  terrainType: string;
  territorySize: string;
  obstacles: any[];
  maxPlayers: number;
  playerIds: string[];
  kingdomIds: string[];
  playerColors: string[];
  units: PersistedBattleUnit[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PersistedBattleUnit {
  id: string;
  sourceUnitId: string | null;
  ownerId: string | null;
  ownerKingdomId: string | null;
  name: string;
  avatar: string | null;
  category: string;
  troopSlot: number | null;
  level: number;
  race: string | null;
  classCode: string | null;
  features: string[];
  equipment: string[];
  spells: string[];
  combat: number;
  speed: number;
  focus: number;
  resistance: number;
  will: number;
  vitality: number;
  damageReduction: number;
  maxHp: number;
  currentHp: number;
  maxMana: number;
  currentMana: number;
  posX: number;
  posY: number;
  movesLeft: number;
  actionsLeft: number;
  attacksLeftThisTurn: number;
  isAlive: boolean;
  actionMarks: number;
  physicalProtection: number;
  maxPhysicalProtection: number;
  magicalProtection: number;
  maxMagicalProtection: number;
  conditions: string[];
  grabbedByUnitId: string | null;
  hasStartedAction: boolean;
  isAIControlled: boolean;
  aiBehavior: string | null;
  size: string;
  visionRange: number;
  unitCooldowns: Record<string, number>;
}

// ============================================
// Battle Session Persistence
// ============================================

/**
 * Salva o estado de uma sess�o de batalha no banco de dados
 */
export async function saveBattleSession(
  battleId: string,
  state: BattleSessionState,
  playerIds: string[],
  kingdomIds: string[],
  playerColors: string[]
): Promise<Battle> {
  console.log(`[BattlePersistence] Salvando batalha ${battleId} no banco...`);

  // Converter unidades do Colyseus state para formato de persistência
  const unitsData: Omit<BattleUnit, "id" | "battleId" | "battle">[] = [];

  state.units.forEach((unit) => {
    // Converter cooldowns de MapSchema para objeto
    const cooldowns: Record<string, number> = {};
    unit.unitCooldowns?.forEach((value: number, key: string) => {
      cooldowns[key] = value;
    });

    unitsData.push({
      unitId: null, // Battle units são temporários
      userId: unit.ownerId || null, // Colyseus usa ownerId, Prisma usa userId
      kingdomId: unit.ownerKingdomId || null, // Colyseus usa ownerKingdomId, Prisma usa kingdomId
      ownerId: null,
      name: unit.name,
      avatar: unit.avatar || null,
      category: unit.category,
      troopSlot: unit.troopSlot >= 0 ? unit.troopSlot : null,
      level: unit.level,
      classCode: unit.classCode || null,
      features: JSON.stringify(Array.from(unit.features || [])),
      learnedSkills: JSON.stringify([]), // Não existe no schema, usar features
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
      initiative: 0, // Não existe no schema, calcular depois
      movesLeft: unit.movesLeft,
      actionsLeft: unit.actionsLeft,
      attacksLeftThisTurn: unit.attacksLeftThisTurn || 0,
      isAlive: unit.isAlive,
      actionMarks: unit.actionMarks || 0,
      physicalProtection: unit.physicalProtection || 0,
      magicalProtection: unit.magicalProtection || 0,
      conditions: JSON.stringify(Array.from(unit.conditions || [])),
      grabbedByBattleUnitId: unit.grabbedByUnitId || null, // Colyseus usa grabbedByUnitId
      corpseRemoved: !unit.isAlive && unit.currentHp <= -10, // Inferir do estado
      hasStartedAction: unit.hasStartedAction || false,
      actions: JSON.stringify([]), // Não existe no schema
      isAIControlled: unit.isAIControlled || false,
      size: unit.size || "MEDIUM",
      visionRange: unit.visionRange || 10,
      unitCooldowns: JSON.stringify(cooldowns),
    });
  });

  // Converter obstacles (BattleObstacleSchema não tem blocksMovement/blocksVision, são inferidos pelo type)
  const obstaclesArray: any[] = [];
  state.obstacles.forEach((obs) => {
    obstaclesArray.push({
      id: obs.id,
      posX: obs.posX,
      posY: obs.posY,
      type: obs.type,
      hp: obs.hp,
      maxHp: obs.maxHp,
      destroyed: obs.destroyed,
    });
  });

  // Upsert da batalha (cria ou atualiza)
  const battle = await prisma.battle.upsert({
    where: { id: battleId },
    create: {
      id: battleId,
      isPvP: true,
      lobbyId: state.lobbyId || null,
      matchId: null,
      status: "PAUSED", // Batalha pausada (todos desconectados)
      gridWidth: state.gridWidth,
      gridHeight: state.gridHeight,
      round: state.round,
      currentTurnIndex: state.currentTurnIndex || 0,
      actionOrder: JSON.stringify(Array.from(state.actionOrder || [])),
      winnerId: state.winnerId || null,
      winReason: state.winReason || null,
      terrainType: state.config?.map?.terrainType || "PLAINS",
      territorySize: "MEDIUM",
      obstacles: JSON.stringify(obstaclesArray),
      maxPlayers: state.maxPlayers || 2,
      playerIds: JSON.stringify(playerIds),
      kingdomIds: JSON.stringify(kingdomIds),
      playerColors: JSON.stringify(playerColors),
      units: {
        create: unitsData,
      },
    },
    update: {
      status: "PAUSED",
      round: state.round,
      currentTurnIndex: state.currentTurnIndex || 0,
      actionOrder: JSON.stringify(Array.from(state.actionOrder || [])),
      winnerId: state.winnerId || null,
      winReason: state.winReason || null,
      obstacles: JSON.stringify(obstaclesArray),
      updatedAt: new Date(),
    },
  });

  // Se atualizando, precisamos atualizar as unidades também
  // Primeiro deletamos as antigas e criamos as novas
  if (battle) {
    await prisma.battleUnit.deleteMany({ where: { battleId } });
    await prisma.battleUnit.createMany({
      data: unitsData.map((u) => ({ ...u, battleId })),
    });
  }

  console.log(`[BattlePersistence] Batalha ${battleId} salva com sucesso`);
  return battle;
}

/**
 * Carrega uma batalha do banco de dados
 */
export async function loadBattle(
  battleId: string
): Promise<PersistedBattleState | null> {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: { units: true },
  });

  if (!battle) {
    return null;
  }

  return parseBattleFromDb(battle);
}

/**
 * Busca batalhas ativas/pausadas para um usuário
 */
export async function findActiveBattleForUser(
  userId: string
): Promise<PersistedBattleState | null> {
  // Buscar batalhas pausadas ou ativas onde o usuário participa
  const battles = await prisma.battle.findMany({
    where: {
      status: { in: ["PAUSED", "ACTIVE"] },
      isPvP: true,
    },
    include: { units: true },
    orderBy: { updatedAt: "desc" },
  });

  // Filtrar pela presença do userId no playerIds
  for (const battle of battles) {
    const playerIds = JSON.parse(battle.playerIds || "[]") as string[];
    if (playerIds.includes(userId)) {
      return parseBattleFromDb(battle);
    }
  }

  return null;
}

/**
 * Marca batalha como terminada/removida
 * Não falha se a batalha não existir no banco (pode estar apenas na memória)
 */
export async function markBattleEnded(
  battleId: string,
  winnerId?: string,
  winReason?: string
): Promise<void> {
  try {
    await prisma.battle.update({
      where: { id: battleId },
      data: {
        status: "ENDED",
        winnerId: winnerId || null,
        winReason: winReason || null,
        updatedAt: new Date(),
      },
    });

    console.log(`[BattlePersistence] Batalha ${battleId} marcada como ENDED`);
  } catch (error: any) {
    // Se a batalha não existe no banco, não é um erro crítico
    // (a batalha pode estar apenas na memória)
    if (error?.code === "P2025") {
      console.log(
        `[BattlePersistence] Batalha ${battleId} não encontrada no banco (apenas na memória)`
      );
      return;
    }
    throw error;
  }
}

/**
 * Remove batalha do banco (limpa dados)
 */
export async function deleteBattle(battleId: string): Promise<void> {
  try {
    await prisma.battleUnit.deleteMany({ where: { battleId } });
    await prisma.battle.delete({ where: { id: battleId } });
    console.log(`[BattlePersistence] Batalha ${battleId} deletada do banco`);
  } catch (error) {
    console.error(
      `[BattlePersistence] Erro ao deletar batalha ${battleId}:`,
      error
    );
  }
}

/**
 * Busca todas as batalhas pausadas (para restaurar ao iniciar servidor)
 */
export async function findAllPausedBattles(): Promise<PersistedBattleState[]> {
  const battles = await prisma.battle.findMany({
    where: { status: "PAUSED" },
    include: { units: true },
    orderBy: { updatedAt: "desc" },
  });

  return battles.map(parseBattleFromDb);
}

// ============================================
// Match Persistence (para partidas estratégicas)
// ============================================

/**
 * As partidas (Match) já usam o banco de dados nativo do Prisma.
 * Aqui apenas adicionamos funções auxiliares para pausar/restaurar.
 */

export async function pauseMatch(matchId: string): Promise<void> {
  await prisma.match.update({
    where: { id: matchId },
    data: {
      status: "PAUSED",
      updatedAt: new Date(),
    },
  });

  console.log(`[BattlePersistence] Match ${matchId} pausado`);
}

export async function findActiveMatchForUser(
  userId: string
): Promise<string | null> {
  const matchKingdom = await prisma.matchKingdom.findFirst({
    where: {
      userId,
      match: {
        status: { in: ["WAITING", "PREPARATION", "ACTIVE", "PAUSED"] },
      },
    },
    include: { match: true },
    orderBy: { match: { updatedAt: "desc" } },
  });

  return matchKingdom?.matchId || null;
}

// ============================================
// Helper Functions
// ============================================

function parseBattleFromDb(
  battle: Battle & { units: BattleUnit[] }
): PersistedBattleState {
  return {
    id: battle.id,
    isPvP: battle.isPvP,
    lobbyId: battle.lobbyId,
    matchId: battle.matchId,
    status: battle.status,
    gridWidth: battle.gridWidth,
    gridHeight: battle.gridHeight,
    round: battle.round,
    currentTurnIndex: battle.currentTurnIndex,
    actionOrder: JSON.parse(battle.actionOrder || "[]"),
    winnerId: battle.winnerId,
    winReason: battle.winReason,
    terrainType: battle.terrainType,
    territorySize: battle.territorySize,
    obstacles: JSON.parse(battle.obstacles || "[]"),
    maxPlayers: battle.maxPlayers,
    playerIds: JSON.parse(battle.playerIds || "[]"),
    kingdomIds: JSON.parse(battle.kingdomIds || "[]"),
    playerColors: JSON.parse(battle.playerColors || "[]"),
    units: battle.units.map(parseUnitFromDb),
    createdAt: battle.createdAt,
    updatedAt: battle.updatedAt,
  };
}

function parseUnitFromDb(unit: BattleUnit): PersistedBattleUnit {
  return {
    id: unit.id,
    sourceUnitId: unit.unitId,
    ownerId: unit.userId, // Prisma usa userId, mapeamos para ownerId do schema
    ownerKingdomId: unit.kingdomId, // Prisma usa kingdomId, mapeamos para ownerKingdomId do schema
    name: unit.name,
    avatar: unit.avatar,
    category: unit.category,
    troopSlot: unit.troopSlot,
    level: unit.level,
    race: null, // Não salvo no banco, será inferido depois
    classCode: unit.classCode,
    features: JSON.parse(unit.features || "[]"),
    equipment: JSON.parse(unit.equipment || "[]"),
    spells: JSON.parse(unit.spells || "[]"),
    combat: unit.combat,
    speed: unit.speed,
    focus: unit.focus,
    resistance: unit.resistance,
    will: unit.will,
    vitality: unit.vitality,
    damageReduction: unit.damageReduction,
    maxHp: unit.maxHp,
    currentHp: unit.currentHp,
    maxMana: unit.maxMana,
    currentMana: unit.currentMana,
    posX: unit.posX,
    posY: unit.posY,
    movesLeft: unit.movesLeft,
    actionsLeft: unit.actionsLeft,
    attacksLeftThisTurn: unit.attacksLeftThisTurn,
    isAlive: unit.isAlive,
    actionMarks: unit.actionMarks,
    physicalProtection: unit.physicalProtection,
    maxPhysicalProtection: unit.physicalProtection, // Não temos separado no banco
    magicalProtection: unit.magicalProtection,
    maxMagicalProtection: unit.magicalProtection, // Não temos separado no banco
    conditions: JSON.parse(unit.conditions || "[]"),
    grabbedByUnitId: unit.grabbedByBattleUnitId,
    hasStartedAction: unit.hasStartedAction,
    isAIControlled: unit.isAIControlled,
    aiBehavior: null, // Não salvo no banco
    size: unit.size,
    visionRange: unit.visionRange,
    unitCooldowns: JSON.parse(unit.unitCooldowns || "{}"),
  };
}
