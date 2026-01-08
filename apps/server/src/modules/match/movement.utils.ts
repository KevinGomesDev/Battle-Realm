// src/utils/movement.utils.ts
import { prisma } from "../../lib/prisma";
import {
  MOVEMENT_COST_BETWEEN_TERRITORIES,
  MOVEMENT_WITHIN_TERRITORY_COST,
} from "@boundless/shared/data/turns.data";
import { spendResources } from "./turn.utils";

/**
 * Valida se uma unidade pode se mover para um novo território
 */
export async function validateMovement(
  unitId: string,
  sourceTerritory: number,
  destinationTerritory: number,
  playerId: string
): Promise<{ valid: boolean; reason?: string; cost?: number }> {
  // Busca a unidade
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    return { valid: false, reason: "Unidade não encontrada" };
  }

  // Verifica se é dono da unidade
  if (unit.ownerId !== playerId) {
    return { valid: false, reason: "Você não é dono desta unidade" };
  }

  // Verifica se está em uma partida (matchId deve estar setado)
  if (!unit.matchId) {
    return { valid: false, reason: "Unidade não está em uma partida" };
  }

  // Verifica se está no território correto
  if (unit.locationIndex !== sourceTerritory) {
    return {
      valid: false,
      reason: "Unidade não está no território indicado",
    };
  }

  // Valida destino
  const destination = await prisma.territory.findFirst({
    where: {
      matchId: unit.matchId,
      mapIndex: destinationTerritory,
    },
  });

  if (!destination) {
    return { valid: false, reason: "Território de destino não existe" };
  }

  // Calcula custo de movimento
  let cost = MOVEMENT_WITHIN_TERRITORY_COST;
  if (sourceTerritory !== destinationTerritory) {
    cost = MOVEMENT_COST_BETWEEN_TERRITORIES;
  }

  return { valid: true, cost };
}

/**
 * Move uma unidade entre territórios
 */
export async function moveUnit(
  unitId: string,
  sourceTerritory: number,
  destinationTerritory: number,
  playerId: string,
  matchId: string
): Promise<{ success: boolean; message: string; unit?: any }> {
  // Valida movimento
  const validation = await validateMovement(
    unitId,
    sourceTerritory,
    destinationTerritory,
    playerId
  );

  if (!validation.valid) {
    return {
      success: false,
      message: validation.reason || "Movimento inválido",
    };
  }

  const cost = validation.cost || 0;

  // Se o movimento for entre territórios, cobrar suprimento
  if (sourceTerritory !== destinationTerritory && cost > 0) {
    try {
      await spendResources(playerId, { supplies: cost } as any);
    } catch (error) {
      return {
        success: false,
        message: `Supplies insufficient. Cost: ${cost}`,
      };
    }
  }

  // Realiza o movimento
  const movedUnit = await prisma.unit.update({
    where: { id: unitId },
    data: {
      locationIndex: destinationTerritory,
    },
  });

  return {
    success: true,
    message: `Unit moved to territory ${destinationTerritory}. Cost: ${cost} Supplies`,
    unit: movedUnit,
  };
}

/**
 * Lista todas as unidades de um jogador em um determinado território
 */
export async function getUnitsInTerritory(
  matchId: string,
  playerId: string,
  territoryIndex: number
): Promise<any[]> {
  const units = await prisma.unit.findMany({
    where: {
      matchId,
      ownerId: playerId,
      locationIndex: territoryIndex,
    },
  });

  return units;
}

/**
 * Lista todos os territórios adjacentes a um território específico
 */
export async function getAdjacentTerritories(
  matchId: string,
  territoryIndex: number
): Promise<any[]> {
  // Configuração do mapa (8x8 = 64 territórios)
  const width = 8;
  const height = 8;

  // Calcula vizinhos em 4 direções (cima, baixo, esquerda, direita)
  const row = Math.floor(territoryIndex / width);
  const col = territoryIndex % width;

  const adjacentIndices: number[] = [];

  if (row > 0) adjacentIndices.push((row - 1) * width + col); // Cima
  if (row < height - 1) adjacentIndices.push((row + 1) * width + col); // Baixo
  if (col > 0) adjacentIndices.push(row * width + (col - 1)); // Esquerda
  if (col < width - 1) adjacentIndices.push(row * width + (col + 1)); // Direita

  // Busca os territórios adjacentes
  const territories = await prisma.territory.findMany({
    where: {
      matchId,
      mapIndex: { in: adjacentIndices },
    },
  });

  return territories;
}

/**
 * Obtém informações de movimento de uma unidade
 */
export async function getUnitMovementInfo(
  unitId: string,
  playerId: string
): Promise<{
  canMove: boolean;
  currentTerritory?: number;
  adjacentTerritories?: any[];
  reason?: string;
}> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    return {
      canMove: false,
      reason: "Unidade não encontrada",
    };
  }

  if (unit.ownerId !== playerId) {
    return {
      canMove: false,
      reason: "Você não é dono desta unidade",
    };
  }

  // Verifica se a unidade está em uma partida
  if (!unit.matchId || unit.locationIndex === null) {
    return {
      canMove: false,
      reason: "Unidade não está em uma partida ou posição válida",
    };
  }

  const adjacentTerritories = await getAdjacentTerritories(
    unit.matchId,
    unit.locationIndex
  );

  return {
    canMove: true,
    currentTerritory: unit.locationIndex,
    adjacentTerritories,
  };
}
