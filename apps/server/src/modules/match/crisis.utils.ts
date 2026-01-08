// src/utils/crisis.utils.ts
import { prisma } from "../../lib/prisma";
import {
  TributeDecision,
  CRISIS_METER_MAX,
} from "@boundless/shared/data/crisis.data";
import type {
  TributeSubmission,
  TributePileResult,
} from "@boundless/shared/types/match.types";
import type { ResourceType } from "@boundless/shared/types/kingdom.types";
import { restorePlayerResources } from "./turn.utils";
import { getResourceName, ResourceKey } from "@boundless/shared/config";

/**
 * Calcula o resultado da Pilha de Tributo baseado nas decisões dos jogadores
 */
export function calculateTributePileResult(
  submissions: TributeSubmission[]
): TributePileResult {
  let totalValue = 0;
  let contributionAmount = 0;
  let sabotageAmount = 0;
  let topContributor: string | undefined;
  let topContributorAmount = 0;
  let topSaboteur: string | undefined;
  let topSabotagePlayerAmount = 0;

  // Processa cada submissão
  for (const submission of submissions) {
    if (submission.decision === TributeDecision.CONTRIBUIR) {
      totalValue += submission.amount;
      contributionAmount += submission.amount;

      if (submission.amount > topContributorAmount) {
        topContributor = submission.playerId;
        topContributorAmount = submission.amount;
      }
    } else if (submission.decision === TributeDecision.SABOTAR) {
      totalValue -= submission.amount;
      sabotageAmount += submission.amount;

      if (submission.amount > topSabotagePlayerAmount) {
        topSaboteur = submission.playerId;
        topSabotagePlayerAmount = submission.amount;
      }
    }
    // NAOINTERVIER não afeta nada
  }

  return {
    totalValue,
    contributionAmount,
    sabotageAmount,
    topContributor,
    topSaboteur,
    topContributionAmount: topContributorAmount,
    topSabotageAmount: topSabotagePlayerAmount,
  };
}

/**
 * Processa o resultado da Pilha de Tributo e atualiza o MC
 */
export async function processTributePile(
  matchId: string,
  crisisMeterCurrent: number,
  pileResult: TributePileResult
): Promise<{
  newCrisisMeter: number;
  meterIncreased: boolean;
  winnerPlayerId?: string;
  crisisTriggered: boolean;
  message: string;
}> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
  });

  if (!match) {
    throw new Error("Partida não encontrada");
  }

  let newMeter = crisisMeterCurrent;
  let meterIncreased = false;
  let winnerPlayerId: string | undefined;
  let crisisTriggered = false;

  // Compara valor da pilha com o MC
  if (pileResult.totalValue < crisisMeterCurrent) {
    // Pilha menor que MC: aumenta MC e sabotador ganha
    newMeter = crisisMeterCurrent + 1;
    meterIncreased = true;
    winnerPlayerId = pileResult.topSaboteur;

    // Se MC chegou a 15, crise é acionada
    if (newMeter >= CRISIS_METER_MAX) {
      crisisTriggered = true;
    }
  } else {
    // Pilha >= MC: MC permanece igual e contribuidor ganha
    newMeter = crisisMeterCurrent;
    winnerPlayerId = pileResult.topContributor;
  }

  // Atualiza o MC no banco
  await prisma.match.update({
    where: { id: matchId },
    data: {
      crisisMeter: newMeter,
    },
  });

  // Restaura recursos do vencedor
  if (winnerPlayerId) {
    await restorePlayerResources(matchId, winnerPlayerId);
  }

  const message = meterIncreased
    ? `Pilha insuficiente! MC aumentou para ${newMeter}. ${
        pileResult.topSaboteur ? "Sabotador recuperou todos os recursos!" : ""
      }`
    : `Pilha suficiente! MC permanece em ${newMeter}. ${
        pileResult.topContributor
          ? "Contribuidor recuperou todos os recursos!"
          : ""
      }`;

  return {
    newCrisisMeter: newMeter,
    meterIncreased,
    winnerPlayerId,
    crisisTriggered,
    message,
  };
}

/**
 * Seleciona aleatoriamente um recurso para ser o Recurso do Tributo
 */
export function selectRandomTributesResource(): ResourceType {
  const resources: ResourceType[] = [
    "ore",
    "supplies",
    "arcane",
    "experience",
    "devotion",
  ];
  return resources[Math.floor(Math.random() * resources.length)];
}

/**
 * Inicia a fase de Pilha de Tributo
 * Retorna o recurso escolhido para o tributo
 */
export async function initiateTributePile(matchId: string): Promise<{
  resourceType: ResourceType;
  crisisMeter: number;
  playersCount: number;
}> {
  const resourceType = selectRandomTributesResource();

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      players: true,
    },
  });

  if (!match) {
    throw new Error("Partida não encontrada");
  }

  return {
    resourceType,
    crisisMeter: match.crisisMeter,
    playersCount: match.players.length,
  };
}

/**
 * Valida a decisão de tributo de um jogador
 */
export async function validateTributeSubmission(
  playerId: string,
  decision: TributeDecision,
  amount: number,
  resourceType: ResourceType
): Promise<{ valid: boolean; reason?: string }> {
  if (decision === TributeDecision.NAOINTERVIER && amount > 0) {
    return {
      valid: false,
      reason: "Se não intervir, a quantidade deve ser 0",
    };
  }

  if (decision !== TributeDecision.NAOINTERVIER && amount <= 0) {
    return {
      valid: false,
      reason:
        "Quantidade deve ser maior que 0 se decidir contribuir ou sabotar",
    };
  }

  // Verifica se jogador tem recursos suficientes (apenas para não-naointervier)
  if (decision !== TributeDecision.NAOINTERVIER) {
    const player = await prisma.matchKingdom.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      return {
        valid: false,
        reason: "Jogador não encontrado",
      };
    }

    const playerResources = JSON.parse(player.resources);
    const resourceKey = resourceType.toLowerCase() as ResourceKey;
    const availableAmount = playerResources[resourceKey] || 0;

    if (availableAmount < amount) {
      return {
        valid: false,
        reason: `${getResourceName(
          resourceKey
        )} insuficiente. Disponível: ${availableAmount}, Necessário: ${amount}`,
      };
    }
  }

  return { valid: true };
}
