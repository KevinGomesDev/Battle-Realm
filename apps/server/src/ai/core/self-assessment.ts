// server/src/ai/core/self-assessment.ts
// Avaliação do estado próprio da unidade IA

import { BattleUnit } from "@boundless/shared/types/battle.types";
import type { AISelfAssessment, AIProfile } from "../types/ai.types";

/**
 * Avalia o estado atual da unidade para tomada de decisões
 */
export function assessSelf(
  unit: BattleUnit,
  profile: AIProfile
): AISelfAssessment {
  const hpPercent = unit.maxHp > 0 ? unit.currentHp / unit.maxHp : 0;

  const hasPhysicalProtection = unit.physicalProtection > 0;
  const hasMagicalProtection = unit.magicalProtection > 0;

  // Determinar último tipo de dano baseado nas proteções perdidas
  // Se proteção física < max, provavelmente recebeu dano físico
  // Se proteção mágica < max, provavelmente recebeu dano mágico
  let lastDamageType: "FISICO" | "MAGICO" | "VERDADEIRO" | undefined;

  const physLost = (unit.maxPhysicalProtection ?? 0) - unit.physicalProtection;
  const magLost = (unit.maxMagicalProtection ?? 0) - unit.magicalProtection;

  if (physLost > magLost && physLost > 0) {
    lastDamageType = "FISICO";
  } else if (magLost > physLost && magLost > 0) {
    lastDamageType = "MAGICO";
  } else if (hpPercent < 1 && physLost === 0 && magLost === 0) {
    // Perdeu HP mas não proteção = dano verdadeiro
    lastDamageType = "VERDADEIRO";
  }

  const isCritical = hpPercent <= 0.25;
  const isWounded = hpPercent <= 0.5;

  // Decidir se deve defender ou recuar
  const shouldRetreat = hpPercent <= profile.retreatThreshold;
  const shouldDefend = isWounded && !shouldRetreat;

  return {
    hpPercent,
    isCritical,
    isWounded,
    hasPhysicalProtection,
    physicalProtectionAmount: unit.physicalProtection,
    hasMagicalProtection,
    magicalProtectionAmount: unit.magicalProtection,
    lastDamageType,
    shouldDefend,
    shouldRetreat,
  };
}

/**
 * Calcula modificador de agressividade baseado no estado
 * Retorna um multiplicador (0.0 a 2.0)
 */
export function getAggressionModifier(assessment: AISelfAssessment): number {
  let modifier = 1.0;

  // Se está crítico, menos agressivo
  if (assessment.isCritical) {
    modifier *= 0.3;
  } else if (assessment.isWounded) {
    modifier *= 0.6;
  }

  // Se tem proteções, mais confiante
  if (assessment.hasPhysicalProtection) {
    modifier *= 1.2;
  }
  if (assessment.hasMagicalProtection) {
    modifier *= 1.1;
  }

  // Se deve recuar, não ser agressivo
  if (assessment.shouldRetreat) {
    modifier *= 0.2;
  }

  return Math.max(0.1, Math.min(2.0, modifier));
}

/**
 * Verifica se a unidade pode se dar ao luxo de atacar um alvo
 * Considera: HP próprio, proteções, perigo do alvo
 */
export function canAffordToAttack(
  unit: BattleUnit,
  target: BattleUnit,
  assessment: AISelfAssessment
): boolean {
  // Se está em estado crítico, só atacar se puder matar
  if (assessment.isCritical) {
    const estimatedDamage = Math.max(1, unit.combat - target.resistance);
    return target.currentHp <= estimatedDamage * 2;
  }

  // Se tem proteção, pode atacar mais livremente
  if (assessment.hasPhysicalProtection || assessment.hasMagicalProtection) {
    return true;
  }

  // Se o alvo pode nos matar em um hit, cuidado
  const targetDamage = Math.max(1, target.combat - unit.resistance);
  if (targetDamage >= unit.currentHp) {
    // Só atacar se pudermos matar também
    const ourDamage = Math.max(1, unit.combat - target.resistance);
    return ourDamage >= target.currentHp;
  }

  return true;
}

/**
 * Avalia se devemos usar proteção baseado no último dano
 */
export function shouldUseDefensiveSkill(
  assessment: AISelfAssessment,
  skillType: "physical" | "magical" | "generic"
): boolean {
  // Se já tem a proteção relevante, não precisa
  if (skillType === "physical" && assessment.hasPhysicalProtection) {
    return false;
  }
  if (skillType === "magical" && assessment.hasMagicalProtection) {
    return false;
  }

  // Se está ferido e o último dano foi do tipo que a skill protege
  if (assessment.isWounded) {
    if (assessment.lastDamageType === "FISICO" && skillType === "physical") {
      return true;
    }
    if (assessment.lastDamageType === "MAGICO" && skillType === "magical") {
      return true;
    }
    // Se não sabe o tipo, skill genérica é boa
    if (!assessment.lastDamageType && skillType === "generic") {
      return true;
    }
  }

  // Se está crítico, qualquer proteção ajuda
  if (assessment.isCritical) {
    return true;
  }

  return false;
}

/**
 * Calcula prioridade de fuga baseado no estado
 * Retorna 0-100 (0 = não fugir, 100 = fugir imediatamente)
 */
export function getRetreatPriority(
  unit: BattleUnit,
  assessment: AISelfAssessment,
  nearbyEnemyCount: number
): number {
  let priority = 0;

  // Base: HP perdido
  priority += (1 - assessment.hpPercent) * 40;

  // Crítico: alta prioridade
  if (assessment.isCritical) {
    priority += 30;
  }

  // Muitos inimigos próximos
  priority += nearbyEnemyCount * 10;

  // Sem proteções
  if (!assessment.hasPhysicalProtection && !assessment.hasMagicalProtection) {
    priority += 10;
  }

  // Se deve recuar segundo o perfil
  if (assessment.shouldRetreat) {
    priority += 20;
  }

  return Math.min(100, priority);
}
