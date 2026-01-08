// src/utils/turn.utils.ts
import { prisma } from "../../lib/prisma";
import { TurnType, TURN_ORDER } from "../../../../shared/data/turns.data";
import type { PlayerResources } from "../../../../shared/types/match.types";
import { getResourceName, ResourceKey } from "../../../../shared/config";

/**
 * Calcula os recursos que um jogador deve receber no início do Turno de Administração
 * Fórmula: 1 por Capital + 1 por Território + 1 por Produtor específico
 */
export async function calculatePlayerResources(
  matchId: string,
  playerId: string
): Promise<PlayerResources> {
  // Busca todos os territórios do jogador
  const territories = await prisma.territory.findMany({
    where: {
      matchId,
      ownerId: playerId,
    },
  });

  // Conta capital
  const capitalCount = territories.filter((t) => t.isCapital).length;

  // Conta territórios totais
  const territoryCount = territories.length;

  // Busca estruturas do jogador
  const structures = await prisma.structure.findMany({
    where: {
      matchId,
      ownerId: playerId,
    },
  });

  // Conta produtores por tipo
  const oreProducers = structures.filter(
    (s) => s.resourceType === "ORE"
  ).length;
  const foodProducers = structures.filter(
    (s) => s.resourceType === "FOOD"
  ).length;
  const arcaneProducers = structures.filter(
    (s) => s.resourceType === "ARCANE"
  ).length;
  const experienceProducers = structures.filter(
    (s) => s.resourceType === "EXPERIENCE"
  ).length;

  // Calcula recursos
  const resources: PlayerResources = {
    ore: capitalCount + territoryCount + oreProducers,
    supplies: capitalCount + territoryCount + foodProducers,
    arcane: capitalCount + territoryCount + arcaneProducers,
    experience: capitalCount + territoryCount + experienceProducers,
    devotion: 0, // Devocao nao eh calculada automaticamente, acumula de outras formas
  };

  return resources;
}

/**
 * Restaura os recursos de um jogador no início do Turno de Administração
 */
export async function restorePlayerResources(
  matchId: string,
  playerId: string
): Promise<PlayerResources> {
  const newResources = await calculatePlayerResources(matchId, playerId);

  // Busca recursos atuais para preservar Devoção (que acumula)
  const player = await prisma.matchKingdom.findFirst({
    where: {
      matchId,
      id: playerId,
    },
  });

  if (player) {
    const currentResources = JSON.parse(player.resources) as PlayerResources;
    // Preserva Devoção acumulada
    newResources.devotion = currentResources.devotion || 0;
  }

  // Atualiza no banco
  await prisma.matchKingdom.update({
    where: { id: playerId },
    data: {
      resources: JSON.stringify(newResources),
    },
  });

  return newResources;
}

/**
 * Restaura recursos de TODOS os jogadores no início do Turno de Administração
 */
export async function restoreAllPlayersResources(
  matchId: string
): Promise<void> {
  const players = await prisma.matchKingdom.findMany({
    where: { matchId },
  });

  for (const player of players) {
    await restorePlayerResources(matchId, player.id);
  }
}

/**
 * Avança para o próximo turno
 * Se chegar ao final dos turnos, avança a rodada
 */
export async function advanceTurn(matchId: string): Promise<{
  newRound: number;
  newTurn: TurnType;
  roundAdvanced: boolean;
}> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
  });

  if (!match) {
    throw new Error("Partida não encontrada");
  }

  const currentTurnIndex = TURN_ORDER.indexOf(match.currentTurn as TurnType);
  const isLastTurn = currentTurnIndex === TURN_ORDER.length - 1;

  let newRound = match.currentRound;
  let newTurn: TurnType;
  let roundAdvanced = false;

  if (isLastTurn) {
    // Avança para a próxima rodada
    newRound = match.currentRound + 1;
    newTurn = TURN_ORDER[0]; // Volta para ADMINISTRACAO
    roundAdvanced = true;

    // Se começar nova rodada, restaura recursos
    await restoreAllPlayersResources(matchId);
  } else {
    // Avança para o próximo turno da mesma rodada
    newTurn = TURN_ORDER[currentTurnIndex + 1];
  }

  // Atualiza no banco
  await prisma.match.update({
    where: { id: matchId },
    data: {
      currentRound: newRound,
      currentTurn: newTurn,
    },
  });

  // Reseta flags de turno dos jogadores
  await prisma.matchKingdom.updateMany({
    where: { matchId },
    data: {
      hasPlayedTurn: false,
      hasFinishedAdminTurn: false,
    },
  });

  return { newRound, newTurn, roundAdvanced };
}

/**
 * Verifica se todos os jogadores terminaram o turno atual
 */
export async function checkAllPlayersFinished(
  matchId: string,
  turnType: TurnType
): Promise<boolean> {
  const players = await prisma.matchKingdom.findMany({
    where: { matchId },
  });

  // Para turno de administração, verifica hasFinishedAdminTurn
  if (turnType === TurnType.ADMINISTRACAO) {
    return players.every((p) => p.hasFinishedAdminTurn);
  }

  // Para outros turnos, verifica hasPlayedTurn
  return players.every((p) => p.hasPlayedTurn);
}

/**
 * Gasta recursos de um jogador
 */
export async function spendResources(
  playerId: string,
  costs: Partial<PlayerResources>
): Promise<PlayerResources> {
  const player = await prisma.matchKingdom.findUnique({
    where: { id: playerId },
  });

  if (!player) {
    throw new Error("Jogador não encontrado");
  }

  const currentResources = JSON.parse(player.resources) as PlayerResources;

  // Verifica se tem recursos suficientes
  for (const [key, value] of Object.entries(costs)) {
    const resourceKey = key as keyof PlayerResources;
    if (value && currentResources[resourceKey] < value) {
      throw new Error(
        `Recursos insuficientes: ${getResourceName(key as ResourceKey)}`
      );
    }
  }

  // Deduz recursos
  const newResources: PlayerResources = {
    ore: currentResources.ore - (costs.ore || 0),
    supplies: currentResources.supplies - (costs.supplies || 0),
    arcane: currentResources.arcane - (costs.arcane || 0),
    experience: currentResources.experience - (costs.experience || 0),
    devotion: currentResources.devotion - (costs.devotion || 0),
  };

  // Atualiza no banco
  await prisma.matchKingdom.update({
    where: { id: playerId },
    data: {
      resources: JSON.stringify(newResources),
    },
  });

  return newResources;
}

/**
 * Adiciona recursos a um jogador (para Devoção e outras fontes especiais)
 */
export async function addResources(
  playerId: string,
  gains: Partial<PlayerResources>
): Promise<PlayerResources> {
  const player = await prisma.matchKingdom.findUnique({
    where: { id: playerId },
  });

  if (!player) {
    throw new Error("Jogador não encontrado");
  }

  const currentResources = JSON.parse(player.resources) as PlayerResources;

  const newResources: PlayerResources = {
    ore: currentResources.ore + (gains.ore || 0),
    supplies: currentResources.supplies + (gains.supplies || 0),
    arcane: currentResources.arcane + (gains.arcane || 0),
    experience: currentResources.experience + (gains.experience || 0),
    devotion: currentResources.devotion + (gains.devotion || 0),
  };

  await prisma.matchKingdom.update({
    where: { id: playerId },
    data: {
      resources: JSON.stringify(newResources),
    },
  });

  return newResources;
}
