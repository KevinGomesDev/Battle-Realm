// server/src/ai/behaviors/shared.behavior.ts
// Funções reutilizáveis compartilhadas entre todos os behaviors

import type { SkillDefinition } from "../../../../shared/types/skills.types";
import type { SpellDefinition } from "../../../../shared/types/spells.types";
import type {
  AIDecision,
  AIBattleContext,
  AIProfile,
  AISelfAssessment,
} from "../types/ai.types";
import { manhattanDistance, findBestMoveTowards } from "../core/pathfinding";
import {
  selectBestTarget,
  findNearestEnemy,
  getVisibleEnemies,
  shouldExplore,
  getExplorationTarget,
  canDefeatTarget,
} from "../core/target-selection";
import { selectBestSkill } from "../core/skill-evaluator";
import { selectBestSpell } from "../core/spell-evaluator";
import { BattleUnit } from "../../../../shared/types/battle.types";
import { scanConditionsForAction } from "../../logic/conditions";

// =============================================================================
// TIPOS
// =============================================================================

export interface BehaviorContext extends AIBattleContext {
  selfAssessment?: AISelfAssessment;
  /** Spells disponíveis para a unidade */
  availableSpells?: SpellDefinition[];
}

// =============================================================================
// UTILITÁRIOS
// =============================================================================

/**
 * Calcula o alcance efetivo de ataque básico baseado nas condições da unidade
 * @param unit Unidade para verificar
 * @returns Alcance de ataque (base 1 + modificadores de condições)
 */
export function getEffectiveAttackRange(unit: BattleUnit): number {
  const baseRange = 1;
  const scan = scanConditionsForAction(unit.conditions || [], "attack");
  return baseRange + (scan.modifiers.basicAttackRangeMod || 0);
}

// =============================================================================
// EXPLORAÇÃO
// =============================================================================

/**
 * Tenta explorar o mapa quando não há inimigos visíveis
 * @returns AIDecision se deve explorar, null caso contrário
 */
export function tryExplore(
  unit: BattleUnit,
  context: BehaviorContext,
  behaviorName: string
): AIDecision | null {
  const { units, obstacles, gridSize, movesRemaining } = context;

  if (!shouldExplore(unit, units) || movesRemaining <= 0) {
    return null;
  }

  const explorationTarget = getExplorationTarget(
    unit,
    units,
    gridSize.width,
    gridSize.height
  );

  const moveTarget = findBestMoveTowards(
    unit,
    explorationTarget,
    movesRemaining,
    gridSize.width,
    gridSize.height,
    units,
    obstacles
  );

  if (moveTarget) {
    return {
      type: "MOVE",
      unitId: unit.id,
      targetPosition: moveTarget,
      reason: `${behaviorName}: Explorando em busca de inimigos`,
    };
  }

  return null;
}

// =============================================================================
// SKILLS
// =============================================================================

/**
 * Tenta usar a melhor skill ofensiva disponível
 * @returns AIDecision se deve usar skill, null caso contrário
 */
export function tryOffensiveSkill(
  unit: BattleUnit,
  context: BehaviorContext,
  profile: AIProfile,
  availableSkills: SkillDefinition[],
  behaviorName: string
): AIDecision | null {
  const { units } = context;

  const skillEval = selectBestSkill(unit, availableSkills, units, profile);

  if (skillEval && skillEval.canUse && skillEval.skill.targetType === "ENEMY") {
    return {
      type: "SKILL",
      unitId: unit.id,
      skillCode: skillEval.skill.code,
      targetId: skillEval.bestTarget!.id,
      reason: `${behaviorName}: ${skillEval.reason}`,
    };
  }

  return null;
}

/**
 * Tenta usar qualquer skill disponível (ofensiva, suporte, etc)
 * @returns AIDecision se deve usar skill, null caso contrário
 */
export function tryAnySkill(
  unit: BattleUnit,
  context: BehaviorContext,
  profile: AIProfile,
  availableSkills: SkillDefinition[],
  behaviorName: string
): AIDecision | null {
  const { units } = context;

  const skillEval = selectBestSkill(unit, availableSkills, units, profile);

  if (skillEval && skillEval.canUse && skillEval.bestTarget) {
    return {
      type: "SKILL",
      unitId: unit.id,
      skillCode: skillEval.skill.code,
      targetId: skillEval.bestTarget.id,
      reason: `${behaviorName}: ${skillEval.reason}`,
    };
  }

  return null;
}

// =============================================================================
// SPELLS (MAGIAS)
// =============================================================================

/**
 * Tenta usar a melhor spell ofensiva disponível
 * @returns AIDecision se deve usar spell, null caso contrário
 */
export function tryOffensiveSpell(
  unit: BattleUnit,
  context: BehaviorContext,
  profile: AIProfile,
  behaviorName: string
): AIDecision | null {
  const { units, availableSpells } = context;

  if (!availableSpells || availableSpells.length === 0) {
    return null;
  }

  // Filtrar apenas spells ofensivas (ENEMY ou POSITION com efeito de dano)
  const offensiveSpells = availableSpells.filter(
    (s) => s.targetType === "ENEMY" || s.targetType === "POSITION"
  );

  if (offensiveSpells.length === 0) {
    return null;
  }

  const spellEval = selectBestSpell(unit, offensiveSpells, units, profile);

  if (spellEval && spellEval.canUse && spellEval.bestTarget) {
    const target = spellEval.bestTarget;
    const isPosition = "x" in target && "y" in target;

    return {
      type: "SPELL",
      unitId: unit.id,
      spellCode: spellEval.spell.code,
      targetPosition: isPosition
        ? target
        : { x: (target as BattleUnit).posX, y: (target as BattleUnit).posY },
      targetId: isPosition ? undefined : (target as BattleUnit).id,
      reason: `${behaviorName}: ${spellEval.reason}`,
    };
  }

  return null;
}

/**
 * Tenta usar a melhor spell de suporte disponível
 * @returns AIDecision se deve usar spell, null caso contrário
 */
export function trySupportSpell(
  unit: BattleUnit,
  context: BehaviorContext,
  profile: AIProfile,
  behaviorName: string
): AIDecision | null {
  const { units, availableSpells } = context;

  if (!availableSpells || availableSpells.length === 0) {
    return null;
  }

  // Filtrar apenas spells de suporte (SELF ou ALLY)
  const supportSpells = availableSpells.filter(
    (s) => s.targetType === "SELF" || s.targetType === "ALLY"
  );

  if (supportSpells.length === 0) {
    return null;
  }

  const spellEval = selectBestSpell(unit, supportSpells, units, profile);

  if (spellEval && spellEval.canUse && spellEval.bestTarget) {
    const target = spellEval.bestTarget as BattleUnit;

    return {
      type: "SPELL",
      unitId: unit.id,
      spellCode: spellEval.spell.code,
      targetId: target.id,
      reason: `${behaviorName}: ${spellEval.reason}`,
    };
  }

  return null;
}

/**
 * Tenta usar qualquer spell disponível
 * @returns AIDecision se deve usar spell, null caso contrário
 */
export function tryAnySpell(
  unit: BattleUnit,
  context: BehaviorContext,
  profile: AIProfile,
  behaviorName: string
): AIDecision | null {
  const { units, availableSpells } = context;

  if (!availableSpells || availableSpells.length === 0) {
    return null;
  }

  const spellEval = selectBestSpell(unit, availableSpells, units, profile);

  if (spellEval && spellEval.canUse && spellEval.bestTarget) {
    const target = spellEval.bestTarget;
    const isPosition = "x" in target && "y" in target && !("id" in target);

    return {
      type: "SPELL",
      unitId: unit.id,
      spellCode: spellEval.spell.code,
      targetPosition: isPosition
        ? (target as { x: number; y: number })
        : { x: (target as BattleUnit).posX, y: (target as BattleUnit).posY },
      targetId: isPosition ? undefined : (target as BattleUnit).id,
      reason: `${behaviorName}: ${spellEval.reason}`,
    };
  }

  return null;
}

// =============================================================================
// ATAQUE BÁSICO
// =============================================================================

/**
 * Tenta atacar o melhor alvo ao alcance
 * @returns AIDecision se deve atacar, null caso contrário
 */
export function tryBasicAttack(
  unit: BattleUnit,
  context: BehaviorContext,
  profile: AIProfile,
  behaviorName: string,
  prioritizeDefeatable: boolean = false
): AIDecision | null {
  const { units, actionsRemaining } = context;

  // Verificar se pode atacar
  const canAttack = (actionsRemaining ?? unit.actionsLeft ?? 0) > 0;
  if (!canAttack) {
    return null;
  }

  // Alcance de ataque dinâmico baseado em condições
  const attackRange = getEffectiveAttackRange(unit);
  const visibleEnemies = getVisibleEnemies(unit, units);

  // Escolher alvo
  let bestTarget: BattleUnit | null = null;

  if (prioritizeDefeatable) {
    // Priorizar alvos que podemos derrotar rapidamente
    const defeatable = visibleEnemies.filter((e) =>
      canDefeatTarget(unit, e, 3)
    );
    bestTarget =
      defeatable.length > 0
        ? selectBestTarget(
            unit,
            [...defeatable, ...units.filter((u) => u.ownerId === unit.ownerId)],
            profile,
            attackRange
          )
        : selectBestTarget(unit, units, profile, attackRange);
  } else {
    bestTarget = selectBestTarget(unit, units, profile, attackRange);
  }

  if (!bestTarget) {
    return null;
  }

  const distance = manhattanDistance(
    { x: unit.posX, y: unit.posY },
    { x: bestTarget.posX, y: bestTarget.posY }
  );

  if (distance <= attackRange) {
    return {
      type: "ATTACK",
      unitId: unit.id,
      targetId: bestTarget.id,
      reason: `${behaviorName}: Atacar ${bestTarget.name} (Combat: ${unit.combat} vs Armor: ${bestTarget.armor})`,
    };
  }

  return null;
}

// =============================================================================
// MOVIMENTO
// =============================================================================

/**
 * Tenta mover em direção ao inimigo mais próximo
 * @returns AIDecision se deve mover, null caso contrário
 */
export function tryMoveTowardsEnemy(
  unit: BattleUnit,
  context: BehaviorContext,
  behaviorName: string,
  targetEnemy?: BattleUnit | null
): AIDecision | null {
  const { units, obstacles, gridSize, movesRemaining } = context;

  if (movesRemaining <= 0) {
    return null;
  }

  // Usar alvo específico ou encontrar o mais próximo
  const target = targetEnemy || findNearestEnemy(unit, units);

  if (!target) {
    return null;
  }

  const moveTarget = findBestMoveTowards(
    unit,
    { x: target.posX, y: target.posY },
    movesRemaining,
    gridSize.width,
    gridSize.height,
    units,
    obstacles
  );

  if (moveTarget) {
    return {
      type: "MOVE",
      unitId: unit.id,
      targetPosition: moveTarget,
      reason: `${behaviorName}: Avançar para ${target.name}`,
    };
  }

  return null;
}

/**
 * Tenta mover para uma posição segura (fugir de inimigos)
 * @returns AIDecision se deve recuar, null caso contrário
 */
export function tryRetreat(
  unit: BattleUnit,
  context: BehaviorContext,
  behaviorName: string
): AIDecision | null {
  const { units, obstacles, gridSize, movesRemaining } = context;
  const { findBestRetreatPosition } = require("../core/pathfinding");

  if (movesRemaining <= 0) {
    return null;
  }

  const enemies = units.filter((u) => u.isAlive && u.ownerId !== unit.ownerId);

  if (enemies.length === 0) {
    return null;
  }

  const retreatPos = findBestRetreatPosition(
    unit,
    enemies,
    movesRemaining,
    gridSize.width,
    gridSize.height,
    units,
    obstacles
  );

  if (retreatPos) {
    return {
      type: "MOVE",
      unitId: unit.id,
      targetPosition: retreatPos,
      reason: `${behaviorName}: Recuando - HP baixo`,
    };
  }

  return null;
}

// =============================================================================
// DASH (CORRIDA)
// =============================================================================

/**
 * Verifica se a unidade pode usar DASH
 * @param unit Unidade para verificar
 * @param context Contexto da batalha
 * @returns true se pode usar dash
 */
function canUseDash(unit: BattleUnit, context: BehaviorContext): boolean {
  const { actionsRemaining } = context;
  const actionsLeft = actionsRemaining ?? unit.actionsLeft ?? 0;

  // Precisa ter ações disponíveis
  if (actionsLeft <= 0) return false;

  // Precisa ter a ação dash
  if (!unit.actions?.includes("dash")) return false;

  // Verificar se está bloqueado por condições
  const scan = scanConditionsForAction(unit.conditions || [], "dash");
  if (!scan.canPerform) return false;

  return true;
}

/**
 * Tenta usar DASH quando está longe do alvo e tem ações disponíveis
 * Útil para se aproximar mais rápido quando não consegue atacar
 * @returns AIDecision se deve usar dash, null caso contrário
 */
export function tryDash(
  unit: BattleUnit,
  context: BehaviorContext,
  behaviorName: string
): AIDecision | null {
  const { units, movesRemaining } = context;

  // Verificar se pode usar dash
  if (!canUseDash(unit, context)) {
    return null;
  }

  // Verificar se há um inimigo que ainda não conseguimos alcançar
  const nearestEnemy = findNearestEnemy(unit, units);
  if (!nearestEnemy) {
    return null;
  }

  const distanceToEnemy = manhattanDistance(
    { x: unit.posX, y: unit.posY },
    { x: nearestEnemy.posX, y: nearestEnemy.posY }
  );

  const attackRange = getEffectiveAttackRange(unit);

  // Se já está em range de ataque, não precisa de dash
  if (distanceToEnemy <= attackRange) {
    return null;
  }

  // Se ainda temos movimentos suficientes para alcançar, não precisa de dash
  if (movesRemaining >= distanceToEnemy - attackRange) {
    return null;
  }

  // Usar dash para dobrar o movimento e se aproximar mais
  return {
    type: "DASH",
    unitId: unit.id,
    reason: `${behaviorName}: Corrida para alcançar ${nearestEnemy.name}`,
  };
}

// =============================================================================
// PASS
// =============================================================================

/**
 * Retorna decisão de passar turno
 */
export function passDecision(
  unit: BattleUnit,
  behaviorName: string
): AIDecision {
  return {
    type: "PASS",
    unitId: unit.id,
    reason: `${behaviorName}: Sem ações disponíveis`,
  };
}

/**
 * Retorna decisão de fallback (erro)
 */
export function fallbackDecision(
  unit: BattleUnit,
  behaviorName: string
): AIDecision {
  return {
    type: "PASS",
    unitId: unit.id,
    reason: `${behaviorName}: Fallback por erro`,
  };
}
