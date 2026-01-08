// server/src/ai/core/skill-evaluator.ts
// Avaliação e seleção de skills para a IA

import { BattleUnit } from "../../../../shared/types/battle.types";
import type {
  AbilityDefinition as SkillDefinition,
} from "../../../../shared/types/ability.types";
import { getAbilityMaxRange as getSkillRangeShared } from "../../../../shared/utils/ability-validation";
import type { AISkillPriority, AIProfile } from "../types/ai.types";
import { manhattanDistance } from "./pathfinding";
import { getEnemies, getAllies } from "./target-selection";
import {
  isValidAbilityTarget as isValidSkillTarget,
  getValidAbilityTargets as getValidSkillTargets,
} from "../../../../shared/utils/ability-validation";

interface SkillEvaluation {
  skill: SkillDefinition;
  score: number;
  validTargets: BattleUnit[];
  bestTarget: BattleUnit | null;
  canUse: boolean;
  reason: string;
}

/**
 * Obtém o range efetivo de uma skill
 * Wrapper para manter compatibilidade com código existente
 */
export function getSkillEffectiveRange(skill: SkillDefinition): number {
  return getSkillRangeShared(skill);
}

/**
 * Verifica se uma skill pode ser usada em um alvo específico
 * @deprecated Use isValidAbilityTarget de shared/utils/ability-validation
 */
export function canUseSkillOnTarget(
  caster: BattleUnit,
  target: BattleUnit,
  skill: SkillDefinition,
  allUnits: BattleUnit[]
): boolean {
  return isValidSkillTarget(caster, skill, target);
}

/**
 * Obtém todos os alvos válidos para uma skill
 */
export function getValidTargetsForSkill(
  caster: BattleUnit,
  skill: SkillDefinition,
  allUnits: BattleUnit[]
): BattleUnit[] {
  return getValidSkillTargets(caster, skill, allUnits);
}

/**
 * Avalia uma skill de dano
 */
function evaluateDamageSkill(
  caster: BattleUnit,
  skill: SkillDefinition,
  validTargets: BattleUnit[]
): { score: number; bestTarget: BattleUnit | null; reason: string } {
  if (validTargets.length === 0) {
    return { score: 0, bestTarget: null, reason: "Sem alvos válidos" };
  }

  // Priorizar alvos com HP baixo (para finalizar)
  const targetsWithScores = validTargets.map((target) => {
    const hpPercentage = target.currentHp / target.maxHp;
    let score = 50; // Base score

    // Bonus por HP baixo
    if (hpPercentage <= 0.3) score += 30;
    else if (hpPercentage <= 0.5) score += 15;

    // Bonus se o alvo está com HP muito baixo (potencial de kill)
    if (target.currentHp <= caster.combat * 2) {
      score += 25; // Pode matar
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
 * Avalia uma skill de cura
 */
function evaluateHealSkill(
  caster: BattleUnit,
  skill: SkillDefinition,
  validTargets: BattleUnit[]
): { score: number; bestTarget: BattleUnit | null; reason: string } {
  // Filtrar apenas aliados que precisam de cura
  const needsHealing = validTargets.filter((t) => t.currentHp < t.maxHp * 0.8);

  if (needsHealing.length === 0) {
    return { score: 0, bestTarget: null, reason: "Ninguém precisa de cura" };
  }

  // Priorizar aliados com HP mais baixo
  const targetsWithScores = needsHealing.map((target) => {
    const hpPercentage = target.currentHp / target.maxHp;
    let score = 40;

    // Quanto menor o HP, maior a prioridade
    score += (1 - hpPercentage) * 50;

    // Bonus extra se estiver crítico
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
 * Avalia uma skill de buff
 */
function evaluateBuffSkill(
  caster: BattleUnit,
  skill: SkillDefinition,
  validTargets: BattleUnit[]
): { score: number; bestTarget: BattleUnit | null; reason: string } {
  if (validTargets.length === 0) {
    return { score: 0, bestTarget: null, reason: "Sem alvos para buff" };
  }

  // Por enquanto, priorizar aliados com mais HP (que vão durar mais)
  const targetsWithScores = validTargets.map((target) => {
    const hpPercentage = target.currentHp / target.maxHp;
    let score = 30;
    score += hpPercentage * 20;
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
 * Avalia uma skill de debuff
 */
function evaluateDebuffSkill(
  caster: BattleUnit,
  skill: SkillDefinition,
  validTargets: BattleUnit[]
): { score: number; bestTarget: BattleUnit | null; reason: string } {
  if (validTargets.length === 0) {
    return { score: 0, bestTarget: null, reason: "Sem alvos para debuff" };
  }

  // Priorizar inimigos mais perigosos (com mais HP)
  const targetsWithScores = validTargets.map((target) => {
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

/**
 * Avalia uma skill completamente
 */
export function evaluateSkill(
  caster: BattleUnit,
  skill: SkillDefinition,
  allUnits: BattleUnit[],
  skillPriority: AISkillPriority
): SkillEvaluation {
  // Se prioridade é NONE, não avaliar skills
  if (skillPriority === "NONE") {
    return {
      skill,
      score: 0,
      validTargets: [],
      bestTarget: null,
      canUse: false,
      reason: "IA não usa skills",
    };
  }

  const validTargets = getValidTargetsForSkill(caster, skill, allUnits);

  if (validTargets.length === 0) {
    return {
      skill,
      score: 0,
      validTargets: [],
      bestTarget: null,
      canUse: false,
      reason: "Sem alvos válidos",
    };
  }

  // Avaliar baseado no effectType da skill
  let evaluation: {
    score: number;
    bestTarget: BattleUnit | null;
    reason: string;
  };

  // Usar effectType diretamente para decisões de IA
  const effectType = skill.effectType;

  switch (effectType) {
    case "OFFENSIVE":
      evaluation = evaluateDamageSkill(caster, skill, validTargets);
      break;
    case "HEALING":
      evaluation = evaluateHealSkill(caster, skill, validTargets);
      break;
    case "BUFF":
      evaluation = evaluateBuffSkill(caster, skill, validTargets);
      break;
    case "DEBUFF":
      evaluation = evaluateDebuffSkill(caster, skill, validTargets);
      break;
    case "UTILITY":
      // Skills utilitárias (movimento, etc) têm score base menor
      evaluation = {
        score: 15,
        bestTarget: caster, // Geralmente afeta a si mesmo
        reason: "Skill utilitária",
      };
      break;
    default:
      // Fallback: skill sem effectType definido
      evaluation = {
        score: 20,
        bestTarget: validTargets[0],
        reason: "Skill genérica",
      };
  }

  // Ajustar score baseado na prioridade
  if (skillPriority === "SMART") {
    evaluation.score *= 1.2; // Bonus para IA esperta
  }

  return {
    skill,
    score: evaluation.score,
    validTargets,
    bestTarget: evaluation.bestTarget,
    canUse: evaluation.score > 0 && evaluation.bestTarget !== null,
    reason: evaluation.reason,
  };
}

/**
 * Seleciona a melhor skill para usar
 */
export function selectBestSkill(
  caster: BattleUnit,
  availableSkills: SkillDefinition[],
  allUnits: BattleUnit[],
  profile: AIProfile
): SkillEvaluation | null {
  if (profile.skillPriority === "NONE" || availableSkills.length === 0) {
    return null;
  }

  const evaluations = availableSkills
    .map((skill) =>
      evaluateSkill(caster, skill, allUnits, profile.skillPriority)
    )
    .filter((e) => e.canUse);

  if (evaluations.length === 0) return null;

  // Ordenar por score
  evaluations.sort((a, b) => b.score - a.score);

  // Para SMART, sempre pegar a melhor
  // Para BASIC, adicionar aleatoriedade
  if (profile.skillPriority === "BASIC" && evaluations.length > 1) {
    // 70% chance de usar a melhor, 30% chance de usar qualquer outra
    if (Math.random() > 0.7) {
      const randomIndex = Math.floor(Math.random() * evaluations.length);
      return evaluations[randomIndex];
    }
  }

  return evaluations[0];
}
