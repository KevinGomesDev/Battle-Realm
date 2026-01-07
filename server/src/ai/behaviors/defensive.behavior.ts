// server/src/ai/behaviors/defensive.behavior.ts
// Comportamento Defensivo: Protege posição, contra-ataca

import type { SkillDefinition } from "../../../../shared/types/skills.types";
import type {
  AIDecision,
  AIBattleContext,
  AIProfile,
  AISelfAssessment,
} from "../types/ai.types";
import {
  manhattanDistance,
  findBestMoveTowards,
  findBestRetreatPosition,
} from "../core/pathfinding";
import {
  findNearestEnemy,
  getAllies,
  countThreatsAtPosition,
} from "../core/target-selection";
import { selectBestSkill } from "../core/skill-evaluator";
import { BattleUnit } from "../../../../shared/types/battle.types";
import {
  tryRetreat,
  tryDash,
  passDecision,
  fallbackDecision,
  getEffectiveAttackRange,
  trySupportSpell,
} from "./shared.behavior";

const BEHAVIOR_NAME = "Defensivo";

/**
 * Comportamento Defensivo
 * - Não avança ativamente
 * - Contra-ataca quando atacado
 * - Protege aliados fracos
 * - Usa skills defensivas/de proteção
 * - Considera proteções e último tipo de dano recebido
 */
export function makeDefensiveDecision(
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
    const enemies = units.filter(
      (u) => u.isAlive && u.ownerId !== unit.ownerId
    );
    const allies = getAllies(unit, units);
    const canAttack = (actionsRemaining ?? unit.actionsLeft ?? 0) > 0;

    const hpPercentage =
      selfAssessment?.hpPercent ?? unit.currentHp / unit.maxHp;
    const shouldRetreat =
      selfAssessment?.shouldRetreat ?? hpPercentage <= profile.retreatThreshold;

    // 1. Recuar se HP crítico
    if (shouldRetreat && movesRemaining > 0) {
      const retreatDecision = tryRetreat(unit, context, BEHAVIOR_NAME);
      if (retreatDecision) return retreatDecision;
    }

    // 2. Tentar usar spell de suporte/proteção
    const spellDecision = trySupportSpell(
      unit,
      context,
      profile,
      BEHAVIOR_NAME
    );
    if (spellDecision) return spellDecision;

    // 3. Skills defensivas baseado no último tipo de dano
    const selfBuffSkills = availableSkills.filter(
      (s) => s.effectType === "BUFF"
    );
    if (selfBuffSkills.length > 0 && hpPercentage < 0.7) {
      if (selfAssessment) {
        // Proteção física
        if (
          selfAssessment.lastDamageType === "FISICO" &&
          !selfAssessment.hasPhysicalProtection
        ) {
          const physicalBuffs = selfBuffSkills.filter(
            (s) =>
              s.code.toLowerCase().includes("resistance") ||
              s.code.toLowerCase().includes("physical") ||
              s.code.toLowerCase().includes("shield")
          );
          if (physicalBuffs.length > 0) {
            return {
              type: "SKILL",
              unitId: unit.id,
              skillCode: physicalBuffs[0].code,
              targetId: unit.id,
              reason: `${BEHAVIOR_NAME}: Proteção física (baseado em último dano)`,
            };
          }
        }
        // Proteção mágica
        if (
          selfAssessment.lastDamageType === "MAGICO" &&
          !selfAssessment.hasMagicalProtection
        ) {
          const magicalBuffs = selfBuffSkills.filter(
            (s) =>
              s.code.toLowerCase().includes("magic") ||
              s.code.toLowerCase().includes("barrier") ||
              s.code.toLowerCase().includes("ward")
          );
          if (magicalBuffs.length > 0) {
            return {
              type: "SKILL",
              unitId: unit.id,
              skillCode: magicalBuffs[0].code,
              targetId: unit.id,
              reason: `${BEHAVIOR_NAME}: Proteção mágica (baseado em último dano)`,
            };
          }
        }
      }

      // Fallback: qualquer buff
      const skillEval = selectBestSkill(unit, selfBuffSkills, units, profile);
      if (skillEval && skillEval.canUse) {
        return {
          type: "SKILL",
          unitId: unit.id,
          skillCode: skillEval.skill.code,
          targetId: unit.id,
          reason: `${BEHAVIOR_NAME}: Usando buff defensivo`,
        };
      }
    }

    // 3. Contra-atacar inimigos adjacentes
    const attackRange = getEffectiveAttackRange(unit);
    const adjacentEnemies = enemies.filter(
      (e) =>
        manhattanDistance(
          { x: unit.posX, y: unit.posY },
          { x: e.posX, y: e.posY }
        ) <= attackRange
    );

    if (adjacentEnemies.length > 0 && canAttack) {
      adjacentEnemies.sort(
        (a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp
      );
      const target = adjacentEnemies[0];

      const skillEval = selectBestSkill(unit, availableSkills, units, profile);
      if (
        skillEval &&
        skillEval.canUse &&
        skillEval.bestTarget?.id === target.id
      ) {
        return {
          type: "SKILL",
          unitId: unit.id,
          skillCode: skillEval.skill.code,
          targetId: target.id,
          reason: `${BEHAVIOR_NAME}: Contra-ataque com skill em ${target.name}`,
        };
      }

      return {
        type: "ATTACK",
        unitId: unit.id,
        targetId: target.id,
        reason: `${BEHAVIOR_NAME}: Contra-atacando ${target.name}`,
      };
    }

    // 4. Proteger aliado fraco
    if (allies.length > 0 && movesRemaining > 0) {
      const weakAlly = allies.find((a) => a.currentHp / a.maxHp < 0.5);
      if (weakAlly) {
        const distance = manhattanDistance(
          { x: unit.posX, y: unit.posY },
          { x: weakAlly.posX, y: weakAlly.posY }
        );

        if (distance > 1) {
          const moveTarget = findBestMoveTowards(
            unit,
            { x: weakAlly.posX, y: weakAlly.posY },
            Math.min(movesRemaining, 2),
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
              reason: `${BEHAVIOR_NAME}: Protegendo ${weakAlly.name}`,
            };
          }
        }
      }
    }

    // 5. Ajustar posição se muitas ameaças
    const nearestEnemy = findNearestEnemy(unit, units);
    if (nearestEnemy && movesRemaining > 0) {
      const distance = manhattanDistance(
        { x: unit.posX, y: unit.posY },
        { x: nearestEnemy.posX, y: nearestEnemy.posY }
      );

      if (distance <= 3 && distance > 1) {
        const threatsHere = countThreatsAtPosition(
          { x: unit.posX, y: unit.posY },
          enemies,
          2
        );

        if (threatsHere >= 2) {
          const retreatPos = findBestRetreatPosition(
            unit,
            enemies,
            1,
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
              reason: `${BEHAVIOR_NAME}: Ajustando posição defensiva`,
            };
          }
        }
      }
    }

    // 6. Usar corrida para proteger aliado mais rápido
    const dashDecision = tryDash(unit, context, BEHAVIOR_NAME);
    if (dashDecision) return dashDecision;

    // 7. Manter posição
    return passDecision(unit, BEHAVIOR_NAME);
  } catch (error) {
    console.error(`[AI ${BEHAVIOR_NAME}] Erro no comportamento: ${error}`);
    return fallbackDecision(unit, BEHAVIOR_NAME);
  }
}
