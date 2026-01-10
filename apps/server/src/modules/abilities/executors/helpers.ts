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
  type ImpactConfig,
} from "@boundless/shared/types/ability.types";
import { isAdjacentOmnidirectional } from "@boundless/shared/utils/distance.utils";
import {
  getTargetsInArea,
  type ProjectileUnit,
  type TravelObstacle,
  type PatternCoordinate,
} from "@boundless/shared/utils/targeting.utils";
import {
  calculateMultipleImpacts,
  type ImpactUnit,
  type ImpactObstacle,
  type ImpactResult,
} from "@boundless/shared/utils/impact.utils";

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
    size: unit.size,
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
    size: obstacle.size,
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

// =============================================================================
// IMPACT HELPERS
// =============================================================================

/**
 * Converte BattleUnit para ImpactUnit
 */
function toImpactUnit(unit: BattleUnit): ImpactUnit {
  return {
    id: unit.id,
    posX: unit.posX,
    posY: unit.posY,
    isAlive: unit.isAlive,
    combat: unit.combat,
    speed: unit.speed,
    focus: unit.focus,
    resistance: unit.resistance,
    will: unit.will,
    vitality: unit.vitality,
    level: unit.level ?? 1,
  };
}

/**
 * Converte BattleObstacle para ImpactObstacle
 */
function toImpactObstacle(obstacle: BattleObstacle): ImpactObstacle {
  return {
    id: obstacle.id,
    posX: obstacle.posX,
    posY: obstacle.posY,
    destroyed: obstacle.destroyed,
    dimension:
      typeof obstacle.size === "number"
        ? obstacle.size
        : obstacle.size === "LARGE"
        ? 2
        : 1,
  };
}

/**
 * Resultado do processamento de impacto
 */
export interface ProcessImpactResult {
  /** Resultados individuais de cada unidade empurrada */
  impacts: ImpactResult[];
  /** Dano total adicional causado por colisões */
  totalCollisionDamage: number;
  /** Unidades que sofreram dano de colisão */
  collisionDamageApplied: Array<{
    unitId: string;
    damage: number;
    hpAfter: number;
    defeated: boolean;
  }>;
}

/**
 * Processa o impacto (knockback) de uma ability para as unidades atingidas
 * Atualiza as posições das unidades e aplica dano de colisão se configurado
 *
 * @param impactConfig Configuração de impacto da ability
 * @param caster Unidade que usou a ability
 * @param targetsHit Unidades atingidas pela ability
 * @param impactOriginX Ponto X de origem do impacto (ex: centro da explosão)
 * @param impactOriginY Ponto Y de origem do impacto
 * @param baseDamage Dano base da ability (para calcular dano de colisão)
 * @param allUnits Todas as unidades na batalha
 * @param obstacles Obstáculos na batalha
 * @param gridWidth Largura do grid
 * @param gridHeight Altura do grid
 * @param applyDamageFn Função para aplicar dano (injetada para evitar dependência circular)
 */
export function processImpact(
  impactConfig: ImpactConfig,
  caster: BattleUnit,
  targetsHit: BattleUnit[],
  impactOriginX: number,
  impactOriginY: number,
  baseDamage: number,
  allUnits: BattleUnit[],
  obstacles: BattleObstacle[],
  gridWidth: number,
  gridHeight: number,
  applyDamageFn?: (
    unit: BattleUnit,
    damage: number,
    damageType: "FISICO" | "MAGICO"
  ) => { newHp: number; defeated: boolean }
): ProcessImpactResult {
  // Converter para tipos de impacto
  const impactTargets = targetsHit.map(toImpactUnit);
  const impactUnits = allUnits.map(toImpactUnit);
  const impactObstacles = obstacles.map(toImpactObstacle);

  // Atributos do caster para resolver valores dinâmicos
  const casterAttrs = {
    combat: caster.combat,
    speed: caster.speed,
    focus: caster.focus,
    resistance: caster.resistance,
    will: caster.will,
    vitality: caster.vitality,
    level: caster.level ?? 1,
  };

  // Calcular impactos
  const impacts = calculateMultipleImpacts(
    impactTargets,
    impactOriginX,
    impactOriginY,
    impactConfig,
    casterAttrs,
    baseDamage,
    impactUnits,
    impactObstacles,
    gridWidth,
    gridHeight
  );

  // Aplicar resultados às unidades originais
  let totalCollisionDamage = 0;
  const collisionDamageApplied: ProcessImpactResult["collisionDamageApplied"] =
    [];

  for (const impact of impacts) {
    // Encontrar unidade original e atualizar posição
    const unit = allUnits.find((u) => u.id === impact.unitId);
    if (!unit) continue;

    // Mover unidade
    if (impact.distancePushed > 0) {
      unit.posX = impact.toX;
      unit.posY = impact.toY;
      console.log(
        `💨 ${unit.name} empurrado de (${impact.fromX}, ${impact.fromY}) para (${impact.toX}, ${impact.toY})`
      );
    }

    // Aplicar dano de colisão
    if (impact.collisionDamage > 0) {
      totalCollisionDamage += impact.collisionDamage;

      if (applyDamageFn) {
        const damageResult = applyDamageFn(
          unit,
          impact.collisionDamage,
          "FISICO" // Dano de colisão é sempre físico
        );

        collisionDamageApplied.push({
          unitId: unit.id,
          damage: impact.collisionDamage,
          hpAfter: damageResult.newHp,
          defeated: damageResult.defeated,
        });

        console.log(
          `💥 ${unit.name} sofreu ${impact.collisionDamage} de dano de colisão (${impact.collisionType})`
        );
      }
    }
  }

  return {
    impacts,
    totalCollisionDamage,
    collisionDamageApplied,
  };
}
