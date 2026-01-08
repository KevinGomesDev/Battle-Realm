// server/src/ai/behaviors/support.behavior.ts
// Comportamento Support: Prioriza curar e buffar aliados

import type { AbilityDefinition as SkillDefinition } from "../../../../shared/types/ability.types";
import type {
  AIDecision,
  AIBattleContext,
  AIProfile,
  AISelfAssessment,
} from "../types/ai.types";
import { manhattanDistance, findBestMoveTowards } from "../core/pathfinding";
import {
  getAllies,
  findNearestEnemy,
  selectBestAllyForSupport,
} from "../core/target-selection";
import {
  selectBestSkill,
  getValidTargetsForSkill,
  getSkillEffectiveRange,
} from "../core/skill-evaluator";
import { BattleUnit } from "../../../../shared/types/battle.types";
import {
  tryRetreat,
  tryDash,
  passDecision,
  fallbackDecision,
  trySupportSpell,
} from "./shared.behavior";

const BEHAVIOR_NAME = "Support";

/**
 * Comportamento Support
 * - Prioriza cura e buffs
 * - Fica perto dos aliados
 * - Evita combate direto
 * - Foge de inimigos
 * - Considera próprio estado para auto-cura
 */
export function makeSupportDecision(
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
    const allies = getAllies(unit, units);
    const canAttack = (actionsRemaining ?? unit.actionsLeft ?? 0) > 0;

    // 1. Auto-cura se HP baixo
    if (selfAssessment?.isWounded) {
      const selfHealSkills = availableSkills.filter(
        (s) => s.effectType === "HEALING" && s.targetType === "SELF"
      );

      if (selfHealSkills.length > 0) {
        return {
          type: "SKILL",
          unitId: unit.id,
          skillCode: selfHealSkills[0].code,
          targetId: unit.id,
          reason: `${BEHAVIOR_NAME}: Auto-cura (HP baixo)`,
        };
      }
    }

    // 2. Fugir se inimigo próximo
    const nearestEnemy = findNearestEnemy(unit, units);
    if (nearestEnemy) {
      const distanceToEnemy = manhattanDistance(
        { x: unit.posX, y: unit.posY },
        { x: nearestEnemy.posX, y: nearestEnemy.posY }
      );

      const shouldFlee =
        distanceToEnemy <= 2 ||
        selfAssessment?.shouldRetreat ||
        selfAssessment?.isCritical;

      if (shouldFlee && movesRemaining > 0) {
        const retreatDecision = tryRetreat(unit, context, BEHAVIOR_NAME);
        if (retreatDecision) return retreatDecision;
      }
    }

    // 3. Tentar usar spell de suporte (curar/buffar)
    const spellDecision = trySupportSpell(
      unit,
      context,
      profile,
      BEHAVIOR_NAME
    );
    if (spellDecision) return spellDecision;

    // 4. Curar aliados que precisam com skills
    const healSkills = availableSkills.filter(
      (s) => s.effectType === "HEALING"
    );
    if (healSkills.length > 0) {
      for (const healSkill of healSkills) {
        const validTargets = getValidTargetsForSkill(unit, healSkill, units);
        const needsHealing = validTargets.filter(
          (t) => t.currentHp < t.maxHp * 0.7
        );

        if (needsHealing.length > 0) {
          needsHealing.sort(
            (a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp
          );
          return {
            type: "SKILL",
            unitId: unit.id,
            skillCode: healSkill.code,
            targetId: needsHealing[0].id,
            reason: `${BEHAVIOR_NAME}: Curando ${needsHealing[0].name}`,
          };
        }
      }
    }

    // 4. Buffar aliados
    const buffSkills = availableSkills.filter((s) => s.effectType === "BUFF");
    if (buffSkills.length > 0) {
      const skillEval = selectBestSkill(unit, buffSkills, units, profile);
      if (skillEval && skillEval.canUse) {
        return {
          type: "SKILL",
          unitId: unit.id,
          skillCode: skillEval.skill.code,
          targetId: skillEval.bestTarget!.id,
          reason: `${BEHAVIOR_NAME}: Buffando ${skillEval.bestTarget!.name}`,
        };
      }
    }

    // 5. Mover para perto de aliados
    if (allies.length > 0 && movesRemaining > 0) {
      const allyNeedingSupport = selectBestAllyForSupport(unit, units, 99);
      if (allyNeedingSupport) {
        const distance = manhattanDistance(
          { x: unit.posX, y: unit.posY },
          { x: allyNeedingSupport.posX, y: allyNeedingSupport.posY }
        );

        if (distance > 2) {
          const moveTarget = findBestMoveTowards(
            unit,
            { x: allyNeedingSupport.posX, y: allyNeedingSupport.posY },
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
              reason: `${BEHAVIOR_NAME}: Aproximando de ${allyNeedingSupport.name}`,
            };
          }
        }
      }
    }

    // 6. Ataque de oportunidade
    if (nearestEnemy && canAttack) {
      const distance = manhattanDistance(
        { x: unit.posX, y: unit.posY },
        { x: nearestEnemy.posX, y: nearestEnemy.posY }
      );

      if (distance <= 1) {
        return {
          type: "ATTACK",
          unitId: unit.id,
          targetId: nearestEnemy.id,
          reason: `${BEHAVIOR_NAME}: Ataque de oportunidade em ${nearestEnemy.name}`,
        };
      }
    }

    // 7. Usar corrida para alcançar aliados mais rápido
    const dashDecision = tryDash(unit, context, BEHAVIOR_NAME);
    if (dashDecision) return dashDecision;

    // 8. Passar turno
    return passDecision(unit, BEHAVIOR_NAME);
  } catch (error) {
    console.error(`[AI ${BEHAVIOR_NAME}] Erro no comportamento: ${error}`);
    return fallbackDecision(unit, BEHAVIOR_NAME);
  }
}
