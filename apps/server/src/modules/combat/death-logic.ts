// server/src/logic/death-logic.ts
// Lógica centralizada de morte de unidades

import type { BattleUnit } from "@boundless/shared/types/battle.types";
import { type UnitSize } from "@boundless/shared/config";
import {
  processSummonerDeath,
  processUnitDeathForEidolon,
  processEidolonDeath,
} from "../summons/summon-logic";
import { createAndEmitEvent } from "../match/services/event.service";
import { getPlayersWithVisionAt } from "../../utils/vision.utils";

// =============================================================================
// TIPOS
// =============================================================================

export interface UnitDeathResult {
  /** Invocações que foram mortas junto com a unidade */
  killedSummons: BattleUnit[];
  /** Se o Eidolon cresceu (caso killer seja Eidolon) */
  eidolonGrew: boolean;
  /** Novo bônus do Eidolon (se cresceu) */
  eidolonNewBonus: number;
  /** Novo tamanho do Eidolon (se mudou) */
  eidolonNewSize?: UnitSize;
}

// =============================================================================
// PROCESSAMENTO CENTRALIZADO DE MORTE
// =============================================================================

/**
 * Processa a morte de uma unidade de forma centralizada.
 * Esta função deve ser chamada sempre que uma unidade morre para garantir
 * que todos os efeitos colaterais sejam processados corretamente:
 * - Marcar unidade como morta (isAlive = false)
 * - Emitir evento de morte para jogadores que viram
 * - Processar crescimento do Eidolon (se killer for Eidolon)
 * - Processar morte do Eidolon (se target for Eidolon)
 * - Matar invocações vinculadas ao alvo
 *
 * @param target - Unidade que morreu
 * @param allUnits - Todas as unidades da batalha
 * @param killer - Unidade que causou a morte (opcional, para crescimento do Eidolon)
 * @param matchId - ID da partida (para estado do Eidolon)
 * @param battleId - ID da batalha (para eventos)
 * @returns Resultado do processamento da morte
 */
export function processUnitDeath(
  target: BattleUnit,
  allUnits: BattleUnit[],
  killer: BattleUnit | null = null,
  matchId: string = "battle",
  battleId?: string
): UnitDeathResult {
  // 1. Marcar unidade como morta
  target.isAlive = false;

  // 2. Emitir evento de morte para jogadores que viram
  if (battleId) {
    const playersWithVision = getPlayersWithVisionAt(
      allUnits,
      target.posX,
      target.posY
    );

    // Sempre incluir o dono da unidade morta (ele deve saber que sua unidade morreu)
    if (!playersWithVision.includes(target.ownerId)) {
      playersWithVision.push(target.ownerId);
    }

    const message = killer
      ? `${target.name} foi derrotado por ${killer.name}!`
      : `${target.name} foi derrotado!`;

    createAndEmitEvent({
      context: "BATTLE",
      scope: "INDIVIDUAL",
      category: "COMBAT",
      severity: "DANGER",
      battleId,
      code: "UNIT_DEATH",
      message,
      actorId: killer?.id,
      actorName: killer?.name,
      targetId: target.id,
      targetName: target.name,
      targetUserIds: playersWithVision,
      data: {
        targetPosX: target.posX,
        targetPosY: target.posY,
        killerPosX: killer?.posX,
        killerPosY: killer?.posY,
      },
    });
  }

  // 3. Processar crescimento do Eidolon (se killer for Eidolon)
  let eidolonGrew = false;
  let eidolonNewBonus = 0;
  let eidolonNewSize: UnitSize | undefined;

  if (killer) {
    const eidolonResult = processUnitDeathForEidolon(killer, target, matchId);
    eidolonGrew = eidolonResult.eidolonGrew;
    eidolonNewBonus = eidolonResult.newBonus;
    eidolonNewSize = eidolonResult.newSize;
  }

  // 4. Se o alvo era um Eidolon, processar reset de bônus
  if (target.conditions.includes("EIDOLON_GROWTH")) {
    processEidolonDeath(target, matchId);
  }

  // 5. Matar todas as invocações do alvo (summons morrem com o invocador)
  const killedSummons = processSummonerDeath(target, allUnits, matchId);

  return {
    killedSummons,
    eidolonGrew,
    eidolonNewBonus,
    eidolonNewSize,
  };
}
