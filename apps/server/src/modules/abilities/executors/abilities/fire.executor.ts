// server/src/modules/abilities/executors/spells/fire.spell.ts
// FIRE - Lança uma bola de fogo que explode em área 3x3
// SIMPLIFICADO: Dano instantâneo sem projéteis

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "@boundless/shared/types/ability.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import { resolveSpellValue, processImpact } from "../helpers";
import type { SpellExecutionContext } from "../types";
import { scanConditionsForAction } from "../../../conditions/conditions";
import { processUnitDeath } from "../../../combat/death-logic";
import { applyDamage } from "../../../combat/damage.utils";

/**
 * 🔥 FIRE - Lança uma bola de fogo que explode em 3x3
 *
 * FLUXO SIMPLIFICADO:
 * - Aplica dano em área 3x3 ao redor do ponto alvo
 * - Sem viagem de projétil ou QTE
 */
export function executeFire(
  caster: BattleUnit,
  target: BattleUnit | { x: number; y: number } | null,
  allUnits: BattleUnit[],
  spell: AbilityDefinition,
  context?: SpellExecutionContext
): AbilityExecutionResult {
  // Determinar a posição alvo
  let position: { x: number; y: number } | null = null;

  if (target && !("id" in target)) {
    position = target as { x: number; y: number };
  } else if (context?.targetPosition) {
    position = context.targetPosition;
  }

  if (!position) {
    return {
      success: false,
      error: "Fogo requer uma posição válida como alvo",
    };
  }

  const pattern = spell.targetingPattern;
  if (!pattern) {
    return {
      success: false,
      error: "Spell FIRE não tem targetingPattern definido",
    };
  }

  // Verificar custo de mana
  const manaCost = spell.manaCost ?? 0;
  if (caster.currentMana < manaCost) {
    return {
      success: false,
      error: `Mana insuficiente. Necessário: ${manaCost}, Disponível: ${caster.currentMana}`,
    };
  }

  // Consumir mana
  caster.currentMana -= manaCost;

  // Consumir ação
  if (caster.actionsLeft !== undefined && caster.actionsLeft > 0) {
    caster.actionsLeft--;
  }

  // === APLICAR DANO NA ÁREA 3x3 ===
  const impactPoint = position;
  const battleId = context?.battleId;
  const gridWidth = context?.gridWidth ?? 20;
  const gridHeight = context?.gridHeight ?? 15;
  const obstacles = context?.obstacles ?? [];

  // Calcular área 3x3 ao redor do ponto de impacto
  const targetsInArea = allUnits.filter((u) => {
    if (!u.isAlive || u.id === caster.id) return false;
    const dx = Math.abs(u.posX - impactPoint.x);
    const dy = Math.abs(u.posY - impactPoint.y);
    return dx <= 1 && dy <= 1; // Área 3x3
  });

  if (targetsInArea.length === 0) {
    console.log(
      `🔥 Bola de fogo explodiu em (${impactPoint.x}, ${impactPoint.y}) mas não atingiu nenhuma unidade.`
    );
    return {
      success: true,
      damageDealt: 0,
      targetIds: [],
      casterActionsLeft: caster.actionsLeft,
      metadata: {
        impactPoint,
        affectedCells: calculateAffectedCells(impactPoint),
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

    affectedUnits.push({
      unitId: targetUnit.id,
      damage: finalDamage,
      hpAfter: targetUnit.currentHp,
      physicalProtection: targetUnit.physicalProtection,
      magicalProtection: targetUnit.magicalProtection,
      defeated,
    });

    console.log(`🔥 ${targetUnit.name} recebeu ${finalDamage} de dano mágico`);
  }

  // === PROCESSAR IMPACTO (KNOCKBACK) ===
  let impactResults: AbilityExecutionResult["impactResults"];

  if (spell.impact) {
    const aliveTargets = targetsInArea.filter((u) => u.isAlive);

    if (aliveTargets.length > 0) {
      const baseDamageForImpact = resolveSpellValue(
        spell.baseDamage,
        caster,
        caster.focus
      );

      const applyCollisionDamage = (
        unit: BattleUnit,
        damage: number,
        damageType: "FISICO" | "MAGICO"
      ) => {
        const result = applyDamage(
          unit.physicalProtection,
          unit.magicalProtection,
          unit.currentHp,
          damage,
          damageType
        );

        unit.physicalProtection = result.newPhysicalProtection;
        unit.magicalProtection = result.newMagicalProtection;
        unit.currentHp = result.newHp;

        const defeated = unit.currentHp <= 0;
        if (defeated) {
          unit.currentHp = 0;
          processUnitDeath(unit, allUnits, caster, "battle", battleId);
        }

        return { newHp: result.newHp, defeated };
      };

      const impactResult = processImpact(
        spell.impact,
        caster,
        aliveTargets,
        impactPoint.x,
        impactPoint.y,
        baseDamageForImpact,
        allUnits,
        obstacles,
        gridWidth,
        gridHeight,
        applyCollisionDamage
      );

      impactResults = impactResult.impacts;
      totalDamage += impactResult.totalCollisionDamage;

      for (const collision of impactResult.collisionDamageApplied) {
        const existingUnit = affectedUnits.find(
          (u) => u.unitId === collision.unitId
        );
        if (existingUnit) {
          existingUnit.damage += collision.damage;
          existingUnit.hpAfter = collision.hpAfter;
          existingUnit.defeated = existingUnit.defeated || collision.defeated;
        }
      }
    }
  }

  return {
    success: true,
    damageDealt: totalDamage,
    rawDamage: totalRawDamage,
    damageReduction: totalDamageReduction,
    targetIds,
    affectedUnits,
    impactResults,
    casterActionsLeft: caster.actionsLeft,
    metadata: {
      impactPoint,
      affectedCells: calculateAffectedCells(impactPoint),
    },
  };
}

/**
 * Calcula células afetadas em área 3x3 ao redor do ponto
 */
function calculateAffectedCells(center: {
  x: number;
  y: number;
}): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      cells.push({ x: center.x + dx, y: center.y + dy });
    }
  }
  return cells;
}
