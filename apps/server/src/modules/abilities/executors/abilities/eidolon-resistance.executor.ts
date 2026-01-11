// server/src/modules/abilities/executors/skills/eidolon-resistance.skill.ts
// EIDOLON_RESISTANCE (Resistência Eidolon) - Invocador: Drena proteção do Eidolon para si

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "@boundless/shared/types/ability.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import { isAdjacentOmnidirectional } from "@boundless/shared/utils/distance.utils";

/**
 * SUMMONER_EIDOLON_RESISTANCE: Drena proteção do Eidolon para si
 * - O Eidolon deve ter pelo menos 1 de proteção
 * - Recupera [FOCO] de proteção do Eidolon para o caster
 */
export function executeEidolonResistance(
  caster: BattleUnit,
  target: BattleUnit | null,
  allUnits: BattleUnit[],
  _skill: AbilityDefinition
): AbilityExecutionResult {
  // Se não passou target, tenta encontrar o Eidolon adjacente
  let eidolon = target;

  if (!eidolon) {
    // Procura o Eidolon do caster que esteja adjacente
    eidolon =
      allUnits.find(
        (u) =>
          u.ownerId === caster.ownerId &&
          u.category === "SUMMON" &&
          u.conditions.includes("EIDOLON_GROWTH") &&
          u.isAlive &&
          isAdjacentOmnidirectional(caster.posX, caster.posY, u.posX, u.posY)
      ) || null;
  }

  if (!eidolon) {
    return { success: false, error: "Nenhum Eidolon adjacente encontrado" };
  }

  // Verificar se é um Eidolon válido
  if (
    eidolon.category !== "SUMMON" ||
    !eidolon.conditions.includes("EIDOLON_GROWTH")
  ) {
    return { success: false, error: "Alvo não é seu Eidolon" };
  }

  // Verificar se está adjacente
  if (
    !isAdjacentOmnidirectional(
      caster.posX,
      caster.posY,
      eidolon.posX,
      eidolon.posY
    )
  ) {
    return { success: false, error: "Eidolon não está adjacente" };
  }

  // Verificar se Eidolon tem proteção física
  const eidolonProtection = eidolon.physicalProtection;
  if (eidolonProtection < 1) {
    return {
      success: false,
      error: "Eidolon não tem proteção suficiente",
    };
  }

  // Quantidade a drenar = FOCO do caster (máximo o que o Eidolon tem)
  const drainAmount = Math.min(caster.focus, eidolonProtection);

  // Remover proteção do Eidolon
  eidolon.physicalProtection -= drainAmount;

  // Adicionar proteção ao caster (respeitar máximo)
  const casterMaxProtection = caster.maxPhysicalProtection;
  const casterCurrentProtection = caster.physicalProtection;
  const actualGain = Math.min(
    drainAmount,
    casterMaxProtection - casterCurrentProtection
  );
  caster.physicalProtection += actualGain;

  return {
    success: true,
    healAmount: actualGain, // Usando healAmount para representar proteção ganha
    damageDealt: drainAmount, // Usando damageDealt para representar proteção drenada
  };
}
