// server/src/ai/behaviors/ranged.behavior.ts
// Comportamento Ranged: Mantém distância, ataca de longe

import type { AbilityDefinition as SkillDefinition } from "../../../../shared/types/ability.types";
import type {
  AIDecision,
  AIBattleContext,
  AIProfile,
  AISelfAssessment,
} from "../types/ai.types";
import { manhattanDistance, findPositionAtRange } from "../core/pathfinding";
import { selectBestTarget, findNearestEnemy } from "../core/target-selection";
import { selectBestSkill } from "../core/skill-evaluator";
import { BattleUnit } from "../../../../shared/types/battle.types";
import {
  tryRetreat,
  tryDash,
  passDecision,
  fallbackDecision,
  getEffectiveAttackRange,
  tryOffensiveSpell,
} from "./shared.behavior";

const BEHAVIOR_NAME = "Ranged";

/**
 * Comportamento Ranged
 * - Prioriza ataques à distância
 * - Mantém distância dos inimigos
 * - Foge se inimigos se aproximam
 * - Usa skills de dano ranged
 * - Considera estado próprio para decisões de fuga
 */
export function makeRangedDecision(
  unit: BattleUnit,
  context: AIBattleContext & { selfAssessment?: AISelfAssessment },
  profile: AIProfile,
  availableSkills: SkillDefinition[]
): AIDecision {
  try {
    const {
      units,
      obstacles,
      gridSize,
      movesRemaining,
      actionsRemaining,
      selfAssessment,
    } = context;
    const preferredRange = profile.preferredRange ?? 3;
    const canAttack = (actionsRemaining ?? unit.actionsLeft ?? 0) > 0;

    // 1. Verificar se inimigos estão muito perto
    const nearestEnemy = findNearestEnemy(unit, units);
    if (nearestEnemy) {
      const distance = manhattanDistance(
        { x: unit.posX, y: unit.posY },
        { x: nearestEnemy.posX, y: nearestEnemy.posY }
      );

      const shouldRetreat =
        selfAssessment?.shouldRetreat ||
        selfAssessment?.isCritical ||
        distance < preferredRange;

      if (shouldRetreat && movesRemaining > 0) {
        const retreatDecision = tryRetreat(unit, context, BEHAVIOR_NAME);
        if (retreatDecision) return retreatDecision;
      }
    }

    // 2. Tentar usar spell ofensiva (prioridade para ranged)
    const spellDecision = tryOffensiveSpell(
      unit,
      context,
      profile,
      BEHAVIOR_NAME
    );
    if (spellDecision) return spellDecision;

    // 3. Tentar usar skill ranged
    const rangedSkills = availableSkills.filter(
      (s) => s.range === "RANGED" || (s.rangeValue && s.rangeValue > 1)
    );

    if (rangedSkills.length > 0) {
      const skillEval = selectBestSkill(unit, rangedSkills, units, profile);
      if (skillEval && skillEval.canUse) {
        return {
          type: "SKILL",
          unitId: unit.id,
          skillCode: skillEval.skill.code,
          targetId: skillEval.bestTarget!.id,
          reason: `${BEHAVIOR_NAME}: ${skillEval.reason}`,
        };
      }
    }

    // 3. Tentar qualquer skill disponível
    const skillEval = selectBestSkill(unit, availableSkills, units, profile);
    if (skillEval && skillEval.canUse) {
      return {
        type: "SKILL",
        unitId: unit.id,
        skillCode: skillEval.skill.code,
        targetId: skillEval.bestTarget!.id,
        reason: `${BEHAVIOR_NAME}: ${skillEval.reason}`,
      };
    }

    // 4. Ataque básico se ao alcance
    const attackRange = getEffectiveAttackRange(unit);
    const bestTarget = selectBestTarget(unit, units, profile, attackRange);

    if (bestTarget) {
      const distance = manhattanDistance(
        { x: unit.posX, y: unit.posY },
        { x: bestTarget.posX, y: bestTarget.posY }
      );

      if (distance <= attackRange && canAttack) {
        return {
          type: "ATTACK",
          unitId: unit.id,
          targetId: bestTarget.id,
          reason: `${BEHAVIOR_NAME}: Atacar ${bestTarget.name} (sem opção ranged)`,
        };
      }
    }

    // 5. Mover para posição ideal de range
    if (nearestEnemy && movesRemaining > 0) {
      const idealPos = findPositionAtRange(
        unit,
        nearestEnemy,
        preferredRange,
        movesRemaining,
        gridSize.width,
        gridSize.height,
        units,
        obstacles
      );

      if (idealPos) {
        return {
          type: "MOVE",
          unitId: unit.id,
          targetPosition: idealPos,
          reason: `${BEHAVIOR_NAME}: Posicionando para ataque à distância`,
        };
      }
    }

    // 6. Usar corrida para alcançar posição ideal mais rápido
    const dashDecision = tryDash(unit, context, BEHAVIOR_NAME);
    if (dashDecision) return dashDecision;

    // 7. Passar turno
    return passDecision(unit, BEHAVIOR_NAME);
  } catch (error) {
    console.error(`[AI ${BEHAVIOR_NAME}] Erro no comportamento: ${error}`);
    return fallbackDecision(unit, BEHAVIOR_NAME);
  }
}
