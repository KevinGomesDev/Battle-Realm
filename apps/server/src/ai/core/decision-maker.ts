// server/src/ai/core/decision-maker.ts
// Tomador de decisões principal da IA

import type { AbilityDefinition as SkillDefinition } from "@boundless/shared/types/ability.types";
import type {
  AIDecision,
  AIBattleContext,
  AIProfile,
  AIBehaviorType,
  AISelfAssessment,
  DEFAULT_AI_PROFILES,
} from "../types/ai.types";

import {
  makeAggressiveDecision,
  makeTacticalDecision,
  makeRangedDecision,
  makeSupportDecision,
  makeDefensiveDecision,
} from "../behaviors";

import { getUnitSpells } from "./ability-evaluator";

import {
  assessSelf,
  getAggressionModifier,
  getRetreatPriority,
} from "./self-assessment";
import {
  withTimeout,
  safeExecute,
  validateDecision as validateDecisionSafety,
  getFallbackDecision,
  safetyLogger,
  SafeIterator,
} from "./safety-guards";
import { BattleUnit } from "@boundless/shared/types/battle.types";

/**
 * Determina o perfil de IA para uma unidade baseado no seu tipo
 */
export function getUnitAIProfile(
  unit: BattleUnit,
  defaultProfiles: typeof DEFAULT_AI_PROFILES
): AIProfile {
  // Verificar se é um tipo conhecido
  const unitType = unit.classCode?.toUpperCase() || "MONSTER";

  // Tentar encontrar perfil específico
  if (unitType in defaultProfiles) {
    return defaultProfiles[unitType as keyof typeof defaultProfiles];
  }

  // Perfil padrão para tipos desconhecidos (agressivo básico)
  return defaultProfiles.MONSTER;
}

/**
 * Toma uma decisão para uma unidade baseado no seu perfil
 * Usa self-assessment para ajustar comportamento baseado no estado próprio
 */
export function makeDecision(
  unit: BattleUnit,
  context: AIBattleContext,
  profile: AIProfile,
  availableSkills: SkillDefinition[]
): AIDecision {
  // Avaliar estado próprio
  const selfState = safeExecute(
    () => assessSelf(unit, profile),
    {
      hpPercent: 1,
      isCritical: false,
      isWounded: false,
      hasPhysicalProtection: false,
      physicalProtectionAmount: 0,
      hasMagicalProtection: false,
      magicalProtectionAmount: 0,
      lastDamageType: undefined,
      shouldDefend: false,
      shouldRetreat: false,
    },
    "assessSelf"
  );

  // Obter spells disponíveis da unidade
  const availableSpells = safeExecute(
    () => getUnitSpells(unit),
    [],
    `getUnitSpells-${unit.name}`
  );

  // Contexto enriquecido com self-assessment e spells
  const enrichedContext = {
    ...context,
    selfAssessment: selfState,
    availableSpells,
  };

  // Se deve recuar (HP muito baixo), comportamento defensivo
  if (selfState.shouldRetreat) {
    safetyLogger.warn(
      "retreat",
      `${unit.name} está em modo de recuo (HP: ${(
        selfState.hpPercent * 100
      ).toFixed(0)}%)`
    );
    return safeExecute(
      () =>
        makeDefensiveDecision(unit, enrichedContext, profile, availableSkills),
      getFallbackDecision("retreat-fallback"),
      "makeDefensiveDecision-retreat"
    );
  }

  // Escolher behavior baseado no perfil
  return safeExecute(
    () => {
      switch (profile.behavior) {
        case "AGGRESSIVE":
          return makeAggressiveDecision(
            unit,
            enrichedContext,
            profile,
            availableSkills
          );

        case "TACTICAL":
          return makeTacticalDecision(
            unit,
            enrichedContext,
            profile,
            availableSkills
          );

        case "RANGED":
          return makeRangedDecision(
            unit,
            enrichedContext,
            profile,
            availableSkills
          );

        case "SUPPORT":
          return makeSupportDecision(
            unit,
            enrichedContext,
            profile,
            availableSkills
          );

        case "DEFENSIVE":
          return makeDefensiveDecision(
            unit,
            enrichedContext,
            profile,
            availableSkills
          );

        default:
          // Fallback para agressivo
          return makeAggressiveDecision(
            unit,
            enrichedContext,
            profile,
            availableSkills
          );
      }
    },
    getFallbackDecision("behavior-error"),
    `makeBehaviorDecision-${profile.behavior}`
  );
}

/**
 * Valida se uma decisão é executável
 */
export function validateDecision(
  decision: AIDecision,
  unit: BattleUnit,
  context: AIBattleContext
): { valid: boolean; reason?: string } {
  switch (decision.type) {
    case "MOVE":
      if (!decision.targetPosition) {
        return {
          valid: false,
          reason: "Posição de movimento não especificada",
        };
      }
      if (context.movesRemaining <= 0) {
        return { valid: false, reason: "Sem movimentos restantes" };
      }
      // Verificar se posição é válida (dentro do grid, não bloqueada)
      const { x, y } = decision.targetPosition;
      if (
        x < 0 ||
        x >= context.gridSize.width ||
        y < 0 ||
        y >= context.gridSize.height
      ) {
        return { valid: false, reason: "Posição fora do grid" };
      }
      // Verificar bloqueio
      const blocked = context.units.some(
        (u) => u.isAlive && u.posX === x && u.posY === y
      );
      if (blocked) {
        return { valid: false, reason: "Posição bloqueada por outra unidade" };
      }
      return { valid: true };

    case "ATTACK":
      if (!decision.targetId) {
        return { valid: false, reason: "Alvo de ataque não especificado" };
      }
      const attackTarget = context.units.find(
        (u) => u.id === decision.targetId && u.isAlive
      );
      if (!attackTarget) {
        return {
          valid: false,
          reason: "Alvo de ataque não encontrado ou morto",
        };
      }
      return { valid: true };

    case "SKILL":
      if (!decision.skillCode || !decision.targetId) {
        return { valid: false, reason: "Skill ou alvo não especificado" };
      }
      const skillTarget = context.units.find(
        (u) => u.id === decision.targetId && u.isAlive
      );
      if (!skillTarget) {
        return {
          valid: false,
          reason: "Alvo de skill não encontrado ou morto",
        };
      }
      return { valid: true };

    case "SPELL":
      if (!decision.spellCode) {
        return { valid: false, reason: "Spell não especificada" };
      }
      // Spells podem ter targetId OU targetPosition
      if (!decision.targetId && !decision.targetPosition) {
        return {
          valid: false,
          reason: "Alvo ou posição de spell não especificado",
        };
      }
      // Se tem targetId, verificar se é válido
      if (decision.targetId) {
        const spellTarget = context.units.find(
          (u) => u.id === decision.targetId && u.isAlive
        );
        if (!spellTarget) {
          return {
            valid: false,
            reason: "Alvo de spell não encontrado ou morto",
          };
        }
      }
      // Se tem targetPosition, verificar se está dentro do grid
      if (decision.targetPosition) {
        const { x, y } = decision.targetPosition;
        if (
          x < 0 ||
          x >= context.gridSize.width ||
          y < 0 ||
          y >= context.gridSize.height
        ) {
          return { valid: false, reason: "Posição de spell fora do grid" };
        }
      }
      return { valid: true };

    case "DASH":
      // DASH não precisa de alvo, só verificar se tem ações
      if ((context.actionsRemaining ?? 0) <= 0) {
        return { valid: false, reason: "Sem ações restantes para dash" };
      }
      return { valid: true };

    case "PASS":
      return { valid: true };

    default:
      return { valid: false, reason: "Tipo de decisão desconhecido" };
  }
}

/**
 * Gera uma decisão de fallback segura
 */
export function makeFallbackDecision(unit: BattleUnit): AIDecision {
  return {
    type: "PASS",
    unitId: unit.id,
    reason: "Fallback: Sem ações válidas disponíveis",
  };
}

/**
 * Processa uma unidade e retorna a melhor decisão válida
 * Wrapper principal com todas as travas de segurança
 */
export function processUnit(
  unit: BattleUnit,
  context: AIBattleContext,
  profile: AIProfile,
  availableSkills: SkillDefinition[]
): AIDecision {
  // Trava de segurança: unidade deve estar viva
  if (!unit || !unit.isAlive) {
    return getFallbackDecision("unit-dead-or-null");
  }

  // Trava de segurança: context válido
  if (!context || !context.units || !context.gridSize) {
    return getFallbackDecision("invalid-context");
  }

  // Fazer decisão com proteção
  const decision = safeExecute(
    () => makeDecision(unit, context, profile, availableSkills),
    getFallbackDecision("makeDecision-error"),
    `processUnit-${unit.name}`
  );

  // Validar decisão (duas camadas: lógica e segurança)
  const safeDecision = validateDecisionSafety(decision);
  const logicValidation = validateDecision(safeDecision, unit, context);

  if (logicValidation.valid) {
    return safeDecision;
  }

  // Se decisão inválida, tentar fallback
  safetyLogger.warn(
    "invalid-decision",
    `Decisão inválida para ${unit.name}: ${logicValidation.reason}. Usando fallback.`
  );
  return makeFallbackDecision(unit);
}

/**
 * Processa uma unidade com timeout
 * Versão assíncrona para garantir que nunca trave
 */
export async function processUnitWithTimeout(
  unit: BattleUnit,
  context: AIBattleContext,
  profile: AIProfile,
  availableSkills: SkillDefinition[],
  timeoutMs: number = 2000
): Promise<AIDecision> {
  return withTimeout(
    () => processUnit(unit, context, profile, availableSkills),
    getFallbackDecision("timeout"),
    timeoutMs,
    `processUnit-${unit.name}`
  );
}
