// server/src/ai/core/spell-evaluator.ts
// Avalia��o e sele��o de spells para a IA

import { BattleUnit } from "@boundless/shared/types/battle.types";
import type { AbilityDefinition as SpellDefinition } from "@boundless/shared/types/ability.types";
import { getAbilityByCode as getSpellByCode } from "@boundless/shared/data/abilities.data";
import {
  validateAbilityUse as validateSpellUse,
  getValidAbilityTargets as getValidSpellTargets,
} from "@boundless/shared/utils/ability-validation";
import { getChebyshevDistance } from "@boundless/shared/utils/distance.utils";
import type { AIProfile } from "../types/ai.types";
import { getEnemies, getAllies } from "./target-selection";

// =============================================================================
// TIPOS
// =============================================================================

interface SpellEvaluation {
  spell: SpellDefinition;
  score: number;
  validTargets: Array<BattleUnit | { x: number; y: number }>;
  bestTarget: BattleUnit | { x: number; y: number } | null;
  canUse: boolean;
  reason: string;
}

// =============================================================================
// OBTEN��O DE SPELLS
// =============================================================================

/**
 * Obtém as spells disponíveis para uma unidade
 */
export function getUnitSpells(unit: BattleUnit): SpellDefinition[] {
  if (!unit.spells || unit.spells.length === 0) {
    return [];
  }

  return unit.spells
    .map((spellCode) => {
      const result = getSpellByCode(spellCode);
      return result?.ability;
    })
    .filter((spell): spell is SpellDefinition => spell !== undefined);
}

// =============================================================================
// AVALIA��O DE SPELLS
// =============================================================================

/**
 * Avalia uma spell de dano em �rea
 */
function evaluateDamageSpell(
  caster: BattleUnit,
  spell: SpellDefinition,
  allUnits: BattleUnit[]
): {
  score: number;
  bestTarget: { x: number; y: number } | null;
  reason: string;
} {
  const enemies = getEnemies(caster, allUnits);

  if (enemies.length === 0) {
    return { score: 0, bestTarget: null, reason: "Sem inimigos" };
  }

  // Para spells de �rea (FIRE), encontrar posi��o que atinge mais inimigos
  if (spell.targetType === "POSITION") {
    let bestPos: { x: number; y: number } | null = null;
    let bestScore = 0;
    let bestHitCount = 0;

    // Avaliar posi��o de cada inimigo como centro
    for (const enemy of enemies) {
      const pos = { x: enemy.posX, y: enemy.posY };
      let hitCount = 0;
      let damageScore = 0;

      // Contar quantos inimigos seriam atingidos em �rea 3x3
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
          // Bonus por alvo com HP baixo
          damageScore += hpPercent <= 0.3 ? 30 : hpPercent <= 0.5 ? 20 : 10;
        }
      }

      // Verificar se n�o atinge aliados
      const allies = getAllies(caster, allUnits);
      let allyHit = false;
      for (const ally of allies) {
        const dist = getChebyshevDistance(pos.x, pos.y, ally.posX, ally.posY);
        if (dist <= 1 && ally.id !== caster.id) {
          allyHit = true;
          break;
        }
      }

      // Penalizar fortemente se atinge aliados
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
        reason: `${spell.name} atinge ${bestHitCount} inimigo(s)`,
      };
    }
  }

  // Para spells de alvo �nico com dano (UNIT ofensivo)
  if (spell.targetType === "UNIT" && spell.baseDamage !== undefined) {
    const targetsWithScores = enemies.map((enemy) => {
      const hpPercent = enemy.currentHp / enemy.maxHp;
      let score = 40;

      // Bonus por HP baixo
      if (hpPercent <= 0.3) score += 25;
      else if (hpPercent <= 0.5) score += 15;

      // Bonus se pode matar
      if (enemy.currentHp <= caster.focus * 2) {
        score += 20;
      }

      return { target: enemy, score };
    });

    targetsWithScores.sort((a, b) => b.score - a.score);
    const best = targetsWithScores[0];

    return {
      score: best.score,
      bestTarget: { x: best.target.posX, y: best.target.posY },
      reason: `${spell.name} em ${best.target.name}`,
    };
  }

  return { score: 0, bestTarget: null, reason: "Tipo de alvo n�o suportado" };
}

/**
 * Avalia uma spell de buff/suporte
 */
function evaluateSupportSpell(
  caster: BattleUnit,
  spell: SpellDefinition,
  allUnits: BattleUnit[]
): { score: number; bestTarget: BattleUnit | null; reason: string } {
  const allies = getAllies(caster, allUnits);

  if (spell.targetType === "SELF") {
    // Self-buff sempre � v�lido
    return {
      score: 35,
      bestTarget: caster,
      reason: `${spell.name} em si mesmo`,
    };
  }

  if (spell.targetType === "UNIT") {
    // Encontrar aliado que mais se beneficiaria
    const validAllies = allies.filter((a) => a.id !== caster.id);

    if (validAllies.length === 0) {
      return { score: 0, bestTarget: null, reason: "Sem aliados v�lidos" };
    }

    // Para EMPOWER, priorizar aliados com mais Combat (para maximizar dano)
    const targetsWithScores = validAllies.map((ally) => {
      let score = 30;
      score += ally.combat * 2; // Bonus por Combat alto
      score += ally.actionsLeft > 0 ? 10 : 0; // Bonus se ainda pode agir

      return { target: ally, score };
    });

    targetsWithScores.sort((a, b) => b.score - a.score);
    const best = targetsWithScores[0];

    return {
      score: best.score,
      bestTarget: best.target,
      reason: `${spell.name} em ${best.target.name}`,
    };
  }

  return { score: 0, bestTarget: null, reason: "Tipo de alvo n�o suportado" };
}

/**
 * Avalia uma spell de movimento (Teleport)
 */
function evaluateMovementSpell(
  caster: BattleUnit,
  spell: SpellDefinition,
  allUnits: BattleUnit[]
): {
  score: number;
  bestTarget: { x: number; y: number } | null;
  reason: string;
} {
  const enemies = getEnemies(caster, allUnits);

  if (enemies.length === 0) {
    return {
      score: 0,
      bestTarget: null,
      reason: "Sem inimigos para se aproximar",
    };
  }

  // Teleport � �til para:
  // 1. Se aproximar de inimigos quando longe
  // 2. Fugir quando HP baixo
  // 3. Flanquear

  const nearestEnemy = enemies.reduce((nearest, enemy) => {
    const dist = getChebyshevDistance(
      caster.posX,
      caster.posY,
      enemy.posX,
      enemy.posY
    );
    const nearestDist = getChebyshevDistance(
      caster.posX,
      caster.posY,
      nearest.posX,
      nearest.posY
    );
    return dist < nearestDist ? enemy : nearest;
  }, enemies[0]);

  const distToNearest = getChebyshevDistance(
    caster.posX,
    caster.posY,
    nearestEnemy.posX,
    nearestEnemy.posY
  );

  // Se j� est� adjacente, n�o precisa teleportar
  if (distToNearest <= 1) {
    return {
      score: 0,
      bestTarget: null,
      reason: "J� est� adjacente ao inimigo",
    };
  }

  // Se est� longe, teleportar para adjacente ao inimigo
  const targetPos = {
    x: nearestEnemy.posX + (caster.posX > nearestEnemy.posX ? 1 : -1),
    y: nearestEnemy.posY,
  };

  // Verificar se posi��o � v�lida (n�o ocupada)
  const isOccupied = allUnits.some(
    (u) => u.isAlive && u.posX === targetPos.x && u.posY === targetPos.y
  );

  if (isOccupied) {
    return {
      score: 0,
      bestTarget: null,
      reason: "Posi��o de teleporte ocupada",
    };
  }

  return {
    score: 40 + distToNearest * 5, // Maior score quanto mais longe
    bestTarget: targetPos,
    reason: `${spell.name} para ficar adjacente a ${nearestEnemy.name}`,
  };
}

/**
 * Avalia uma spell �nica
 */
function evaluateSpell(
  caster: BattleUnit,
  spell: SpellDefinition,
  allUnits: BattleUnit[],
  profile: AIProfile
): SpellEvaluation {
  // Validar se pode usar a spell
  const validation = validateSpellUse(caster, spell, null);
  if (!validation.valid) {
    return {
      spell,
      score: 0,
      validTargets: [],
      bestTarget: null,
      canUse: false,
      reason: validation.error || "N�o pode usar spell",
    };
  }

  // Avaliar baseado no effectType da spell
  let evalResult: { score: number; bestTarget: any; reason: string };

  // Usar effectType diretamente para decis�es de IA
  const effectType = spell.effectType;

  switch (effectType) {
    case "OFFENSIVE":
      evalResult = evaluateDamageSpell(caster, spell, allUnits);
      break;
    case "HEALING":
    case "BUFF":
      evalResult = evaluateSupportSpell(caster, spell, allUnits);
      break;
    case "DEBUFF":
      evalResult = evaluateDamageSpell(caster, spell, allUnits); // Debuffs geralmente miram inimigos
      break;
    case "UTILITY":
      evalResult = evaluateMovementSpell(caster, spell, allUnits);
      break;
    default:
      // Fallback para spells sem effectType (legacy)
      if (spell.baseDamage !== undefined) {
        evalResult = evaluateDamageSpell(caster, spell, allUnits);
      } else if (spell.conditionApplied) {
        evalResult = evaluateSupportSpell(caster, spell, allUnits);
      } else {
        evalResult = {
          score: 0,
          bestTarget: null,
          reason: "Spell n�o avaliada",
        };
      }
  }

  return {
    spell,
    score: evalResult.score,
    validTargets: evalResult.bestTarget ? [evalResult.bestTarget] : [],
    bestTarget: evalResult.bestTarget,
    canUse: evalResult.score > 0 && evalResult.bestTarget !== null,
    reason: evalResult.reason,
  };
}

/**
 * Seleciona a melhor spell para usar
 */
export function selectBestSpell(
  caster: BattleUnit,
  availableSpells: SpellDefinition[],
  allUnits: BattleUnit[],
  profile: AIProfile
): SpellEvaluation | null {
  if (availableSpells.length === 0) {
    return null;
  }

  const evaluations = availableSpells
    .map((spell) => evaluateSpell(caster, spell, allUnits, profile))
    .filter((e) => e.canUse && e.score > 0);

  if (evaluations.length === 0) {
    return null;
  }

  // Ordenar por score
  evaluations.sort((a, b) => b.score - a.score);

  return evaluations[0];
}
