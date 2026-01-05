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
  isWithinRange,
} from "../../../shared/utils/spell-validation";
import { findSkillByCode } from "../../../shared/data/skills.data";
import type {
  BattleObstacle,
  BattleUnit,
} from "../../../shared/types/battle.types";
import {
  processSummonerDeath,
  shouldTransferDamageToEidolon,
  transferDamageToEidolon,
  processUnitDeathForEidolon,
  processEidolonDeath,
} from "./summon-logic";
import {
  scanConditionsForAction,
  applyConditionScanResult,
  getExtraAttacksFromConditions,
} from "./conditions";
import { calculateBaseMovement } from "./movement-actions";
import { applyDualProtectionDamage } from "../utils/battle.utils";
import {
  OBSTACLE_CONFIG,
  DEFENSE_CONFIG,
} from "../../../shared/config/global.config";

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
  // Ações Comuns
  executeAttackSkill,
  executeDash,
  executeDodge,

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

// =============================================================================
// EXECUTORES - AÇÕES COMUNS
// =============================================================================

/**
 * Resultado de ação de ataque
 */
export interface AttackActionResult {
  success: boolean;
  error?: string;
  missed?: boolean;
  dodged?: boolean;
  targetType?: "unit" | "corpse" | "obstacle";
  rawDamage?: number;
  damageReduction?: number;
  finalDamage?: number;
  damageType?: string;
  targetHpAfter?: number;
  targetPhysicalProtection?: number;
  targetMagicalProtection?: number;
  targetDefeated?: boolean;
  obstacleDestroyed?: boolean;
  obstacleId?: string;
  attacksLeftThisTurn?: number;
  dodgeChance?: number;
  dodgeRoll?: number;
  damageTransferredToEidolon?: boolean;
  eidolonDefeated?: boolean;
  killedSummonIds?: string[];
}

/**
 * ATTACK: Ataque corpo-a-corpo unificado
 * Pode atacar: unidade viva, cadáver (unidade morta) ou obstáculo
 * NOVO SISTEMA SEM DADOS:
 * - Dano = Combat + bônus de condições
 * - Esquiva = 1D100 vs Speed × dodgeMultiplier (máximo maxDodgeChance)
 */
export function executeAttack(
  attacker: BattleUnit,
  target: BattleUnit | null,
  allUnits: BattleUnit[],
  _skill: SkillDefinition,
  damageType: string = "FISICO",
  obstacle?: BattleObstacle
): AttackActionResult {
  if (!attacker.features.includes("ATTACK")) {
    return { success: false, error: "Unit cannot attack" };
  }
  if (!attacker.isAlive) {
    return { success: false, error: "Dead unit cannot attack" };
  }

  // === MAGIC_WEAPON: Converter dano físico em mágico ===
  let effectiveDamageType = damageType;
  if (
    attacker.conditions.includes("MAGIC_WEAPON") &&
    effectiveDamageType === "FISICO"
  ) {
    effectiveDamageType = "MAGICO";
  }

  // === SISTEMA DE MÚLTIPLOS ATAQUES (extraAttacks) ===
  const hasAttacksRemaining = attacker.attacksLeftThisTurn > 0;

  if (!hasAttacksRemaining) {
    if (attacker.actionsLeft <= 0) {
      return { success: false, error: "No actions left this turn" };
    }
  }

  // Varredura de condições do atacante
  const attackerScan = scanConditionsForAction(attacker.conditions, "ATTACK");
  if (!attackerScan.canPerform) {
    return { success: false, error: attackerScan.blockReason };
  }

  // Determinar tipo de alvo e posição
  let targetX: number;
  let targetY: number;
  let targetType: "unit" | "corpse" | "obstacle";

  if (obstacle) {
    targetX = obstacle.posX;
    targetY = obstacle.posY;
    targetType = "obstacle";
  } else if (target) {
    targetX = target.posX;
    targetY = target.posY;
    targetType = target.isAlive ? "unit" : "corpse";
  } else {
    return { success: false, error: "No target specified" };
  }

  // Calcula alcance de ataque dinâmico (base 1 + modificadores de condições)
  const baseAttackRange = 1;
  const attackRangeMod = attackerScan.modifiers.basicAttackRangeMod || 0;
  const effectiveAttackRange = baseAttackRange + attackRangeMod;

  // Verificar se o alvo está dentro do alcance de ataque (8 direções)
  if (
    !isWithinRange(
      attacker.posX,
      attacker.posY,
      targetX,
      targetY,
      effectiveAttackRange
    )
  ) {
    return {
      success: false,
      error:
        effectiveAttackRange === 1
          ? "Target must be adjacent"
          : `Target must be within ${effectiveAttackRange} tiles`,
    };
  }

  // === CONSUMO DE AÇÃO E ATAQUES EXTRAS ===
  if (!hasAttacksRemaining) {
    attacker.actionsLeft = Math.max(0, attacker.actionsLeft - 1);
    const hasProtection = attacker.physicalProtection > 0;
    const extraAttacks = getExtraAttacksFromConditions(
      attacker.conditions,
      hasProtection
    );
    attacker.attacksLeftThisTurn = extraAttacks;
  } else {
    attacker.attacksLeftThisTurn = Math.max(
      0,
      attacker.attacksLeftThisTurn - 1
    );
  }

  // === CÁLCULO DE DANO (SEM DADOS) ===
  // Dano = Combat + bônus de condições
  const bonusDamage = attackerScan.modifiers.bonusDamage || 0;
  const rawDamage = Math.max(1, attacker.combat) + bonusDamage;

  // === LÓGICA ESPECÍFICA POR TIPO DE ALVO ===

  if (targetType === "obstacle" && obstacle) {
    const obstacleHp = obstacle.hp ?? OBSTACLE_CONFIG.defaultHp;
    const newHp = Math.max(0, obstacleHp - rawDamage);
    const destroyed = newHp <= 0;

    obstacle.hp = newHp;
    obstacle.destroyed = destroyed;

    attacker.conditions = applyConditionScanResult(
      attacker.conditions,
      attackerScan
    );

    return {
      success: true,
      targetType: "obstacle",
      rawDamage,
      damageReduction: 0,
      finalDamage: rawDamage,
      damageType: effectiveDamageType,
      targetHpAfter: newHp,
      obstacleDestroyed: destroyed,
      obstacleId: obstacle.id,
      targetDefeated: destroyed,
      attacksLeftThisTurn: attacker.attacksLeftThisTurn,
    };
  }

  if (targetType === "corpse" && target) {
    const corpseHp = OBSTACLE_CONFIG.corpseHp;
    const destroyed = rawDamage >= corpseHp;

    if (destroyed && !target.conditions.includes("CORPSE_REMOVED")) {
      target.conditions.push("CORPSE_REMOVED");
    }

    attacker.conditions = applyConditionScanResult(
      attacker.conditions,
      attackerScan
    );

    return {
      success: true,
      targetType: "corpse",
      rawDamage,
      damageReduction: 0,
      finalDamage: rawDamage,
      damageType: effectiveDamageType,
      targetHpAfter: 0,
      targetDefeated: destroyed,
      attacksLeftThisTurn: attacker.attacksLeftThisTurn,
    };
  }

  // === ATACANDO UNIDADE VIVA ===
  if (!target || !target.isAlive) {
    return { success: false, error: "Target unit is not alive" };
  }

  // Varredura de condições do alvo
  const targetScan = scanConditionsForAction(target.conditions, "ATTACK");

  // === SISTEMA DE ESQUIVA (1D100) ===
  // Chance = Speed × dodgeMultiplier + bônus de condições (cap: maxDodgeChance)
  const baseDodgeChance =
    target.speed * DEFENSE_CONFIG.dodgeMultiplier +
    (targetScan.modifiers.dodgeChance || 0);
  const dodgeChance = Math.min(baseDodgeChance, DEFENSE_CONFIG.maxDodgeChance);
  const dodgeRoll = Math.floor(Math.random() * 100) + 1; // 1-100

  if (dodgeRoll <= dodgeChance) {
    // Alvo esquivou!
    attacker.conditions = applyConditionScanResult(
      attacker.conditions,
      attackerScan
    );
    return {
      success: true,
      missed: true,
      dodged: true,
      targetType: "unit",
      rawDamage: 0,
      damageReduction: 0,
      finalDamage: 0,
      damageType: effectiveDamageType,
      targetHpAfter: target.currentHp,
      targetPhysicalProtection: target.physicalProtection,
      targetMagicalProtection: target.magicalProtection,
      targetDefeated: false,
      attacksLeftThisTurn: attacker.attacksLeftThisTurn,
      dodgeChance,
      dodgeRoll,
    };
  }

  // === APLICAR DANO ===
  // Redução de dano apenas por condições (não mais por dados)
  const damageReduction = targetScan.modifiers.damageReduction || 0;
  const damageToApply = Math.max(0, rawDamage - damageReduction);

  console.log("[COMBAT] Aplicando dano (novo sistema):", {
    targetName: target.name,
    targetRace: target.race,
    targetConditions: target.conditions,
    rawDamage,
    damageReduction,
    damageToApply,
    damageType: effectiveDamageType,
    dodgeChance,
    dodgeRoll,
  });

  // === VERIFICAR TRANSFERÊNCIA DE DANO PARA EIDOLON ===
  // Se o alvo tem EIDOLON_PROTECTION e está adjacente ao Eidolon
  const eidolonToTransfer = shouldTransferDamageToEidolon(target, allUnits);

  let eidolonDefeated = false;
  let damageTransferredToEidolon = false;

  if (eidolonToTransfer) {
    // Dano é transferido como DANO VERDADEIRO para o Eidolon
    const transferResult = transferDamageToEidolon(
      eidolonToTransfer,
      damageToApply
    );
    eidolonDefeated = transferResult.eidolonDefeated;
    damageTransferredToEidolon = true;

    console.log(
      `[COMBAT] 🛡️ Dano transferido para Eidolon: ${damageToApply} (Verdadeiro)`
    );

    // Se Eidolon morreu, processar reset de bônus
    if (eidolonDefeated) {
      processEidolonDeath(eidolonToTransfer, "arena");
    }

    // Aplicar expiração de condições (mesmo sem dano no alvo)
    attacker.conditions = applyConditionScanResult(
      attacker.conditions,
      attackerScan
    );
    target.conditions = applyConditionScanResult(target.conditions, targetScan);

    return {
      success: true,
      targetType: "unit",
      rawDamage,
      damageReduction,
      finalDamage: damageToApply,
      damageType: effectiveDamageType,
      targetHpAfter: target.currentHp, // Alvo não recebeu dano
      targetPhysicalProtection: target.physicalProtection,
      targetMagicalProtection: target.magicalProtection,
      targetDefeated: false,
      attacksLeftThisTurn: attacker.attacksLeftThisTurn,
      dodgeChance,
      dodgeRoll,
      damageTransferredToEidolon: true,
      eidolonDefeated,
    };
  }

  // Aplicar dano na proteção apropriada (fluxo normal)
  const protectionResult = applyDualProtectionDamage(
    target.physicalProtection,
    target.magicalProtection,
    target.currentHp,
    damageToApply,
    effectiveDamageType
  );

  target.physicalProtection = protectionResult.newPhysicalProtection;
  target.magicalProtection = protectionResult.newMagicalProtection;
  target.currentHp = protectionResult.newHp;

  // Aplicar expiração de condições
  attacker.conditions = applyConditionScanResult(
    attacker.conditions,
    attackerScan
  );
  target.conditions = applyConditionScanResult(target.conditions, targetScan);

  let targetDefeated = false;
  let killedSummons: BattleUnit[] = [];
  if (target.currentHp <= 0) {
    targetDefeated = true;
    target.isAlive = false;

    // Processar morte para crescimento do Eidolon (se atacante for Eidolon)
    processUnitDeathForEidolon(attacker, target, "arena");

    // Se o alvo era um Eidolon, processar reset
    if (target.conditions.includes("EIDOLON_GROWTH")) {
      processEidolonDeath(target, "arena");
    }

    // Matar todas as invocações do alvo (summons morrem com o invocador)
    killedSummons = processSummonerDeath(target, allUnits, "arena");
  }

  return {
    success: true,
    targetType: "unit",
    rawDamage,
    damageReduction,
    finalDamage: damageToApply,
    damageType: effectiveDamageType,
    targetHpAfter: target.currentHp,
    targetPhysicalProtection: target.physicalProtection,
    targetMagicalProtection: target.magicalProtection,
    targetDefeated,
    attacksLeftThisTurn: attacker.attacksLeftThisTurn,
    dodgeChance,
    dodgeRoll,
    killedSummonIds: killedSummons.map((s) => s.id),
  };
}

/**
 * Wrapper para executeAttack que se encaixa na assinatura de SkillExecutorFn
 * Usado pelo sistema de skills para ação comum de ataque
 */
function executeAttackSkill(
  caster: BattleUnit,
  target: BattleUnit | null,
  allUnits: BattleUnit[],
  skill: SkillDefinition
): SkillExecutionResult {
  // Delega para a função completa com parâmetros padrão
  return executeAttack(caster, target, allUnits, skill, "FISICO", undefined);
}

/**
 * DASH (Disparada): Gasta uma ação para dobrar o movimento
 */
function executeDash(
  caster: BattleUnit,
  _target: BattleUnit | null,
  _allUnits: BattleUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  const scan = scanConditionsForAction(caster.conditions, "DASH");
  if (!scan.canPerform) {
    return { success: false, error: scan.blockReason };
  }

  // Aplicar condições
  caster.conditions = applyConditionScanResult(caster.conditions, scan);

  // Adicionar movimento extra (igual ao movimento base)
  const extraMovement = calculateBaseMovement(caster.speed);
  caster.movesLeft = caster.movesLeft + extraMovement;

  return {
    success: true,
    movementGained: extraMovement,
  };
}

/**
 * DODGE (Esquiva): Aumenta chance de esquiva até próximo turno
 */
function executeDodge(
  caster: BattleUnit,
  _target: BattleUnit | null,
  _allUnits: BattleUnit[],
  _skill: SkillDefinition
): SkillExecutionResult {
  const scan = scanConditionsForAction(caster.conditions, "DODGE");
  if (!scan.canPerform) {
    return { success: false, error: scan.blockReason };
  }

  // Aplicar condições
  caster.conditions = applyConditionScanResult(caster.conditions, scan);

  // Aplicar condição DODGING
  if (!caster.conditions.includes("DODGING")) {
    caster.conditions.push("DODGING");
  }

  return {
    success: true,
    conditionApplied: "DODGING",
  };
}
