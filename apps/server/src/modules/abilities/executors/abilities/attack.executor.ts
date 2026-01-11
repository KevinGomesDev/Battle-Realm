// server/src/modules/abilities/executors/skills/attack.skill.ts
// ATTACK - Ação comum de ataque corpo-a-corpo

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "@boundless/shared/types/ability.types";
import type {
  BattleObstacle,
  BattleUnit,
} from "@boundless/shared/types/battle.types";
import type { SkillExecutionContext, AttackActionResult } from "../types";
import { isWithinRange } from "@boundless/shared/utils/distance.utils";
import {
  OBSTACLE_CONFIG,
  type DamageTypeName,
  getUnitSizeDefinition,
  getObstacleDimension,
  type UnitSize,
  type ObstacleSize,
} from "@boundless/shared/config";
import {
  shouldTransferDamageToEidolon,
  transferDamageToEidolon,
  processEidolonDeath,
} from "../../../summons/summon-logic";
import { processUnitDeath } from "../../../combat/death-logic";
import {
  scanConditionsForAction,
  applyConditionScanResult,
  getExtraAttacksFromConditions,
  applyConditionToUnit,
} from "../../../conditions/conditions";
import { applyDamage } from "../../../combat/damage.utils";

/**
 * ATTACK: Ataque corpo-a-corpo unificado
 * Pode atacar: unidade viva, cadáver (unidade morta) ou obstáculo
 * SISTEMA SIMPLIFICADO:
 * - Dano = Combat + bônus de condições
 * - Sem sistema de esquiva por rolagem (QTE é usado para jogadores)
 */
export function executeAttack(
  attacker: BattleUnit,
  target: BattleUnit | null,
  allUnits: BattleUnit[],
  _skill: AbilityDefinition,
  damageType: DamageTypeName = "FISICO",
  obstacle?: BattleObstacle,
  battleId?: string
): AttackActionResult {
  if (!attacker.features.includes("ATTACK")) {
    return { success: false, error: "Unit cannot attack" };
  }
  if (!attacker.isAlive) {
    return { success: false, error: "Dead unit cannot attack" };
  }

  // === MAGIC_WEAPON: Converter dano físico em mágico ===
  let effectiveDamageType: DamageTypeName = damageType;
  if (
    attacker.conditions.includes("MAGIC_WEAPON") &&
    effectiveDamageType === "FISICO"
  ) {
    effectiveDamageType = "MAGICO";
  }

  // === SISTEMA DE MÚLTIPLOS ATAQUES (extraAttacks) ===
  const hasAttacksRemaining = attacker.attacksLeftThisTurn > 0;

  if (!hasAttacksRemaining) {
    if (attacker.actionsLeft <= 0) {
      return { success: false, error: "No actions left this turn" };
    }
  }

  // Varredura de condições do atacante
  const attackerScan = scanConditionsForAction(attacker.conditions, "ATTACK");
  if (!attackerScan.canPerform) {
    return { success: false, error: attackerScan.blockReason };
  }

  // Determinar tipo de alvo e posição
  let targetX: number;
  let targetY: number;
  let targetType: "unit" | "corpse" | "obstacle";

  if (obstacle) {
    targetX = obstacle.posX;
    targetY = obstacle.posY;
    targetType = "obstacle";
  } else if (target) {
    targetX = target.posX;
    targetY = target.posY;
    targetType = target.isAlive ? "unit" : "corpse";
  } else {
    return { success: false, error: "No target specified" };
  }

  // Calcula alcance de ataque dinâmico (base 1 + modificadores de condições)
  const baseAttackRange = 1;
  const attackRangeMod = attackerScan.modifiers.basicAttackRangeMod || 0;
  const effectiveAttackRange = baseAttackRange + attackRangeMod;

  // Verificar se o alvo está dentro do alcance de ataque (8 direções)
  if (
    !isWithinRange(
      attacker.posX,
      attacker.posY,
      targetX,
      targetY,
      effectiveAttackRange
    )
  ) {
    return {
      success: false,
      error:
        effectiveAttackRange === 1
          ? "Target must be adjacent"
          : `Target must be within ${effectiveAttackRange} tiles`,
    };
  }

  // === CONSUMO DE AÇÃO E ATAQUES EXTRAS ===
  if (!hasAttacksRemaining) {
    attacker.actionsLeft = Math.max(0, attacker.actionsLeft - 1);
    const hasProtection =
      attacker.physicalProtection > 0 || attacker.magicalProtection > 0;
    const extraAttacks = getExtraAttacksFromConditions(
      attacker.conditions,
      hasProtection
    );
    attacker.attacksLeftThisTurn = extraAttacks;
  } else {
    attacker.attacksLeftThisTurn = Math.max(
      0,
      attacker.attacksLeftThisTurn - 1
    );
  }

  // === CÁLCULO DE DANO (SEM DADOS) ===
  // Dano = Combat + bônus de condições
  const bonusDamage = attackerScan.modifiers.bonusDamage || 0;
  const rawDamage = Math.max(1, attacker.combat) + bonusDamage;

  // === LÓGICA ESPECÍFICA POR TIPO DE ALVO ===

  if (targetType === "obstacle" && obstacle) {
    const obstacleHp = obstacle.hp ?? OBSTACLE_CONFIG.defaultHp;
    const newHp = Math.max(0, obstacleHp - rawDamage);
    const destroyed = newHp <= 0;

    obstacle.hp = newHp;
    obstacle.destroyed = destroyed;

    attacker.conditions = applyConditionScanResult(
      attacker.conditions,
      attackerScan
    );

    return {
      success: true,
      targetType: "obstacle",
      rawDamage,
      damageReduction: 0,
      finalDamage: rawDamage,
      damageType: effectiveDamageType,
      targetHpAfter: newHp,
      obstacleDestroyed: destroyed,
      obstacleId: obstacle.id,
      targetDefeated: destroyed,
      attacksLeftThisTurn: attacker.attacksLeftThisTurn,
    };
  }

  if (targetType === "corpse" && target) {
    const corpseHp = OBSTACLE_CONFIG.corpseHp;
    const destroyed = rawDamage >= corpseHp;

    if (destroyed) {
      applyConditionToUnit(target, "CORPSE_REMOVED");
    }

    attacker.conditions = applyConditionScanResult(
      attacker.conditions,
      attackerScan
    );

    return {
      success: true,
      targetType: "corpse",
      rawDamage,
      damageReduction: 0,
      finalDamage: rawDamage,
      damageType: effectiveDamageType,
      targetHpAfter: 0,
      targetDefeated: destroyed,
      attacksLeftThisTurn: attacker.attacksLeftThisTurn,
    };
  }

  // === ATACANDO UNIDADE VIVA ===
  if (!target || !target.isAlive) {
    return { success: false, error: "Target unit is not alive" };
  }

  // Varredura de condições do alvo
  const targetScan = scanConditionsForAction(target.conditions, "ATTACK");

  // === APLICAR DANO ===
  // Redução de dano apenas por condições
  const damageReduction = targetScan.modifiers.damageReduction || 0;
  const damageToApply = Math.max(0, rawDamage - damageReduction);

  // === VERIFICAR TRANSFERÊNCIA DE DANO PARA EIDOLON ===
  // Se o alvo tem EIDOLON_PROTECTION e está adjacente ao Eidolon
  const eidolonToTransfer = shouldTransferDamageToEidolon(target, allUnits);

  let eidolonDefeated = false;
  let damageTransferredToEidolon = false;

  if (eidolonToTransfer) {
    // Dano é transferido como DANO VERDADEIRO para o Eidolon
    const transferResult = transferDamageToEidolon(
      eidolonToTransfer,
      damageToApply
    );
    eidolonDefeated = transferResult.eidolonDefeated;
    damageTransferredToEidolon = true;

    // Se Eidolon morreu, processar reset de bônus
    if (eidolonDefeated) {
      processEidolonDeath(eidolonToTransfer, "battle");
    }

    // Aplicar expiração de condições (mesmo sem dano no alvo)
    attacker.conditions = applyConditionScanResult(
      attacker.conditions,
      attackerScan
    );
    target.conditions = applyConditionScanResult(target.conditions, targetScan);

    return {
      success: true,
      targetType: "unit",
      rawDamage,
      damageReduction,
      finalDamage: damageToApply,
      damageType: effectiveDamageType,
      targetHpAfter: target.currentHp, // Alvo não recebeu dano
      targetPhysicalProtection: target.physicalProtection,
      targetMagicalProtection: target.magicalProtection,
      targetDefeated: false,
      attacksLeftThisTurn: attacker.attacksLeftThisTurn,
      damageTransferredToEidolon: true,
      eidolonDefeated,
    };
  }

  // Aplicar dano na proteção apropriada (fluxo normal)
  const protectionResult = applyDamage(
    target.physicalProtection,
    target.magicalProtection,
    target.currentHp,
    damageToApply,
    effectiveDamageType
  );

  target.physicalProtection = protectionResult.newPhysicalProtection;
  target.magicalProtection = protectionResult.newMagicalProtection;
  target.currentHp = protectionResult.newHp;

  // Aplicar expiração de condições
  attacker.conditions = applyConditionScanResult(
    attacker.conditions,
    attackerScan
  );
  target.conditions = applyConditionScanResult(target.conditions, targetScan);

  let targetDefeated = false;
  let killedSummons: BattleUnit[] = [];
  if (target.currentHp <= 0) {
    targetDefeated = true;
    const deathResult = processUnitDeath(
      target,
      allUnits,
      attacker,
      "battle",
      battleId
    );
    killedSummons = deathResult.killedSummons;
  }

  return {
    success: true,
    targetType: "unit",
    rawDamage,
    damageReduction,
    finalDamage: damageToApply,
    damageType: effectiveDamageType,
    targetHpAfter: target.currentHp,
    targetPhysicalProtection: target.physicalProtection,
    targetMagicalProtection: target.magicalProtection,
    targetDefeated,
    attacksLeftThisTurn: attacker.attacksLeftThisTurn,
    killedSummonIds: killedSummons.map((s) => s.id),
  };
}

/**
 * Wrapper para executeAttack que se encaixa na assinatura de SkillExecutorFn
 * Usado pelo sistema de skills para ação comum de ataque
 *
 * FLUXO UNIFICADO:
 * 1. Valida se pode atacar (ações, condições, alcance)
 * 2. Se alvo é unidade viva → retorna requiresQTE: true (QTE será iniciado pelo handler)
 * 3. Se alvo é obstáculo → executa ataque direto
 * 4. Se ataque no ar → executa miss
 */
export function executeAttackSkill(
  caster: BattleUnit,
  target: BattleUnit | null,
  allUnits: BattleUnit[],
  skill: AbilityDefinition,
  context?: SkillExecutionContext
): AbilityExecutionResult {
  // === VALIDAÇÕES BÁSICAS ===
  if (!caster.features.includes("ATTACK")) {
    return { success: false, error: "Unidade não pode atacar" };
  }
  if (!caster.isAlive) {
    return { success: false, error: "Unidade morta não pode atacar" };
  }

  // === VERIFICAR RECURSOS ===
  const hasAttacksRemaining = caster.attacksLeftThisTurn > 0;
  if (!hasAttacksRemaining && caster.actionsLeft <= 0) {
    return { success: false, error: "Sem ações disponíveis" };
  }

  // === VERIFICAR CONDIÇÕES DO ATACANTE ===
  const attackerScan = scanConditionsForAction(caster.conditions, "ATTACK");
  if (!attackerScan.canPerform) {
    return { success: false, error: attackerScan.blockReason };
  }

  // === DETERMINAR ALVO ===
  const targetPosition = context?.targetPosition;

  // Se temos um target direto (unidade)
  if (target && "id" in target) {
    // Verificar alcance
    const baseAttackRange = 1;
    const attackRangeMod = attackerScan.modifiers.basicAttackRangeMod || 0;
    const effectiveAttackRange = baseAttackRange + attackRangeMod;

    if (
      !isWithinRange(
        caster.posX,
        caster.posY,
        target.posX,
        target.posY,
        effectiveAttackRange
      )
    ) {
      return { success: false, error: "Alvo fora de alcance" };
    }

    // Executar ataque direto (QTE foi removido do sistema)
    return executeAttack(
      caster,
      target,
      allUnits,
      skill,
      "FISICO",
      undefined,
      context?.battleId
    );
  }

  // Se temos targetPosition, verificar o que há nessa posição
  if (targetPosition) {
    // Verificar alcance
    const baseAttackRange = 1;
    const attackRangeMod = attackerScan.modifiers.basicAttackRangeMod || 0;
    const effectiveAttackRange = baseAttackRange + attackRangeMod;

    if (
      !isWithinRange(
        caster.posX,
        caster.posY,
        targetPosition.x,
        targetPosition.y,
        effectiveAttackRange
      )
    ) {
      return { success: false, error: "Posição fora de alcance" };
    }

    // Verificar se há unidade na posição (considerando tamanho)
    const unitAtPos = allUnits.find((u) => {
      if (!u.isAlive) return false;
      const sizeDef = getUnitSizeDefinition(u.size as UnitSize);
      const dimension = sizeDef.dimension;
      for (let dx = 0; dx < dimension; dx++) {
        for (let dy = 0; dy < dimension; dy++) {
          if (
            u.posX + dx === targetPosition.x &&
            u.posY + dy === targetPosition.y
          ) {
            return true;
          }
        }
      }
      return false;
    });
    if (unitAtPos) {
      // Executar ataque direto na unidade encontrada
      return executeAttack(
        caster,
        unitAtPos,
        allUnits,
        skill,
        "FISICO",
        undefined,
        context?.battleId
      );
    }

    // Verificar se há obstáculo na posição (considerando tamanho)
    const obstacleAtPos = context?.obstacles?.find((o) => {
      if (o.destroyed) return false;
      const dimension = getObstacleDimension(
        (o.size || "SMALL") as ObstacleSize
      );
      for (let dx = 0; dx < dimension; dx++) {
        for (let dy = 0; dy < dimension; dy++) {
          if (
            o.posX + dx === targetPosition.x &&
            o.posY + dy === targetPosition.y
          ) {
            return true;
          }
        }
      }
      return false;
    });
    if (obstacleAtPos) {
      // Ataque em obstáculo - executa direto
      const obstacle = {
        id: obstacleAtPos.id,
        posX: obstacleAtPos.posX,
        posY: obstacleAtPos.posY,
        type: "default" as any,
        size: (obstacleAtPos.size || "SMALL") as any,
        hp: obstacleAtPos.hp || 0,
        destroyed: obstacleAtPos.destroyed || false,
      };
      return executeAttack(
        caster,
        null,
        allUnits,
        skill,
        "FISICO",
        obstacle,
        context?.battleId
      );
    }

    // Ataque no ar (miss) - consumir recurso e retornar
    if (caster.attacksLeftThisTurn > 0) {
      caster.attacksLeftThisTurn--;
    } else {
      caster.actionsLeft = Math.max(0, caster.actionsLeft - 1);
    }

    return {
      success: true,
      missed: true,
      casterActionsLeft: caster.actionsLeft,
      attacksLeftThisTurn: caster.attacksLeftThisTurn,
      damageDealt: 0,
    };
  }

  return { success: false, error: "Nenhum alvo especificado" };
}
