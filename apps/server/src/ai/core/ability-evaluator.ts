// server/src/ai/core/ability-evaluator.ts
// Avaliação UNIFICADA de abilities (skills + spells) para a IA
// Este arquivo unifica skill-evaluator.ts e spell-evaluator.ts

import { BattleUnit } from "@boundless/shared/types/battle.types";
import type { AbilityDefinition } from "@boundless/shared/types/ability.types";
import {
  getAbilityMaxRange,
  validateAbilityUse,
  getValidAbilityTargets,
  isValidAbilityTarget,
  inferTargetType,
  isSelfAbility,
} from "@boundless/shared/utils/ability-validation";
import { getAbilityByCode } from "@boundless/shared/data/abilities.data";
import { getChebyshevDistance } from "@boundless/shared/utils/distance.utils";
import type { AIProfile, AISkillPriority } from "../types/ai.types";
import { manhattanDistance } from "./pathfinding";
import { getEnemies, getAllies } from "./target-selection";

// =============================================================================
// TIPOS
// =============================================================================

export interface AbilityEvaluation {
  ability: AbilityDefinition;
  score: number;
  validTargets: Array<BattleUnit | { x: number; y: number }>;
  bestTarget: BattleUnit | { x: number; y: number } | null;
  canUse: boolean;
  reason: string;
}

// =============================================================================
// FUNÇÕES AUXILIARES
// =============================================================================

/**
 * Obtém o range efetivo de uma ability
 */
export function getAbilityEffectiveRange(
  ability: AbilityDefinition,
  caster?: BattleUnit
): number {
  // Se não tiver caster, usar maxRange do pattern
  if (!caster) {
    const pattern = ability.targetingPattern;
    if (!pattern) return 1; // fallback melee

    // SELF abilities têm range 0
    if (pattern.origin === "CASTER") return 0;

    // Resolver maxRange se for número
    if (typeof pattern.maxRange === "number") {
      return pattern.maxRange;
    }

    return 1; // fallback melee
  }
  return getAbilityMaxRange(ability, caster);
}

/**
 * Verifica se uma ability pode ser usada em um alvo específico
 */
export function canUseAbilityOnTarget(
  caster: BattleUnit,
  target: BattleUnit,
  ability: AbilityDefinition,
  allUnits: BattleUnit[]
): boolean {
  return isValidAbilityTarget(caster, ability, target);
}

/**
 * Obtém todos os alvos válidos para uma ability
 */
export function getValidTargetsForAbility(
  caster: BattleUnit,
  ability: AbilityDefinition,
  allUnits: BattleUnit[]
): BattleUnit[] {
  return getValidAbilityTargets(caster, ability, allUnits);
}

/**
 * Obtém as abilities disponíveis para uma unidade (skills de classe + spells)
 */
export function getUnitAbilities(unit: BattleUnit): AbilityDefinition[] {
  const abilities: AbilityDefinition[] = [];

  // Adicionar skills de features (habilidades de classe)
  if (unit.features) {
    for (const featureCode of unit.features) {
      const result = getAbilityByCode(featureCode);
      if (result) {
        abilities.push(result.ability);
      }
    }
  }

  // Adicionar spells
  if (unit.spells) {
    for (const spellCode of unit.spells) {
      const result = getAbilityByCode(spellCode);
      if (result) {
        abilities.push(result.ability);
      }
    }
  }

  return abilities;
}

// =============================================================================
// AVALIADORES ESPECÍFICOS
// =============================================================================

/**
 * Avalia uma ability de dano
 */
function evaluateDamageAbility(
  caster: BattleUnit,
  ability: AbilityDefinition,
  allUnits: BattleUnit[]
): {
  score: number;
  bestTarget: BattleUnit | { x: number; y: number } | null;
  reason: string;
} {
  const enemies = getEnemies(caster, allUnits);

  if (enemies.length === 0) {
    return { score: 0, bestTarget: null, reason: "Sem inimigos" };
  }

  const targetType = inferTargetType(ability);

  // Para abilities de área (POSITION target)
  if (targetType === "POSITION") {
    let bestPos: { x: number; y: number } | null = null;
    let bestScore = 0;
    let bestHitCount = 0;

    for (const enemy of enemies) {
      const pos = { x: enemy.posX, y: enemy.posY };
      let hitCount = 0;
      let damageScore = 0;

      // Contar quantos inimigos seriam atingidos em área 3x3
      for (const target of enemies) {
        const dist = getChebyshevDistance(
          pos.x,
          pos.y,
          target.posX,
          target.posY
        );
        if (dist <= 1) {
          hitCount++;
          const hpPercent = target.currentHp / target.maxHp;
          damageScore += hpPercent <= 0.3 ? 30 : hpPercent <= 0.5 ? 20 : 10;
        }
      }

      // Verificar se não atinge aliados
      const allies = getAllies(caster, allUnits);
      let allyHit = false;
      for (const ally of allies) {
        const dist = getChebyshevDistance(pos.x, pos.y, ally.posX, ally.posY);
        if (dist <= 1 && ally.id !== caster.id) {
          allyHit = true;
          break;
        }
      }

      if (allyHit) {
        damageScore -= 50;
      }

      const totalScore = hitCount * 25 + damageScore;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestPos = pos;
        bestHitCount = hitCount;
      }
    }

    if (bestPos && bestScore > 0) {
      return {
        score: bestScore,
        bestTarget: bestPos,
        reason: `${ability.name} atinge ${bestHitCount} inimigo(s)`,
      };
    }
  }

  // Para abilities de alvo único
  const validTargets = getValidTargetsForAbility(caster, ability, allUnits);
  if (validTargets.length === 0) {
    return { score: 0, bestTarget: null, reason: "Sem alvos válidos" };
  }

  const targetsWithScores = validTargets.map((target) => {
    const hpPercentage = target.currentHp / target.maxHp;
    let score = 50;

    if (hpPercentage <= 0.3) score += 30;
    else if (hpPercentage <= 0.5) score += 15;

    if (target.currentHp <= caster.combat * 2) {
      score += 25;
    }

    return { target, score };
  });

  targetsWithScores.sort((a, b) => b.score - a.score);
  const best = targetsWithScores[0];

  return {
    score: best.score,
    bestTarget: best.target,
    reason: `Dano em ${best.target.name}`,
  };
}

/**
 * Avalia uma ability de cura
 */
function evaluateHealAbility(
  caster: BattleUnit,
  ability: AbilityDefinition,
  allUnits: BattleUnit[]
): { score: number; bestTarget: BattleUnit | null; reason: string } {
  const allies = getAllies(caster, allUnits);
  const needsHealing = allies.filter((t) => t.currentHp < t.maxHp * 0.8);

  if (needsHealing.length === 0) {
    return { score: 0, bestTarget: null, reason: "Ninguém precisa de cura" };
  }

  const targetsWithScores = needsHealing.map((target) => {
    const hpPercentage = target.currentHp / target.maxHp;
    let score = 40;
    score += (1 - hpPercentage) * 50;
    if (hpPercentage <= 0.3) score += 20;
    return { target, score };
  });

  targetsWithScores.sort((a, b) => b.score - a.score);
  const best = targetsWithScores[0];

  return {
    score: best.score,
    bestTarget: best.target,
    reason: `Curar ${best.target.name}`,
  };
}

/**
 * Avalia uma ability de buff
 */
function evaluateBuffAbility(
  caster: BattleUnit,
  ability: AbilityDefinition,
  allUnits: BattleUnit[]
): { score: number; bestTarget: BattleUnit | null; reason: string } {
  if (isSelfAbility(ability)) {
    return {
      score: 35,
      bestTarget: caster,
      reason: `${ability.name} em si mesmo`,
    };
  }

  const allies = getAllies(caster, allUnits).filter((a) => a.id !== caster.id);
  if (allies.length === 0) {
    return { score: 0, bestTarget: null, reason: "Sem aliados para buff" };
  }

  const targetsWithScores = allies.map((target) => {
    let score = 30;
    score += target.combat * 2;
    score += target.actionsLeft > 0 ? 10 : 0;
    return { target, score };
  });

  targetsWithScores.sort((a, b) => b.score - a.score);
  const best = targetsWithScores[0];

  return {
    score: best.score,
    bestTarget: best.target,
    reason: `Buff em ${best.target.name}`,
  };
}

/**
 * Avalia uma ability de debuff
 */
function evaluateDebuffAbility(
  caster: BattleUnit,
  ability: AbilityDefinition,
  allUnits: BattleUnit[]
): { score: number; bestTarget: BattleUnit | null; reason: string } {
  const enemies = getEnemies(caster, allUnits);
  if (enemies.length === 0) {
    return { score: 0, bestTarget: null, reason: "Sem alvos para debuff" };
  }

  const targetsWithScores = enemies.map((target) => {
    const hpPercentage = target.currentHp / target.maxHp;
    let score = 35;
    score += hpPercentage * 25;
    return { target, score };
  });

  targetsWithScores.sort((a, b) => b.score - a.score);
  const best = targetsWithScores[0];

  return {
    score: best.score,
    bestTarget: best.target,
    reason: `Debuff em ${best.target.name}`,
  };
}

// =============================================================================
// AVALIAÇÃO PRINCIPAL
// =============================================================================

/**
 * Avalia uma ability completamente
 */
export function evaluateAbility(
  caster: BattleUnit,
  ability: AbilityDefinition,
  allUnits: BattleUnit[],
  profile?: AIProfile
): AbilityEvaluation {
  // Verificar se pode usar
  const validation = validateAbilityUse(caster, ability, null);
  if (!validation.valid) {
    return {
      ability,
      score: 0,
      validTargets: [],
      bestTarget: null,
      canUse: false,
      reason: validation.error || "Não pode usar",
    };
  }

  const targetType = inferTargetType(ability);

  // Obter alvos válidos
  const validTargets =
    targetType === "POSITION"
      ? [] // Posições são avaliadas diferentemente
      : getValidTargetsForAbility(caster, ability, allUnits);

  // Avaliar baseado no tipo/efeito da ability
  let evaluation: {
    score: number;
    bestTarget: BattleUnit | { x: number; y: number } | null;
    reason: string;
  };

  // Detectar tipo de ability pelo efeito
  if (ability.baseDamage !== undefined || ability.effectType === "OFFENSIVE") {
    evaluation = evaluateDamageAbility(caster, ability, allUnits);
  } else if (
    ability.effectType === "HEALING" ||
    ability.code.includes("HEAL") ||
    ability.code.includes("CURE")
  ) {
    evaluation = evaluateHealAbility(caster, ability, allUnits);
  } else if (ability.effectType === "BUFF" || ability.conditionApplied) {
    // Se aplica condição benéfica, é buff (SELF, ou UNIT usado em aliados)
    if (isSelfAbility(ability)) {
      evaluation = evaluateBuffAbility(caster, ability, allUnits);
    } else {
      evaluation = evaluateDebuffAbility(caster, ability, allUnits);
    }
  } else {
    // Fallback para damage evaluation
    evaluation = evaluateDamageAbility(caster, ability, allUnits);
  }

  return {
    ability,
    score: evaluation.score,
    validTargets,
    bestTarget: evaluation.bestTarget,
    canUse: evaluation.score > 0,
    reason: evaluation.reason,
  };
}

/**
 * Avalia todas as abilities de uma unidade e retorna ordenadas por score
 */
export function evaluateAllAbilities(
  caster: BattleUnit,
  allUnits: BattleUnit[],
  profile?: AIProfile
): AbilityEvaluation[] {
  const abilities = getUnitAbilities(caster);
  const evaluations: AbilityEvaluation[] = [];

  for (const ability of abilities) {
    // Ignorar passivas
    if (ability.activationType === "PASSIVE") {
      continue;
    }

    const evaluation = evaluateAbility(caster, ability, allUnits, profile);
    if (evaluation.canUse) {
      evaluations.push(evaluation);
    }
  }

  // Ordenar por score
  evaluations.sort((a, b) => b.score - a.score);
  return evaluations;
}

/**
 * Escolhe a melhor ability para usar
 */
export function chooseBestAbility(
  caster: BattleUnit,
  allUnits: BattleUnit[],
  profile?: AIProfile
): AbilityEvaluation | null {
  const evaluations = evaluateAllAbilities(caster, allUnits, profile);
  return evaluations.length > 0 ? evaluations[0] : null;
}
