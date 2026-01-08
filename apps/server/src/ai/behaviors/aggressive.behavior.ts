// server/src/ai/behaviors/aggressive.behavior.ts
// Comportamento Agressivo: Foca em atacar, persegue inimigos

import type { AbilityDefinition as SkillDefinition } from "@boundless/shared/types/ability.types";
import type {
  AIDecision,
  AIBattleContext,
  AIProfile,
  AISelfAssessment,
} from "../types/ai.types";
import { BattleUnit } from "@boundless/shared/types/battle.types";
import {
  tryExplore,
  tryOffensiveSkill,
  tryOffensiveSpell,
  tryBasicAttack,
  tryMoveTowardsEnemy,
  tryDash,
  passDecision,
  fallbackDecision,
} from "./shared.behavior";

const BEHAVIOR_NAME = "Agressivo";

/**
 * Comportamento Agressivo
 * - Sempre busca atacar
 * - Persegue o inimigo mais próximo ou mais fraco
 * - Usa skills de dano quando possível
 * - Pode considerar recuo se HP muito baixo (via self-assessment)
 * - EXPLORA se não vê nenhum inimigo
 * - CONSIDERA atributos para escolher alvos que pode derrotar
 */
export function makeAggressiveDecision(
  unit: BattleUnit,
  context: AIBattleContext & { selfAssessment?: AISelfAssessment },
  profile: AIProfile,
  availableSkills: SkillDefinition[]
): AIDecision {
  try {
    // 0. Explorar se não vê inimigos
    const exploreDecision = tryExplore(unit, context, BEHAVIOR_NAME);
    if (exploreDecision) return exploreDecision;

    // 1. Tentar usar spell ofensiva (magias são geralmente mais poderosas)
    const spellDecision = tryOffensiveSpell(
      unit,
      context,
      profile,
      BEHAVIOR_NAME
    );
    if (spellDecision) return spellDecision;

    // 2. Tentar usar skill ofensiva
    const skillDecision = tryOffensiveSkill(
      unit,
      context,
      profile,
      availableSkills,
      BEHAVIOR_NAME
    );
    if (skillDecision) return skillDecision;

    // 3. Ataque básico (prioriza alvos que pode derrotar)
    const attackDecision = tryBasicAttack(
      unit,
      context,
      profile,
      BEHAVIOR_NAME,
      true // prioritizeDefeatable
    );
    if (attackDecision) return attackDecision;

    // 4. Mover em direção ao inimigo
    const moveDecision = tryMoveTowardsEnemy(unit, context, BEHAVIOR_NAME);
    if (moveDecision) return moveDecision;

    // 5. Usar corrida se ainda tem ações e está longe do alvo
    const dashDecision = tryDash(unit, context, BEHAVIOR_NAME);
    if (dashDecision) return dashDecision;

    // 6. Sem ações possíveis
    return passDecision(unit, BEHAVIOR_NAME);
  } catch (error) {
    console.error(`[AI ${BEHAVIOR_NAME}] Erro no comportamento: ${error}`);
    return fallbackDecision(unit, BEHAVIOR_NAME);
  }
}
