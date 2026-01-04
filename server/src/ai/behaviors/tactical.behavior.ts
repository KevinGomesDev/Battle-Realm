// server/src/ai/behaviors/tactical.behavior.ts
// Comportamento Tático: Equilibrado, considera posicionamento

import type { SkillDefinition } from "../../../../shared/types/skills.types";
import type {
  AIDecision,
  AIBattleContext,
  AIProfile,
  AISelfAssessment,
} from "../types/ai.types";
import { manhattanDistance, findBestMoveTowards } from "../core/pathfinding";
import {
  selectBestTarget,
  isUnitInDanger,
  countThreatsAtPosition,
} from "../core/target-selection";
import { BattleUnit } from "../../../../shared/types/battle.types";
import {
  tryExplore,
  tryAnySkill,
  tryRetreat,
  tryDash,
  passDecision,
  fallbackDecision,
  getEffectiveAttackRange,
  tryAnySpell,
} from "./shared.behavior";

const BEHAVIOR_NAME = "Tático";

/**
 * Comportamento Tático
 * - Avalia situação antes de agir
 * - Recua se HP baixo
 * - Prefere posições seguras
 * - Usa skills estrategicamente
 * - Considera proteções e estado próprio
 */
export function makeTacticalDecision(
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

    const canAttack = (actionsRemaining ?? unit.actionsLeft ?? 0) > 0;
    const attackRange = getEffectiveAttackRange(unit);
    const bestTarget = selectBestTarget(unit, units, profile, attackRange);
    const hasTargetInRange = bestTarget
      ? manhattanDistance(
          { x: unit.posX, y: unit.posY },
          { x: bestTarget.posX, y: bestTarget.posY }
        ) <= attackRange
      : false;

    // 1. Verificar se está em perigo
    const inDanger =
      selfAssessment?.shouldRetreat ||
      isUnitInDanger(unit, units, profile.retreatThreshold);

    if (inDanger) {
      // Atacar antes de recuar se possível
      if (canAttack && hasTargetInRange && bestTarget) {
        return {
          type: "ATTACK",
          unitId: unit.id,
          targetId: bestTarget.id,
          reason: `${BEHAVIOR_NAME}: Atacar ${bestTarget.name} (último recurso)`,
        };
      }

      // Tentar recuar
      const retreatDecision = tryRetreat(unit, context, BEHAVIOR_NAME);
      if (retreatDecision) return retreatDecision;
    }

    // 2. Tentar usar spell (magias podem ser mais poderosas)
    const spellDecision = tryAnySpell(unit, context, profile, BEHAVIOR_NAME);
    if (spellDecision) return spellDecision;

    // 3. Tentar usar skill
    const skillDecision = tryAnySkill(
      unit,
      context,
      profile,
      availableSkills,
      BEHAVIOR_NAME
    );
    if (skillDecision) return skillDecision;

    // 3. Avaliar ataque considerando ameaças
    if (bestTarget) {
      const distance = manhattanDistance(
        { x: unit.posX, y: unit.posY },
        { x: bestTarget.posX, y: bestTarget.posY }
      );

      if (distance <= attackRange && canAttack) {
        const threatsNearby = countThreatsAtPosition(
          { x: unit.posX, y: unit.posY },
          enemies,
          attackRange
        );
        const hpPercent =
          selfAssessment?.hpPercent ?? unit.currentHp / unit.maxHp;
        const hasProtection =
          selfAssessment?.hasPhysicalProtection ||
          selfAssessment?.hasMagicalProtection;

        // Só atacar em situação favorável
        if (threatsNearby <= 2 || hpPercent > 0.5 || hasProtection) {
          return {
            type: "ATTACK",
            unitId: unit.id,
            targetId: bestTarget.id,
            reason: `${BEHAVIOR_NAME}: Atacar ${bestTarget.name} (situação favorável)`,
          };
        }
      }

      // Mover se seguro
      if (movesRemaining > 0) {
        const moveTarget = findBestMoveTowards(
          unit,
          { x: bestTarget.posX, y: bestTarget.posY },
          movesRemaining,
          gridSize.width,
          gridSize.height,
          units,
          obstacles
        );

        if (moveTarget) {
          const threatsAtDestination = countThreatsAtPosition(
            moveTarget,
            enemies,
            attackRange
          );

          if (threatsAtDestination <= 2) {
            return {
              type: "MOVE",
              unitId: unit.id,
              targetPosition: moveTarget,
              reason: `${BEHAVIOR_NAME}: Aproximar de ${bestTarget.name}`,
            };
          }
        }
      }
    }

    // 4. Explorar se não há inimigos
    const exploreDecision = tryExplore(unit, context, BEHAVIOR_NAME);
    if (exploreDecision) return exploreDecision;

    // 5. Usar corrida se ainda tem ações e está longe do alvo
    const dashDecision = tryDash(unit, context, BEHAVIOR_NAME);
    if (dashDecision) return dashDecision;

    // 6. Passar turno
    return passDecision(unit, BEHAVIOR_NAME);
  } catch (error) {
    console.error(`[AI ${BEHAVIOR_NAME}] Erro no comportamento: ${error}`);
    return fallbackDecision(unit, BEHAVIOR_NAME);
  }
}
