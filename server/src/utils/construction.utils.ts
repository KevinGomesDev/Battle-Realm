// src/utils/construction.utils.ts
import { prisma } from "../lib/prisma";
import {
  CONSTRUCTION_COSTS,
  MAX_CONSTRUCTIONS_PER_TERRITORY,
  MAX_FORTRESSES_PER_TERRITORY,
} from "../types";
import { STRUCTURE_DEFINITIONS } from "../data/structures";
import { spendResources } from "./turn.utils";
import { getResourceName } from "../../../shared/config/global.config";

/**
 * Verifica se um jogador pode construir em um território
 */
export async function canBuildInTerritory(
  territoryId: string,
  playerId: string,
  structureType: string
): Promise<{ canBuild: boolean; reason?: string; cost?: number }> {
  const territory = await prisma.territory.findUnique({
    where: { id: territoryId },
  });

  if (!territory) {
    return { canBuild: false, reason: "Território não encontrado" };
  }

  // Verifica se o jogador é dono do território
  if (territory.ownerId !== playerId) {
    return { canBuild: false, reason: "Você não controla este território" };
  }

  // Verifica se já atingiu o limite de construções
  if (territory.constructionCount >= MAX_CONSTRUCTIONS_PER_TERRITORY) {
    return {
      canBuild: false,
      reason: `Território já possui o máximo de ${MAX_CONSTRUCTIONS_PER_TERRITORY} construções`,
    };
  }

  // Verifica se é fortaleza e já atingiu o limite de fortalezas
  const structureDef = STRUCTURE_DEFINITIONS[structureType];
  if (!structureDef) {
    return { canBuild: false, reason: "Tipo de estrutura inválido" };
  }

  if (
    structureType === "FORTRESS" &&
    territory.fortressCount >= MAX_FORTRESSES_PER_TERRITORY
  ) {
    return {
      canBuild: false,
      reason: `Território já possui o máximo de ${MAX_FORTRESSES_PER_TERRITORY} fortalezas`,
    };
  }

  // Calcula o custo baseado na quantidade de construções existentes
  // constructionCount atual + 1 = próxima construção
  const nextConstructionNumber = territory.constructionCount + 1;
  const cost = CONSTRUCTION_COSTS[nextConstructionNumber] || 0;

  return { canBuild: true, cost };
}

/**
 * Constrói uma estrutura em um território
 */
export async function buildStructure(
  matchId: string,
  playerId: string,
  territoryId: string,
  structureType: string
): Promise<{ success: boolean; message: string; structure?: any }> {
  // Verifica se pode construir
  const validation = await canBuildInTerritory(
    territoryId,
    playerId,
    structureType
  );

  if (!validation.canBuild) {
    return {
      success: false,
      message: validation.reason || "Não pode construir",
    };
  }

  const cost = validation.cost || 0;

  // Verifica se tem recursos suficientes (minério)
  try {
    await spendResources(playerId, { ore: cost } as any);
  } catch (error) {
    return {
      success: false,
      message: `${getResourceName("ore")} insuficiente. Custo: ${cost}`,
    };
  }

  // Busca definição da estrutura
  const structureDef = STRUCTURE_DEFINITIONS[structureType];

  const territory = await prisma.territory.findUnique({
    where: { id: territoryId },
  });

  // Obtém o Kingdom através do MatchPlayer
  const matchPlayer = await prisma.matchPlayer.findUnique({
    where: { id: playerId },
  });

  if (!matchPlayer) {
    return {
      success: false,
      message: "MatchPlayer não encontrado",
    };
  }

  // Cria a estrutura
  const structure = await prisma.structure.create({
    data: {
      kingdomId: matchPlayer.kingdomId, // Vinculado ao Reino (proprietário permanente)
      matchId,
      ownerId: playerId,
      type: structureType,
      maxHp: structureDef.maxHp,
      currentHp: structureDef.maxHp,
      resourceType: structureDef.resourceGenerated || null,
      productionRate: structureDef.resourceGenerated ? 1 : 0,
      locationIndex: territory!.mapIndex,
    },
  });

  // Atualiza contadores do território (apenas pago, não incrementa free builds)
  const isFortaleza = structureType === "FORTRESS";
  await prisma.territory.update({
    where: { id: territoryId },
    data: {
      constructionCount: { increment: 1 },
      fortressCount: isFortaleza ? { increment: 1 } : undefined,
    },
  });

  return {
    success: true,
    message: `${
      structureDef.name
    } construída com sucesso! Custo: ${cost} ${getResourceName("ore")}`,
    structure,
  };
}

/**
 * Constrói uma estrutura gratuita durante a preparação (sem custo de minério)
 */
export async function buildStructureFree(
  matchId: string,
  playerId: string,
  territoryId: string,
  structureType: string
): Promise<{ success: boolean; message: string; structure?: any }> {
  // Verifica se pode construir no território
  const validation = await canBuildInTerritory(
    territoryId,
    playerId,
    structureType
  );

  if (!validation.canBuild) {
    return {
      success: false,
      message: validation.reason || "Não pode construir",
    };
  }

  // Busca definição e território
  const structureDef = STRUCTURE_DEFINITIONS[structureType];
  const territory = await prisma.territory.findUnique({
    where: { id: territoryId },
  });

  const matchPlayer = await prisma.matchPlayer.findUnique({
    where: { id: playerId },
  });

  if (!matchPlayer) {
    return { success: false, message: "MatchPlayer não encontrado" };
  }

  // Cria a estrutura (sem cobrar recursos)
  const structure = await prisma.structure.create({
    data: {
      kingdomId: matchPlayer.kingdomId,
      matchId,
      ownerId: playerId,
      type: structureType,
      maxHp: structureDef.maxHp,
      currentHp: structureDef.maxHp,
      resourceType: structureDef.resourceGenerated || null,
      productionRate: structureDef.resourceGenerated ? 1 : 0,
      locationIndex: territory!.mapIndex,
    },
  });

  // Atualiza contadores do território e free builds do jogador
  const isFortaleza = structureType === "FORTRESS";
  await prisma.territory.update({
    where: { id: territoryId },
    data: {
      constructionCount: { increment: 1 },
      fortressCount: isFortaleza ? { increment: 1 } : undefined,
    },
  });

  // Cast to any to update freeBuildingsUsed until Prisma client is regenerated
  await (prisma as any).matchPlayer.update({
    where: { id: playerId },
    data: {
      freeBuildingsUsed: { increment: 1 },
      buildingCount: { increment: 1 },
    } as any,
  });

  return {
    success: true,
    message: `${structureDef.name} construída gratuitamente na preparação!`,
    structure,
  };
}

/**
 * Lista todas as estruturas que podem ser construídas
 */
export function getAvailableStructures() {
  return Object.values(STRUCTURE_DEFINITIONS)
    .filter((s) => !s.isCapital)
    .map((s) => ({
      id: s.id,
      name: s.name,
      icon: s.icon,
      maxHp: s.maxHp,
      resourceGenerated: s.resourceGenerated,
      specialEffect: s.specialEffect,
    }));
}

/**
 * Calcula o custo da próxima construção em um território
 */
export async function getNextConstructionCost(
  territoryId: string
): Promise<number> {
  const territory = await prisma.territory.findUnique({
    where: { id: territoryId },
  });

  if (!territory) {
    return 0;
  }

  const nextConstructionNumber = territory.constructionCount + 1;
  return CONSTRUCTION_COSTS[nextConstructionNumber] || 0;
}

/**
 * Lista informações de construção de um território
 */
export async function getTerritoryConstructionInfo(territoryId: string) {
  const territory = await prisma.territory.findUnique({
    where: { id: territoryId },
  });

  if (!territory) {
    return null;
  }

  const structures = await prisma.structure.findMany({
    where: {
      matchId: territory.matchId,
      locationIndex: territory.mapIndex,
    },
  });

  const nextCost = await getNextConstructionCost(territoryId);
  const canBuildMore =
    territory.constructionCount < MAX_CONSTRUCTIONS_PER_TERRITORY;
  const canBuildFortress =
    territory.fortressCount < MAX_FORTRESSES_PER_TERRITORY;

  return {
    territoryId: territory.id,
    mapIndex: territory.mapIndex,
    constructionCount: territory.constructionCount,
    fortressCount: territory.fortressCount,
    maxConstructions: MAX_CONSTRUCTIONS_PER_TERRITORY,
    maxFortresses: MAX_FORTRESSES_PER_TERRITORY,
    nextConstructionCost: nextCost,
    canBuildMore,
    canBuildFortress,
    structures: structures.map((s) => ({
      id: s.id,
      type: s.type,
      currentHp: s.currentHp,
      maxHp: s.maxHp,
      resourceType: s.resourceType,
    })),
  };
}
