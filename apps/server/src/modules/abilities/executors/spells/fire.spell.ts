// server/src/modules/abilities/executors/spells/fire.spell.ts
// FIRE - Lança uma bola de fogo que viaja e explode em área 3x3

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "@boundless/shared/types/ability.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import { resolveSpellValue, processAbilityTargeting } from "../helpers";
import type { SpellExecutionContext } from "../types";
import { scanConditionsForAction } from "../../../conditions/conditions";
import { processUnitDeath } from "../../../combat/death-logic";
import { applyDamage } from "../../../combat/damage.utils";

/**
 * 🔥 FIRE - Lança uma bola de fogo que viaja até o alvo e explode em 3x3
 *
 * FLUXO COM QTE:
 * 1. Projétil viaja em direção ao alvo
 * 2. Se encontrar unidade no caminho:
 *    a. Retorna requiresQTE: true com qteType: "DODGE"
 *    b. Handler inicia QTE de DODGE para a unidade interceptora
 *    c. Se FALHAR no QTE → explode nessa unidade (chama executeFire com skipQTE)
 *    d. Se CONSEGUIR → projétil continua (recalcula próximo impacto)
 * 3. Se não encontrar unidade → explode no alvo original
 * 4. Todas as unidades na área de explosão recebem dano (com chance de esquiva simples)
 */
export function executeFire(
  caster: BattleUnit,
  target: BattleUnit | { x: number; y: number } | null,
  allUnits: BattleUnit[],
  spell: AbilityDefinition,
  context?: SpellExecutionContext
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
  const pattern = spell.targetingPattern;

  if (!pattern) {
    return {
      success: false,
      error: "Spell FIRE não tem targetingPattern definido",
    };
  }

  // Usar sistema de targeting padronizado
  const gridWidth = context?.gridWidth ?? 20;
  const gridHeight = context?.gridHeight ?? 15;
  const obstacles = context?.obstacles ?? [];

  // Flag para pular QTE (usado quando já passou pelo QTE e falhou)
  const skipQTE = context?.skipQTE ?? false;
  // Ponto de impacto forçado (quando já definido pelo QTE)
  const forcedImpactPoint = context?.forcedImpactPoint;

  // Resolve travel distance do pattern
  const travelDistance = pattern.travelDistance
    ? resolveSpellValue(pattern.travelDistance, caster, 5)
    : 5;

  // Processar targeting: viagem + explosão
  const targetingResult = processAbilityTargeting(
    pattern,
    caster,
    forcedImpactPoint?.x ?? position.x,
    forcedImpactPoint?.y ?? position.y,
    allUnits,
    obstacles,
    gridWidth,
    gridHeight,
    {
      travelDistance: forcedImpactPoint ? 0 : travelDistance, // Se temos ponto forçado, não viaja mais
      excludeCaster: true,
    }
  );

  const { targets: targetsInArea, impactPoint, intercepted } = targetingResult;

  // Se foi interceptado por uma unidade e não estamos pulando QTE
  // Verificar se há uma unidade inimiga exatamente no ponto de impacto
  if (intercepted && !skipQTE && !forcedImpactPoint) {
    const interceptorUnit = allUnits.find(
      (u) =>
        u.isAlive &&
        u.posX === impactPoint.x &&
        u.posY === impactPoint.y &&
        u.id !== caster.id &&
        u.ownerId !== caster.ownerId // Apenas inimigos ativam QTE
    );

    if (interceptorUnit) {
      console.log(
        `🔥 Bola de fogo interceptada por ${interceptorUnit.name}! Iniciando QTE de DODGE...`
      );

      // Retornar para iniciar QTE de DODGE
      return {
        success: true,
        requiresQTE: true,
        qteType: "DODGE",
        qteAttackerId: caster.id,
        qteTargetId: interceptorUnit.id,
        qteImpactPoint: impactPoint,
        isAreaProjectile: true,
        pendingAbilityCode: spell.code,
        metadata: {
          impactPoint,
          intercepted: true,
        },
      };
    }
  }

  // Log de impacto
  if (intercepted && !forcedImpactPoint) {
    console.log(
      `🔥 Bola de fogo explodindo em (${impactPoint.x}, ${impactPoint.y}) ao invés de (${position.x}, ${position.y})`
    );
  }

  if (targetsInArea.length === 0) {
    return {
      success: true,
      damageDealt: 0,
      targetIds: [],
      dodgeResults: [],
      metadata: {
        impactPoint,
        intercepted,
        affectedCells: targetingResult.affectedCells,
      },
    };
  }

  // Aplicar dano a cada unidade na área
  const targetIds: string[] = [];
  const affectedUnits: AbilityExecutionResult["affectedUnits"] = [];
  let totalDamage = 0;
  let totalRawDamage = 0;
  let totalDamageReduction = 0;

  for (const targetUnit of targetsInArea) {
    // Dano base
    let baseDamage = resolveSpellValue(spell.baseDamage, caster, caster.focus);

    if (spell.damageMultiplier) {
      baseDamage = Math.floor(baseDamage * (1 + spell.damageMultiplier));
    }

    // Condições do alvo
    const targetConditionEffects = scanConditionsForAction(
      targetUnit.conditions,
      "take_damage"
    );
    const damageReduction =
      targetConditionEffects.modifiers.damageReduction || 0;

    let finalDamage = baseDamage - damageReduction;
    if (finalDamage < 0) finalDamage = 0;

    // Aplicar dano
    const damageResult = applyDamage(
      targetUnit.physicalProtection,
      targetUnit.magicalProtection,
      targetUnit.currentHp,
      finalDamage,
      "MAGICO"
    );

    targetUnit.physicalProtection = damageResult.newPhysicalProtection;
    targetUnit.magicalProtection = damageResult.newMagicalProtection;
    targetUnit.currentHp = damageResult.newHp;
    totalDamage += finalDamage;
    totalRawDamage += baseDamage;
    totalDamageReduction += damageReduction;

    const defeated = targetUnit.currentHp <= 0;
    if (defeated) {
      targetUnit.currentHp = 0;
      processUnitDeath(targetUnit, allUnits, caster, "battle", battleId);
    }

    targetIds.push(targetUnit.id);

    // Adicionar ao array de unidades afetadas
    affectedUnits.push({
      unitId: targetUnit.id,
      damage: finalDamage,
      hpAfter: targetUnit.currentHp,
      defeated,
    });

    console.log(`🔥 ${targetUnit.name} recebeu ${finalDamage} de dano mágico`);
  }

  return {
    success: true,
    damageDealt: totalDamage,
    rawDamage: totalRawDamage,
    damageReduction: totalDamageReduction,
    targetIds,
    affectedUnits,
    metadata: {
      impactPoint,
      intercepted,
      affectedCells: targetingResult.affectedCells,
    },
  };
}
