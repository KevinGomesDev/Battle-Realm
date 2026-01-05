// src/utils/army/regent.utils.ts
import { prisma } from "../../lib/prisma";
import {
  REGENT_LEVELUP_BASE_COST,
  REGENT_LEVELUP_INCREMENT,
  REGENT_ATTRIBUTE_POINTS_PER_LEVEL,
  REGENT_INITIAL_ATTRIBUTE_POINTS,
} from "../../types";
import { spendResources } from "../turn.utils";
import { getResourceName } from "../../../../shared/config/global.config";

/**
 * Calcula o custo de experiência para regente subir de nível
 * Fórmula: 6 + (nível_atual × 3)
 */
export function calculateRegentLevelUpCost(currentLevel: number): number {
  return REGENT_LEVELUP_BASE_COST + currentLevel * REGENT_LEVELUP_INCREMENT;
}

/**
 * Verifica se um regente pode fazer level up
 */
export async function canRegentLevelUp(
  unitId: string,
  playerId: string
): Promise<{ canLevel: boolean; reason?: string; cost?: number }> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    return { canLevel: false, reason: "Unidade não encontrada" };
  }

  if (unit.ownerId !== playerId) {
    return { canLevel: false, reason: "Você não é dono desta unidade" };
  }

  if (unit.category !== "REGENT") {
    return { canLevel: false, reason: "Esta não é uma unidade Regente" };
  }

  // Verifica se está em território adequado (com Arena ou Capital)
  if (!unit.matchId || !unit.locationIndex) {
    return {
      canLevel: false,
      reason: "Regente deve estar em uma partida e em um território",
    };
  }
  const territory = await prisma.territory.findFirst({
    where: {
      matchId: unit.matchId,
      mapIndex: unit.locationIndex,
    },
  });

  if (!territory) {
    return { canLevel: false, reason: "Território não encontrado" };
  }

  const isInCapital = territory.isCapital && territory.ownerId === playerId;

  const hasArena = await prisma.structure.findFirst({
    where: {
      matchId: unit.matchId,
      locationIndex: unit.locationIndex,
      resourceType: "EXPERIENCE",
      ownerId: playerId,
    },
  });

  if (!isInCapital && !hasArena) {
    return {
      canLevel: false,
      reason: `Regente precisa estar na Capital ou em território com Produtor de ${getResourceName(
        "experience"
      )} (Arena)`,
    };
  }

  const cost = calculateRegentLevelUpCost(unit.level);

  return { canLevel: true, cost };
}

/**
 * Realiza o level up de um regente
 */
export async function levelUpRegent(
  unitId: string,
  playerId: string,
  attributeDistribution: {
    combat: number;
    speed: number;
    focus: number;
    armor: number;
    vitality: number;
  }
): Promise<{ success: boolean; message: string; unit?: any }> {
  const validation = await canRegentLevelUp(unitId, playerId);

  if (!validation.canLevel) {
    return {
      success: false,
      message: validation.reason || "Não pode fazer level up",
    };
  }

  const cost = validation.cost || 0;

  // Gasta experiência
  try {
    await spendResources(playerId, { experience: cost } as any);
  } catch (error) {
    return {
      success: false,
      message: `${getResourceName("experience")} insuficiente. Custo: ${cost}`,
    };
  }

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    return { success: false, message: "Unidade não encontrada" };
  }

  // Valida distribuição de pontos (6 para Regente)
  const totalDistributed =
    attributeDistribution.combat +
    attributeDistribution.speed +
    attributeDistribution.focus +
    attributeDistribution.armor +
    attributeDistribution.vitality;

  if (totalDistributed !== REGENT_ATTRIBUTE_POINTS_PER_LEVEL) {
    return {
      success: false,
      message: `Você deve distribuir exatamente ${REGENT_ATTRIBUTE_POINTS_PER_LEVEL} pontos`,
    };
  }

  const newLevel = unit.level + 1;
  const updatedUnit = await prisma.unit.update({
    where: { id: unitId },
    data: {
      level: newLevel,
      combat: unit.combat + attributeDistribution.combat,
      speed: unit.speed + attributeDistribution.speed,
      focus: unit.focus + attributeDistribution.focus,
      armor: unit.armor + attributeDistribution.armor,
      vitality: unit.vitality + attributeDistribution.vitality,
      currentHp: unit.currentHp + attributeDistribution.vitality,
    },
  });

  return {
    success: true,
    message: `Regente subiu para nível ${newLevel}! Custo: ${cost} ${getResourceName(
      "experience"
    )}`,
    unit: updatedUnit,
  };
}

/**
 * Verifica se um regente pode escolher característica de classe
 * Regente escolhe nos níveis 1, 3, 6, 9...
 */
export function canRegentChooseFeature(level: number): boolean {
  return level === 1 || level % 3 === 0;
}

/**
 * Recruta um novo regente para o jogador
 * Regente é criado na capital com 30 pontos de atributo no nível 1
 */
export async function recruitRegent(
  matchId: string | undefined,
  playerId: string,
  attributeDistribution: {
    combat: number;
    speed: number;
    focus: number;
    armor: number;
    vitality: number;
  },
  name?: string
): Promise<{ success: boolean; message: string; regent?: any }> {
  // NOTA: Esta função agora é usada apenas DURANTE PARTIDAS
  // A criação de Regente fora de partida é feita diretamente no kingdom.handler.ts

  if (!matchId) {
    return {
      success: false,
      message:
        "Esta função só pode ser usada durante uma partida. Use kingdom:create para criar o regente inicial.",
    };
  }

  // Durante uma partida: playerId é matchKingdomId
  const matchKingdom = await prisma.matchKingdom.findUnique({
    where: { id: playerId },
    include: { kingdom: { include: { regent: true } } },
  });

  if (!matchKingdom) {
    return {
      success: false,
      message: "MatchKingdom não encontrado",
    };
  }

  // Verifica se jogador já tem um regente na partida
  const existingRegentInMatch = await prisma.unit.findFirst({
    where: {
      ownerId: playerId,
      category: "REGENT",
    },
  });

  if (existingRegentInMatch) {
    return {
      success: false,
      message: "Você já possui um Regente nesta partida.",
    };
  }

  // Valida distribuição de pontos (30 para novo Regente)
  const totalDistributed =
    attributeDistribution.combat +
    attributeDistribution.speed +
    attributeDistribution.focus +
    attributeDistribution.armor +
    attributeDistribution.vitality;

  if (totalDistributed !== REGENT_INITIAL_ATTRIBUTE_POINTS) {
    return {
      success: false,
      message: `Você deve distribuir exatamente ${REGENT_INITIAL_ATTRIBUTE_POINTS} pontos`,
    };
  }

  // Busca a capital para spawn
  const capital = await prisma.territory.findFirst({
    where: {
      matchId,
      isCapital: true,
      ownerId: playerId,
    },
  });

  if (!capital) {
    return {
      success: false,
      message:
        "Capital não encontrada. É necessário possuir uma capital na partida.",
    };
  }

  // Cria o regente para esta partida (vinculado ao MatchKingdom)
  const regent = await prisma.unit.create({
    data: {
      matchId,
      ownerId: playerId, // Vinculado ao MatchKingdom
      category: "REGENT",
      level: 1,
      combat: attributeDistribution.combat,
      speed: attributeDistribution.speed,
      focus: attributeDistribution.focus,
      armor: attributeDistribution.armor,
      vitality: attributeDistribution.vitality,
      currentHp: attributeDistribution.vitality * 5,
      movesLeft: 3,
      actionsLeft: 1,
      locationIndex: capital.mapIndex,
      name: name || "REGENT",
      classFeatures: JSON.stringify([]), // Regente escolhe característica no nível 1
    },
  });

  return {
    success: true,
    message: `Regente recrutado com sucesso! Nível 1 com ${REGENT_INITIAL_ATTRIBUTE_POINTS} pontos distribuídos.`,
    regent,
  };
}
