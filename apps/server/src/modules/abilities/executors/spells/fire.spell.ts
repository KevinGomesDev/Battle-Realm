// server/src/modules/abilities/executors/spells/fire.spell.ts
// FIRE - Causa dano mágico em área 3x3

import type {
  AbilityDefinition,
  AbilityExecutionResult,
  AbilityExecutionContext,
} from "@boundless/shared/types/ability.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import { resolveSpellValue } from "../helpers";
import { scanConditionsForAction } from "../../../conditions/conditions";
import { processUnitDeath } from "../../../combat/death-logic";
import { applyDamage } from "../../../combat/damage.utils";

/**
 * 🔥 FIRE - Causa dano mágico em área 3x3
 * Nota: Validação de alcance já foi feita em validateSpellUse()
 */
export function executeFire(
  caster: BattleUnit,
  target: BattleUnit | { x: number; y: number } | null,
  allUnits: BattleUnit[],
  spell: AbilityDefinition,
  context?: AbilityExecutionContext
): AbilityExecutionResult {
  // Validação: target deve ser uma posição
  if (!target || "id" in target) {
    return {
      success: false,
      error: "Fogo requer uma posição válida como alvo",
    };
  }

  const position = target as { x: number; y: number };
  const battleId = context?.battleId;

  // Encontrar todas as unidades na área 3x3
  const targetsInArea = allUnits.filter((u) => {
    if (!u.isAlive) return false;
    const dx = Math.abs(u.posX - position.x);
    const dy = Math.abs(u.posY - position.y);
    return dx <= 1 && dy <= 1; // 3x3 centered on position
  });

  if (targetsInArea.length === 0) {
    return {
      success: false,
      error: "Nenhuma unidade na área alvo",
    };
  }

  // Aplicar dano a cada unidade na área
  const targetIds: string[] = [];
  const dodgeResults: AbilityExecutionResult["dodgeResults"] = [];
  let totalDamage = 0;
  let totalRawDamage = 0;
  let totalDamageReduction = 0;

  for (const targetUnit of targetsInArea) {
    // Sistema de esquiva (Speed × 3%)
    const dodgeChance = targetUnit.speed * 3;
    const dodgeRoll = Math.floor(Math.random() * 100) + 1;
    const dodged = dodgeRoll <= dodgeChance;

    // Registrar resultado de esquiva
    dodgeResults.push({
      targetId: targetUnit.id,
      targetName: targetUnit.name,
      dodged,
      dodgeChance,
      dodgeRoll,
    });

    if (dodged) {
      console.log(
        `🌀 ${targetUnit.name} esquivou do Fogo! (${dodgeRoll} <= ${dodgeChance}%)`
      );
      continue;
    }

    // Dano base: resolver valor dinâmico (pode ser número fixo ou atributo)
    let baseDamage = resolveSpellValue(spell.baseDamage, caster, caster.focus);

    // Aplicar multiplicador de dano se existir
    if (spell.damageMultiplier) {
      baseDamage = Math.floor(baseDamage * (1 + spell.damageMultiplier));
    }

    // Scan condições do alvo para redução de dano
    const targetConditionEffects = scanConditionsForAction(
      targetUnit.conditions,
      "take_damage"
    );
    const damageReduction =
      targetConditionEffects.modifiers.damageReduction || 0;

    // Aplicar redução de dano das condições
    let finalDamage = baseDamage - damageReduction;
    if (finalDamage < 0) finalDamage = 0;

    // Aplicar dano usando o sistema de proteção dual (absorve na proteção mágica primeiro)
    const damageResult = applyDamage(
      targetUnit.physicalProtection,
      targetUnit.magicalProtection,
      targetUnit.currentHp,
      finalDamage,
      "MAGICO"
    );

    // Atualizar valores do alvo
    targetUnit.physicalProtection = damageResult.newPhysicalProtection;
    targetUnit.magicalProtection = damageResult.newMagicalProtection;
    targetUnit.currentHp = damageResult.newHp;
    totalDamage += finalDamage;
    totalRawDamage += baseDamage;
    totalDamageReduction += damageReduction;

    if (targetUnit.currentHp <= 0) {
      targetUnit.currentHp = 0;
      processUnitDeath(targetUnit, allUnits, caster, "battle", battleId);
    }

    targetIds.push(targetUnit.id);

    console.log(
      `🔥 ${targetUnit.name} recebeu ${finalDamage} de dano mágico (base: ${baseDamage}, redução: ${damageReduction}, absorvido: ${damageResult.damageAbsorbed}, HP: ${damageResult.damageToHp})`
    );
  }

  return {
    success: true,
    damageDealt: totalDamage,
    rawDamage: totalRawDamage,
    damageReduction: totalDamageReduction,
    targetIds,
    dodgeResults,
  };
}
