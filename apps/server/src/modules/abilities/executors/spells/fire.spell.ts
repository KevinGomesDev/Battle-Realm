// server/src/modules/abilities/executors/spells/fire.spell.ts
// FIRE - Lança uma bola de fogo que viaja e explode em área 3x3

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "@boundless/shared/types/ability.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import {
  resolveSpellValue,
  processAbilityTargeting,
  processImpact,
} from "../helpers";
import type { SpellExecutionContext } from "../types";
import { scanConditionsForAction } from "../../../conditions/conditions";
import { processUnitDeath } from "../../../combat/death-logic";
import { applyDamage } from "../../../combat/damage.utils";
import { getUnitSizeDefinition, type UnitSize } from "@boundless/shared/config";

/**
 * Helper para verificar se uma unidade ocupa uma célula específica
 * Considera o tamanho da unidade (unidades grandes ocupam múltiplas células)
 */
function unitOccupiesCell(
  unit: BattleUnit,
  cellX: number,
  cellY: number
): boolean {
  const sizeDef = getUnitSizeDefinition((unit.size || "NORMAL") as UnitSize);
  const dimension = sizeDef.dimension;
  for (let dx = 0; dx < dimension; dx++) {
    for (let dy = 0; dy < dimension; dy++) {
      if (unit.posX + dx === cellX && unit.posY + dy === cellY) {
        return true;
      }
    }
  }
  return false;
}

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
  // Determinar a posição alvo:
  // 1. Se target é uma posição direta {x, y}, usa ela
  // 2. Se target é null ou uma unidade, usa context.targetPosition
  let position: { x: number; y: number } | null = null;

  if (target && !("id" in target)) {
    // target é uma posição direta
    position = target as { x: number; y: number };
  } else if (context?.targetPosition) {
    // Usar targetPosition do contexto (enviado pelo frontend)
    position = context.targetPosition;
  }

  if (!position) {
    return {
      success: false,
      error: "Fogo requer uma posição válida como alvo",
    };
  }
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

  console.log(`🔥 [FIRE DEBUG] Targeting result:`, {
    position,
    impactPoint,
    intercepted,
    skipQTE,
    forcedImpactPoint,
    targetsInArea: targetsInArea.map((t) => ({
      id: t.id,
      name: t.name,
      posX: t.posX,
      posY: t.posY,
      ownerId: t.ownerId,
    })),
    caster: { id: caster.id, ownerId: caster.ownerId },
  });

  // Verificar se há uma unidade inimiga no ponto de impacto (para QTE de DODGE)
  // O QTE deve ser acionado se:
  // 1. Não estamos pulando QTE (skipQTE = false)
  // 2. Não temos ponto de impacto forçado (primeira execução)
  // 3. Há uma unidade inimiga no ponto de impacto
  // NOTA: Não depende mais de 'intercepted' - qualquer unidade no ponto de impacto aciona QTE
  if (!skipQTE && !forcedImpactPoint) {
    // Encontrar a primeira unidade inimiga que seria atingida pelo projétil
    const interceptorUnit = allUnits.find(
      (u) =>
        u.isAlive &&
        unitOccupiesCell(u, impactPoint.x, impactPoint.y) &&
        u.id !== caster.id &&
        u.ownerId !== caster.ownerId // Apenas inimigos ativam QTE
    );

    if (interceptorUnit) {
      console.log(
        `🔥 Bola de fogo vai atingir ${interceptorUnit.name} em (${impactPoint.x}, ${impactPoint.y})! Iniciando QTE de DODGE...`
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
    console.log(
      `🔥 Bola de fogo explodiu em (${impactPoint.x}, ${impactPoint.y}) mas não atingiu nenhuma unidade. Células afetadas:`,
      targetingResult.affectedCells.map((c) => `(${c.x},${c.y})`).join(", ")
    );
    return {
      success: true,
      damageDealt: 0,
      targetIds: [],
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
      physicalProtection: targetUnit.physicalProtection,
      magicalProtection: targetUnit.magicalProtection,
      defeated,
    });

    console.log(`🔥 ${targetUnit.name} recebeu ${finalDamage} de dano mágico`);
  }

  // === PROCESSAR IMPACTO (KNOCKBACK) ===
  let impactResults: AbilityExecutionResult["impactResults"];

  if (spell.impact) {
    // Filtrar apenas unidades vivas para o impacto
    const aliveTargets = targetsInArea.filter((u) => u.isAlive);

    if (aliveTargets.length > 0) {
      // Calcular dano base para colisão
      const baseDamageForImpact = resolveSpellValue(
        spell.baseDamage,
        caster,
        caster.focus
      );

      // Função wrapper para aplicar dano de colisão
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

      // Converter para o formato do resultado
      impactResults = impactResult.impacts;

      // Somar dano de colisão ao total
      totalDamage += impactResult.totalCollisionDamage;

      // Atualizar unidades afetadas com dano de colisão
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
    metadata: {
      impactPoint,
      intercepted,
      affectedCells: targetingResult.affectedCells,
    },
  };
}
