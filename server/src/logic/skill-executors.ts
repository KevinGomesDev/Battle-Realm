// server/src/logic/skill-executors.ts
// Executores de skills ativas - Funções que implementam a mecânica de cada skill
// FONTE DE VERDADE para execução de habilidades ativas

import type {
  SkillExecutionResult,
  SkillDefinition,
} from "../../../shared/types/skills.types";
import {
  getManhattanDistance,
  isAdjacentOmnidirectional,
} from "../../../shared/types/skills.types";
import { findSkillByCode } from "../../../shared/data/skills.data";
import type { BattleUnit } from "../../../shared/types/battle.types";
import { processSummonerDeath } from "./summon-logic";

// =============================================================================
// TIPOS LOCAIS
// =============================================================================

export type SkillExecutorFn = (
  caster: BattleUnit,
  target: BattleUnit | null,
  allUnits: BattleUnit[],
  skill: SkillDefinition
) => SkillExecutionResult;

// =============================================================================
// REGISTRO DE EXECUTORES
// =============================================================================

/**
 * Mapa de functionName -> função executora
 * Adicione novos executores aqui
 */
export const SKILL_EXECUTORS: Record<string, SkillExecutorFn> = {
  // Guerreiro
  executeSecondWind,
  executeActionSurge,

  // Bárbaro
  executeTotalDestruction,

  // Clérigo
  executeHeal,
  executeBless,
  executeDivineFavor,
  executeCureWounds,
  executeTurnUndead,
  executeCelestialExpulsion,

  // Mago
  executeMagicWeapon,
  executeArcaneShield,

  // Ranger
  executeHuntersMark,
  executeVolley,

  // Invocador
  executeEidolonResistance,
};

// =============================================================================
// FUNÇÃO PRINCIPAL DE EXECUÇÃO
// =============================================================================

/**
 * Multiplica\u00e7\u00e3o de cooldown em Arena
 * Skills na Arena t\u00eam cooldown dobrado
 */
export const ARENA_COOLDOWN_MULTIPLIER = 2;

/**
 * Executa uma skill pelo seu functionName
 * Gerencia consumo de ação e cooldown automaticamente
 * @param isArena - Se true, cooldowns são dobrados
 */
export function executeSkill(
  caster: BattleUnit,
  skillCode: string,
  target: BattleUnit | null,
  allUnits: BattleUnit[],
  isArena: boolean = false
): SkillExecutionResult {
  const skill = findSkillByCode(skillCode);
  if (!skill) {
    return { success: false, error: "Skill não encontrada" };
  }

  if (!skill.functionName) {
    return { success: false, error: "Skill não possui executor definido" };
  }

  const executor = SKILL_EXECUTORS[skill.functionName];
  if (!executor) {
    return {
      success: false,
      error: `Executor '${skill.functionName}' não implementado`,
    };
  }

  // Verificar cooldown
  if (
    caster.unitCooldowns?.[skillCode] &&
    caster.unitCooldowns[skillCode] > 0
  ) {
    return {
      success: false,
      error: `Skill em cooldown (${caster.unitCooldowns[skillCode]} rodadas)`,
    };
  }

  // Executar a skill
  const result = executor(caster, target, allUnits, skill);

  // Se sucesso, aplicar consumo de ação e cooldown
  if (result.success) {
    // Consumir ação (a menos que consumesAction === false)
    if (skill.consumesAction !== false) {
      caster.actionsLeft = Math.max(0, caster.actionsLeft - 1);
    }
    result.casterActionsLeft = caster.actionsLeft;

    // Aplicar cooldown (dobrado em Arena)
    if (skill.cooldown && skill.cooldown > 0) {
      if (!caster.unitCooldowns) {
        caster.unitCooldowns = {};
      }
      const cooldownValue = isArena
        ? skill.cooldown * ARENA_COOLDOWN_MULTIPLIER
        : skill.cooldown;
      caster.unitCooldowns[skillCode] = cooldownValue;
    }

    result.skillCode = skillCode;
  }

  return result;
}

/**
 * Reduz todos os cooldowns de uma unidade em 1 (chamado no início de cada rodada)
 */
export function tickUnitCooldowns(unit: BattleUnit): void {
  if (!unit.unitCooldowns) return;

  for (const code of Object.keys(unit.unitCooldowns)) {
    if (unit.unitCooldowns[code] > 0) {
      unit.unitCooldowns[code]--;
    }
  }
}

/**
 * Verifica se uma skill/spell está em cooldown
 */
export function isOnCooldown(unit: BattleUnit, code: string): boolean {
  return (unit.unitCooldowns?.[code] ?? 0) > 0;
}

/**
 * Obtém o cooldown restante de uma skill/spell
 */
export function getCooldown(unit: BattleUnit, code: string): number {
  return unit.unitCooldowns?.[code] ?? 0;
}

// =============================================================================
// EXECUTORES - GUERREIRO
// =============================================================================

/**
 * WARRIOR_SECOND_WIND: Recupera HP igual à Vitalidade
 * Cooldown: 1 vez por batalha (tratado via metadata ou condição especial)
 */
function executeSecondWind(
  caster: BattleUnit,
  _target: BattleUnit | null,
  _allUnits: BattleUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  const healAmount = caster.vitality;
  const maxHp = caster.vitality * 2;

  const oldHp = caster.currentHp;
  caster.currentHp = Math.min(caster.currentHp + healAmount, maxHp);
  const actualHeal = caster.currentHp - oldHp;

  return {
    success: true,
    healAmount: actualHeal,
  };
}

/**
 * WARRIOR_ACTION_SURGE: Ganha uma ação extra (NÃO consome ação)
 */
function executeActionSurge(
  caster: BattleUnit,
  _target: BattleUnit | null,
  _allUnits: BattleUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  // Ganha uma ação extra (consumesAction=false na definição)
  caster.actionsLeft += 1;

  return {
    success: true,
    actionsGained: 1,
  };
}

// =============================================================================
// EXECUTORES - BÁRBARO
// =============================================================================

/**
 * BARBARIAN_TOTAL_DESTRUCTION: Dano igual ao Combat em alvo adjacente, recebe o mesmo dano
 */
function executeTotalDestruction(
  caster: BattleUnit,
  target: BattleUnit | null,
  allUnits: BattleUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  if (!target) {
    return { success: false, error: "Requer um alvo" };
  }

  const damage = caster.combat;

  // Aplicar dano no alvo
  target.currentHp = Math.max(0, target.currentHp - damage);
  const targetDefeated = target.currentHp <= 0;
  if (targetDefeated) {
    target.isAlive = false;
    // Matar invocações do alvo
    processSummonerDeath(target, allUnits, "arena");
  }

  // Aplicar mesmo dano no caster
  caster.currentHp = Math.max(0, caster.currentHp - damage);
  if (caster.currentHp <= 0) {
    caster.isAlive = false;
    // Matar invocações do caster
    processSummonerDeath(caster, allUnits, "arena");
  }

  return {
    success: true,
    damageDealt: damage,
    targetHpAfter: target.currentHp,
    targetDefeated,
  };
}

// =============================================================================
// EXECUTORES - CLÉRIGO
// =============================================================================

/**
 * CLERIC_HEAL: Cura aliado adjacente (Focus de HP)
 */
function executeHeal(
  caster: BattleUnit,
  target: BattleUnit | null,
  _allUnits: BattleUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  const healTarget = target || caster;

  if (healTarget.ownerId !== caster.ownerId) {
    return { success: false, error: "Só pode curar aliados" };
  }

  const healAmount = caster.focus;
  const maxHp = healTarget.vitality * 2;

  const oldHp = healTarget.currentHp;
  healTarget.currentHp = Math.min(healTarget.currentHp + healAmount, maxHp);
  const actualHeal = healTarget.currentHp - oldHp;

  return {
    success: true,
    healAmount: actualHeal,
    targetHpAfter: healTarget.currentHp,
  };
}

/**
 * CLERIC_BLESS: Aliados em área ganham BLESSED
 */
function executeBless(
  caster: BattleUnit,
  _target: BattleUnit | null,
  allUnits: BattleUnit[],
  skill: SkillDefinition
): SkillExecutionResult {
  const radius = skill.rangeValue ?? 2;
  let unitsBlessed = 0;

  for (const unit of allUnits) {
    if (unit.ownerId !== caster.ownerId) continue;
    if (!unit.isAlive) continue;

    const distance = getManhattanDistance(
      caster.posX,
      caster.posY,
      unit.posX,
      unit.posY
    );
    if (distance > radius) continue;

    if (!unit.conditions.includes("BLESSED")) {
      unit.conditions.push("BLESSED");
      unitsBlessed++;
    }
  }

  return {
    success: true,
    conditionApplied: "BLESSED",
    damageDealt: unitsBlessed,
  };
}

/**
 * CLERIC_DIVINE_FAVOR: Próximo ataque tem vantagem
 */
function executeDivineFavor(
  caster: BattleUnit,
  target: BattleUnit | null,
  _allUnits: BattleUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  const effectTarget = target || caster;

  if (!effectTarget.conditions.includes("HELP_NEXT")) {
    effectTarget.conditions.push("HELP_NEXT");
  }

  return {
    success: true,
    conditionApplied: "HELP_NEXT",
  };
}

/**
 * CLERIC_CURE_WOUNDS: Cura aliado adjacente (Focus de HP)
 */
function executeCureWounds(
  caster: BattleUnit,
  target: BattleUnit | null,
  _allUnits: BattleUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  const healTarget = target || caster;

  if (healTarget.ownerId !== caster.ownerId) {
    return { success: false, error: "Só pode curar aliados" };
  }

  const healAmount = caster.focus;
  const maxHp = healTarget.vitality * 2;

  const oldHp = healTarget.currentHp;
  healTarget.currentHp = Math.min(healTarget.currentHp + healAmount, maxHp);
  const actualHeal = healTarget.currentHp - oldHp;

  return {
    success: true,
    healAmount: actualHeal,
    targetHpAfter: healTarget.currentHp,
  };
}

/**
 * CLERIC_TURN_UNDEAD: Aplica FRIGHTENED em inimigos adjacentes
 */
function executeTurnUndead(
  caster: BattleUnit,
  _target: BattleUnit | null,
  allUnits: BattleUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  const affectedUnits: BattleUnit[] = [];

  for (const unit of allUnits) {
    if (unit.ownerId === caster.ownerId) continue;
    if (!unit.isAlive) continue;
    if (
      !isAdjacentOmnidirectional(caster.posX, caster.posY, unit.posX, unit.posY)
    )
      continue;

    if (!unit.conditions.includes("FRIGHTENED")) {
      unit.conditions.push("FRIGHTENED");
      affectedUnits.push(unit);
    }
  }

  return {
    success: true,
    conditionApplied: "FRIGHTENED",
    damageDealt: affectedUnits.length,
  };
}

/**
 * CLERIC_CELESTIAL_EXPULSION: Remove condições negativas do alvo
 */
function executeCelestialExpulsion(
  _caster: BattleUnit,
  target: BattleUnit | null,
  _allUnits: BattleUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  if (!target) {
    return { success: false, error: "Requer um alvo" };
  }

  // Lista de condições negativas que podem ser removidas
  const negativeConditions = [
    "STUNNED",
    "FROZEN",
    "BURNING",
    "SLOWED",
    "FRIGHTENED",
    "POISONED",
    "BLEEDING",
    "GRAPPLED",
    "PRONE",
    "DISARMED",
    "HUNTERS_MARK",
  ];

  const removedConditions: string[] = [];

  for (const condition of negativeConditions) {
    if (target.conditions.includes(condition)) {
      target.conditions = target.conditions.filter((c) => c !== condition);
      removedConditions.push(condition);
    }
  }

  return {
    success: true,
    conditionRemoved: removedConditions.join(", ") || "nenhuma",
  };
}

// =============================================================================
// EXECUTORES - MAGO
// =============================================================================

/**
 * MAGIC_WEAPON: Imbuí a arma de uma Unidade adjacente com Magia
 * Até o fim do Combate, os Ataques dessa Unidade causam dano Mágico ao invés de Físico.
 */
function executeMagicWeapon(
  caster: BattleUnit,
  target: BattleUnit | null,
  _allUnits: BattleUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  if (!target) {
    return { success: false, error: "Requer um aliado adjacente" };
  }

  // Verificar se é adjacente
  if (
    !isAdjacentOmnidirectional(
      caster.posX,
      caster.posY,
      target.posX,
      target.posY
    )
  ) {
    return { success: false, error: "Alvo deve estar adjacente" };
  }

  // Verificar se é aliado (mesmo dono)
  if (target.ownerId !== caster.ownerId) {
    return { success: false, error: "Só pode ser usado em aliados" };
  }

  // Aplicar condição MAGIC_WEAPON ao alvo
  if (!target.conditions.includes("MAGIC_WEAPON")) {
    target.conditions.push("MAGIC_WEAPON");
  }

  return {
    success: true,
    conditionApplied: "MAGIC_WEAPON",
  };
}

/**
 * ARCANE_SHIELD: Recebe Redução de Dano igual à metade do Foco até o próximo turno
 * Não gasta ação!
 */
function executeArcaneShield(
  caster: BattleUnit,
  _target: BattleUnit | null,
  _allUnits: BattleUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  // Calcular redução de dano = Focus / 2 (arredondado para baixo)
  const damageReduction = Math.floor(caster.focus / 2);

  // Aplicar condição ARCANE_SHIELD
  if (!caster.conditions.includes("ARCANE_SHIELD")) {
    caster.conditions.push("ARCANE_SHIELD");
  }

  // Armazenar o valor da redução no damageReduction da unidade
  // Nota: A condição ARCANE_SHIELD será processada no sistema de dano
  caster.damageReduction = (caster.damageReduction || 0) + damageReduction;

  return {
    success: true,
    conditionApplied: "ARCANE_SHIELD",
    healAmount: damageReduction, // Usar healAmount para indicar o valor da redução
  };
}

// =============================================================================
// EXECUTORES - RANGER
// =============================================================================

/**
 * RANGER_HUNTERS_MARK: Marca um inimigo (+2 dano em ataques contra ele)
 */
function executeHuntersMark(
  _caster: BattleUnit,
  target: BattleUnit | null,
  _allUnits: BattleUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  if (!target) {
    return { success: false, error: "Requer um alvo" };
  }

  if (!target.conditions.includes("HUNTERS_MARK")) {
    target.conditions.push("HUNTERS_MARK");
  }

  return {
    success: true,
    conditionApplied: "HUNTERS_MARK",
  };
}

/**
 * RANGER_VOLLEY: Ataca todos os inimigos em área com metade do dano
 */
function executeVolley(
  caster: BattleUnit,
  target: BattleUnit | null,
  allUnits: BattleUnit[],
  skill: SkillDefinition
): SkillExecutionResult {
  if (!target) {
    return { success: false, error: "Requer um ponto alvo" };
  }

  const baseDamage = Math.floor(caster.combat / 2);
  const radius = skill.rangeValue ?? 2;
  let totalDamage = 0;
  let unitsHit = 0;

  for (const unit of allUnits) {
    if (unit.ownerId === caster.ownerId) continue;
    if (!unit.isAlive) continue;

    const distance = getManhattanDistance(
      target.posX,
      target.posY,
      unit.posX,
      unit.posY
    );
    if (distance > radius) continue;

    // Dano físico
    let remainingDamage = baseDamage;

    if (unit.physicalProtection > 0) {
      const absorbed = Math.min(unit.physicalProtection, remainingDamage);
      unit.physicalProtection -= absorbed;
      remainingDamage -= absorbed;
    }

    if (remainingDamage > 0) {
      unit.currentHp = Math.max(0, unit.currentHp - remainingDamage);
      totalDamage += remainingDamage;
    }

    if (unit.currentHp <= 0) {
      unit.isAlive = false;
      // Matar invocações da unidade
      processSummonerDeath(unit, allUnits, "arena");
    }

    unitsHit++;
  }

  return {
    success: true,
    damageDealt: totalDamage,
  };
}

// =============================================================================
// EXECUTORES - INVOCADOR
// =============================================================================

/**
 * SUMMONER_EIDOLON_RESISTANCE: Drena proteção do Eidolon para si
 * - O Eidolon deve ter pelo menos 1 de proteção
 * - Recupera [FOCO] de proteção do Eidolon para o caster
 */
function executeEidolonResistance(
  caster: BattleUnit,
  target: BattleUnit | null,
  allUnits: BattleUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  // Se não passou target, tenta encontrar o Eidolon adjacente
  let eidolon = target;

  if (!eidolon) {
    // Procura o Eidolon do caster que esteja adjacente
    eidolon =
      allUnits.find(
        (u) =>
          u.ownerId === caster.ownerId &&
          u.category === "SUMMON" &&
          u.conditions.includes("EIDOLON_GROWTH") &&
          u.isAlive &&
          isAdjacentOmnidirectional(caster.posX, caster.posY, u.posX, u.posY)
      ) || null;
  }

  if (!eidolon) {
    return { success: false, error: "Nenhum Eidolon adjacente encontrado" };
  }

  // Verificar se é um Eidolon válido
  if (
    eidolon.category !== "SUMMON" ||
    !eidolon.conditions.includes("EIDOLON_GROWTH")
  ) {
    return { success: false, error: "Alvo não é seu Eidolon" };
  }

  // Verificar se está adjacente
  if (
    !isAdjacentOmnidirectional(
      caster.posX,
      caster.posY,
      eidolon.posX,
      eidolon.posY
    )
  ) {
    return { success: false, error: "Eidolon não está adjacente" };
  }

  // Verificar se Eidolon tem proteção física
  const eidolonProtection = eidolon.physicalProtection;
  if (eidolonProtection < 1) {
    return {
      success: false,
      error: "Eidolon não tem proteção suficiente",
    };
  }

  // Quantidade a drenar = FOCO do caster (máximo o que o Eidolon tem)
  const drainAmount = Math.min(caster.focus, eidolonProtection);

  // Remover proteção do Eidolon
  eidolon.physicalProtection -= drainAmount;

  // Adicionar proteção ao caster (respeitar máximo)
  const casterMaxProtection = caster.maxPhysicalProtection;
  const casterCurrentProtection = caster.physicalProtection;
  const actualGain = Math.min(
    drainAmount,
    casterMaxProtection - casterCurrentProtection
  );
  caster.physicalProtection += actualGain;

  return {
    success: true,
    healAmount: actualGain, // Usando healAmount para representar proteção ganhaconst
    damageDealt: drainAmount, // Usando damageDealt para representar proteção drenada
  };
}

// =============================================================================
// HELPERS PARA INVOCAÇÃO DE EIDOLON
// =============================================================================

/**
 * Verifica se uma unidade é o Eidolon de um invocador
 */
export function isEidolonOf(unit: BattleUnit, summoner: BattleUnit): boolean {
  return (
    unit.ownerId === summoner.ownerId &&
    unit.category === "SUMMON" &&
    unit.conditions.includes("EIDOLON_GROWTH")
  );
}

/**
 * Encontra o Eidolon de um invocador
 */
export function findEidolon(
  summoner: BattleUnit,
  allUnits: BattleUnit[]
): BattleUnit | undefined {
  return allUnits.find((u) => isEidolonOf(u, summoner) && u.isAlive);
}

/**
 * Verifica se um invocador está adjacente ao seu Eidolon
 */
export function isAdjacentToEidolon(
  summoner: BattleUnit,
  allUnits: BattleUnit[]
): boolean {
  const eidolon = findEidolon(summoner, allUnits);
  if (!eidolon) return false;

  return isAdjacentOmnidirectional(
    summoner.posX,
    summoner.posY,
    eidolon.posX,
    eidolon.posY
  );
}

/**
 * Processa o crescimento do Eidolon quando ele mata uma unidade
 * Retorna os novos stats bonus (para persistir na partida)
 */
export function processEidolonKill(
  eidolon: BattleUnit,
  currentBonus: number = 0
): { newBonus: number; statsGained: number } {
  const statsGained = 1; // +1 em cada stat por kill
  const newBonus = currentBonus + statsGained;

  // Aplicar bônus imediatamente aos stats do Eidolon
  eidolon.combat += statsGained;
  eidolon.speed += statsGained;
  eidolon.focus += statsGained;
  eidolon.armor += statsGained;
  eidolon.vitality += statsGained;

  // Aumentar HP máximo e atual proporcionalmente
  const hpGain = statsGained * 2; // vitality * 2 = HP
  eidolon.currentHp += hpGain;
  // maxHp precisa ser recalculado baseado no novo vitality

  // Recalcular proteções máximas
  eidolon.maxPhysicalProtection = eidolon.armor * 2;
  eidolon.maxMagicalProtection = eidolon.focus * 2;

  return { newBonus, statsGained };
}

/**
 * Reseta o Eidolon para stats base quando morre
 * Retorna os stats base para uso na próxima batalha
 */
export function resetEidolonOnDeath(): {
  combat: number;
  speed: number;
  focus: number;
  armor: number;
  vitality: number;
} {
  // Stats base do Eidolon (de summons.data.ts)
  return {
    combat: 3,
    speed: 3,
    focus: 3,
    armor: 3,
    vitality: 3,
  };
}
