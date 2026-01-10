// server/src/services/battle-persistence.service.ts
// Serviço para persistir e restaurar batalhas/partidas no banco de dados

import { prisma } from "../../../lib/prisma";
import type { BattleSessionState } from "../../battle/colyseus/schemas";
import type { Battle, BattleUnit } from "@prisma/client";
import { calculateActiveEffects } from "../../conditions/conditions";
import type { ActiveEffectsMap } from "@boundless/shared/types/conditions.types";

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
  activeUnitId: string | null;
  currentPlayerId: string | null;
  turnTimer: number;
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
  activeEffects: ActiveEffectsMap;
  // === NEMESIS SYSTEM ===
  nemesisId: string | null;
  isNemesis: boolean;
  nemesisRank: string | null;
  nemesisPowerLevel: number;
  nemesisTraits: string[];
  nemesisFears: string[];
  nemesisStrengths: string[];
  nemesisScars: string[];
  nemesisTitle: string | null;
  nemesisKillCount: number;
  nemesisTargetPlayer: string | null;
}

// ============================================
// Battle Session Persistence
// ============================================

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
 * Marca batalha como terminada e deleta do banco
 * Quando a batalha termina, ela e todos os dados relacionados são removidos
 */
export async function markBattleEnded(
  battleId: string,
  winnerId?: string,
  winReason?: string
): Promise<void> {
  try {
    // Deletar eventos relacionados à batalha
    await prisma.gameEvent.deleteMany({ where: { battleId } });

    // Deletar unidades da batalha
    await prisma.battleUnit.deleteMany({ where: { battleId } });

    // Deletar a batalha
    await prisma.battle.delete({ where: { id: battleId } });

    console.log(
      `[BattlePersistence] Batalha ${battleId} finalizada e deletada (winner: ${winnerId}, reason: ${winReason})`
    );
  } catch (error: any) {
    // Se a batalha não existe no banco, não é um erro crítico
    if (error?.code === "P2025") {
      console.log(
        `[BattlePersistence] Batalha ${battleId} não encontrada no banco para deleção`
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
    activeUnitId: battle.activeUnitId,
    currentPlayerId: battle.currentPlayerId,
    turnTimer: battle.turnTimer,
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
  const conditions = JSON.parse(unit.conditions || "[]");

  return {
    id: unit.oderId || unit.id, // oderId é o ID da unidade na batalha
    sourceUnitId: unit.unitId,
    ownerId: unit.userId, // Prisma usa userId, mapeamos para ownerId do schema
    ownerKingdomId: unit.kingdomId, // Prisma usa kingdomId, mapeamos para ownerKingdomId do schema
    name: unit.name,
    avatar: unit.avatar,
    category: unit.category,
    troopSlot: unit.troopSlot,
    level: unit.level,
    race: unit.race,
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
    maxPhysicalProtection: unit.maxPhysicalProtection,
    magicalProtection: unit.magicalProtection,
    maxMagicalProtection: unit.maxMagicalProtection,
    conditions,
    grabbedByUnitId: unit.grabbedByBattleUnitId,
    hasStartedAction: unit.hasStartedAction,
    isAIControlled: unit.isAIControlled,
    aiBehavior: unit.aiBehavior,
    size: unit.size,
    visionRange: unit.visionRange,
    unitCooldowns: JSON.parse(unit.unitCooldowns || "{}"),
    activeEffects: calculateActiveEffects(conditions, {
      physicalProtection: unit.physicalProtection,
      magicalProtection: unit.magicalProtection,
    }),
    // === NEMESIS SYSTEM ===
    nemesisId: unit.nemesisId,
    isNemesis: unit.isNemesis,
    nemesisRank: unit.nemesisRank,
    nemesisPowerLevel: unit.nemesisPowerLevel,
    nemesisTraits: JSON.parse(unit.nemesisTraits || "[]"),
    nemesisFears: JSON.parse(unit.nemesisFears || "[]"),
    nemesisStrengths: JSON.parse(unit.nemesisStrengths || "[]"),
    nemesisScars: JSON.parse(unit.nemesisScars || "[]"),
    nemesisTitle: unit.nemesisTitle,
    nemesisKillCount: unit.nemesisKillCount,
    nemesisTargetPlayer: unit.nemesisTargetPlayer,
  };
}
