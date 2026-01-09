// server/src/modules/abilities/executors/helpers.ts
// Funções auxiliares compartilhadas entre executores

import type {
  BattleUnit,
  BattleObstacle,
} from "@boundless/shared/types/battle.types";
import {
  resolveDynamicValue,
  type DynamicValue,
  type CoordinatePattern,
} from "@boundless/shared/types/ability.types";
import { isAdjacentOmnidirectional } from "@boundless/shared/utils/distance.utils";
import {
  getTargetsInArea,
  type ProjectileUnit,
  type TravelObstacle,
  type PatternCoordinate,
} from "@boundless/shared/utils/targeting.utils";

// =============================================================================
// SPELL HELPERS
// =============================================================================

/**
 * Resolve um valor dinâmico de spell com fallback
 */
export function resolveSpellValue(
  value: DynamicValue | undefined,
  caster: BattleUnit,
  fallback: number
): number {
  if (value === undefined) return fallback;
  return resolveDynamicValue(value, caster);
}

// =============================================================================
// TARGETING HELPERS (PADRONIZADO)
// =============================================================================

/**
 * Converte BattleUnit para ProjectileUnit
 */
function toProjectileUnit(unit: BattleUnit): ProjectileUnit {
  return {
    id: unit.id,
    posX: unit.posX,
    posY: unit.posY,
    isAlive: unit.isAlive,
    ownerId: unit.ownerId,
  };
}

/**
 * Converte BattleObstacle para TravelObstacle
 */
function toTravelObstacle(obstacle: BattleObstacle): TravelObstacle {
  return {
    posX: obstacle.posX,
    posY: obstacle.posY,
    destroyed: obstacle.destroyed,
  };
}

/**
 * Resultado padronizado para targeting de abilities
 */
export interface AbilityTargetingResult {
  /** Unidades afetadas pela ability */
  targets: BattleUnit[];
  /** Ponto de impacto (para viagem + explosão) */
  impactPoint: { x: number; y: number };
  /** Células afetadas pela área */
  affectedCells: PatternCoordinate[];
  /** Se o projétil foi interceptado */
  intercepted: boolean;
}

/**
 * Processa o targeting de uma ability usando o sistema padronizado
 * Suporta:
 * - Área simples (sem viagem)
 * - Viagem + explosão (projétil que viaja e explode)
 * - Projétil piercing (atravessa unidades)
 *
 * @param pattern O pattern de targeting da ability
 * @param caster A unidade que usa a ability
 * @param targetX Posição X do alvo
 * @param targetY Posição Y do alvo
 * @param allUnits Todas as unidades em jogo
 * @param obstacles Obstáculos no mapa
 * @param gridWidth Largura do grid
 * @param gridHeight Altura do grid
 * @param options Opções adicionais
 */
export function processAbilityTargeting(
  pattern: CoordinatePattern,
  caster: BattleUnit,
  targetX: number,
  targetY: number,
  allUnits: BattleUnit[],
  obstacles: BattleObstacle[],
  gridWidth: number,
  gridHeight: number,
  options: {
    /** Distância de viagem do projétil (0 = sem viagem) */
    travelDistance?: number;
    /** Se true, inclui apenas inimigos */
    enemiesOnly?: boolean;
    /** Se true, inclui apenas aliados */
    alliesOnly?: boolean;
    /** Se true, exclui o caster dos alvos */
    excludeCaster?: boolean;
  } = {}
): AbilityTargetingResult {
  const projectileUnits = allUnits.map(toProjectileUnit);
  const travelObstacles = obstacles.map(toTravelObstacle);

  // Usar travelDistance do pattern se não especificado nas options
  const travelDistance =
    options.travelDistance ??
    (pattern.travelDistance
      ? resolveSpellValue(pattern.travelDistance, caster, 0)
      : 0);

  // Criar filtro baseado nas opções
  const filterFn = (unit: ProjectileUnit): boolean => {
    if (options.excludeCaster && unit.id === caster.id) {
      return false;
    }
    if (options.enemiesOnly && unit.ownerId === caster.ownerId) {
      return false;
    }
    if (options.alliesOnly && unit.ownerId !== caster.ownerId) {
      return false;
    }
    return true;
  };

  const result = getTargetsInArea(
    pattern,
    caster.posX,
    caster.posY,
    targetX,
    targetY,
    projectileUnits,
    travelObstacles,
    gridWidth,
    gridHeight,
    travelDistance,
    caster.id,
    filterFn
  );

  // Converter de volta para BattleUnit
  const targetIds = new Set(result.targets.map((t) => t.id));
  const targets = allUnits.filter((u) => targetIds.has(u.id));

  return {
    targets,
    impactPoint: result.impactPoint,
    affectedCells: result.affectedCells,
    intercepted: result.intercepted,
  };
}

/**
 * Helper simplificado para abilities de área ofensivas
 * Retorna apenas os inimigos na área de efeito
 */
export function getEnemiesInArea(
  pattern: CoordinatePattern,
  caster: BattleUnit,
  targetX: number,
  targetY: number,
  allUnits: BattleUnit[],
  obstacles: BattleObstacle[],
  gridWidth: number,
  gridHeight: number,
  travelDistance?: number
): BattleUnit[] {
  return processAbilityTargeting(
    pattern,
    caster,
    targetX,
    targetY,
    allUnits,
    obstacles,
    gridWidth,
    gridHeight,
    {
      travelDistance,
      enemiesOnly: true,
      excludeCaster: true,
    }
  ).targets;
}

/**
 * Helper simplificado para abilities de área que afetam todos
 * Retorna todas as unidades na área (aliados + inimigos)
 */
export function getAllUnitsInArea(
  pattern: CoordinatePattern,
  caster: BattleUnit,
  targetX: number,
  targetY: number,
  allUnits: BattleUnit[],
  obstacles: BattleObstacle[],
  gridWidth: number,
  gridHeight: number,
  travelDistance?: number
): BattleUnit[] {
  return processAbilityTargeting(
    pattern,
    caster,
    targetX,
    targetY,
    allUnits,
    obstacles,
    gridWidth,
    gridHeight,
    {
      travelDistance,
      excludeCaster: true,
    }
  ).targets;
}

/**
 * Helper simplificado para abilities de buff/heal em aliados
 * Retorna apenas aliados na área
 */
export function getAlliesInArea(
  pattern: CoordinatePattern,
  caster: BattleUnit,
  targetX: number,
  targetY: number,
  allUnits: BattleUnit[],
  obstacles: BattleObstacle[],
  gridWidth: number,
  gridHeight: number
): BattleUnit[] {
  return processAbilityTargeting(
    pattern,
    caster,
    targetX,
    targetY,
    allUnits,
    obstacles,
    gridWidth,
    gridHeight,
    {
      alliesOnly: true,
    }
  ).targets;
}

// =============================================================================
// EIDOLON HELPERS
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
  // Import configs inline to avoid circular dependencies
  const {
    HP_CONFIG,
    MANA_CONFIG,
    PHYSICAL_PROTECTION_CONFIG,
    MAGICAL_PROTECTION_CONFIG,
  } = require("../../../../../shared/config");

  const statsGained = 1; // +1 em cada stat por kill
  const newBonus = currentBonus + statsGained;

  // Aplicar bônus imediatamente aos stats do Eidolon
  eidolon.combat += statsGained;
  eidolon.speed += statsGained;
  eidolon.focus += statsGained;
  eidolon.resistance += statsGained;
  eidolon.will += statsGained;
  eidolon.vitality += statsGained;

  // Aumentar HP máximo e atual usando configs
  const hpGain = statsGained * HP_CONFIG.multiplier;
  eidolon.maxHp += hpGain;
  eidolon.currentHp += hpGain;

  // Aumentar Mana máxima usando config
  const manaGain = statsGained * MANA_CONFIG.multiplier;
  eidolon.maxMana += manaGain;

  // Recalcular proteções máximas usando configs
  eidolon.maxPhysicalProtection =
    eidolon.resistance * PHYSICAL_PROTECTION_CONFIG.multiplier;
  eidolon.maxMagicalProtection =
    eidolon.will * MAGICAL_PROTECTION_CONFIG.multiplier;

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
  resistance: number;
  will: number;
  vitality: number;
} {
  // Stats base do Eidolon (de summons.data.ts)
  return {
    combat: 3,
    speed: 3,
    focus: 3,
    resistance: 3,
    will: 1,
    vitality: 3,
  };
}
