// shared/utils/targeting.utils.ts
// Sistema de targeting baseado em CoordinatePattern
// Substitui completamente o sistema antigo de TargetingShape

import type {
  TargetingDirection,
  CoordinatePattern,
  PatternCoordinate,
} from "../types/ability.types";
import { resolveDynamicValue } from "../types/ability.types";
import {
  isCellBlockedByObstacle as _isCellBlockedByObstacle,
  getObstacleOccupiedCellsForBlocking,
} from "./blocking.utils";
import { getUnitSizeDefinition, type UnitSize } from "../config";

// Re-exportar tipos para conveniência
export type { TargetingDirection, CoordinatePattern, PatternCoordinate };

// =============================================================================
// HELPER FUNCTION
// =============================================================================

/**
 * Retorna as células ocupadas por uma unidade baseado em seu tamanho
 */
function getUnitOccupiedCells(unit: {
  posX: number;
  posY: number;
  size?: string;
}): Array<{ x: number; y: number }> {
  const sizeDef = getUnitSizeDefinition((unit.size || "NORMAL") as UnitSize);
  const dimension = sizeDef.dimension;
  const cells: Array<{ x: number; y: number }> = [];
  for (let dx = 0; dx < dimension; dx++) {
    for (let dy = 0; dy < dimension; dy++) {
      cells.push({ x: unit.posX + dx, y: unit.posY + dy });
    }
  }
  return cells;
}

// =============================================================================
// TIPOS DE TARGETING
// =============================================================================

/**
 * Célula do preview de targeting
 */
export interface TargetingCell {
  x: number;
  y: number;
  /** Tipo de célula no preview */
  type: "RANGE" | "AREA" | "IMPACT" | "BLOCKED";
  /** Distância do centro/origem */
  distance: number;
}

/**
 * Resultado do cálculo de targeting
 */
export interface TargetingPreview {
  /** Células que podem ser selecionadas como alvo */
  selectableCells: TargetingCell[];
  /** Células que serão afetadas após seleção (área de efeito) */
  affectedCells: TargetingCell[];
  /** Célula atualmente sob o mouse (se hover) */
  hoverCell?: { x: number; y: number };
  /** Se o alvo atual é válido */
  isValidTarget: boolean;
  /** Mensagem de erro se inválido */
  errorMessage?: string;
  /** Direção do alvo em relação à unidade */
  direction?: TargetingDirection;
}

/**
 * Contexto do grid para cálculos de targeting
 */
export interface GridContext {
  gridWidth: number;
  gridHeight: number;
  obstacles: Array<{ posX: number; posY: number; destroyed?: boolean }>;
  units: Array<{
    id: string;
    posX: number;
    posY: number;
    isAlive: boolean;
    ownerId: string;
  }>;
}

/**
 * Atributos da unidade para resolver valores dinâmicos
 */
export interface UnitStats {
  combat: number;
  speed: number;
  focus: number;
  resistance: number;
  will: number;
  vitality: number;
  level: number;
}

/**
 * Unidade para sistema de projétil
 */
export interface ProjectileUnit {
  id: string;
  posX: number;
  posY: number;
  isAlive: boolean;
  /** Owner ID para filtrar aliados/inimigos */
  ownerId?: string;
  /** Tamanho da unidade para cálculo de células ocupadas */
  size?: string;
}

// =============================================================================
// FUNÇÕES DE CÁLCULO DE DISTÂNCIA
// =============================================================================

/**
 * Calcula distância Manhattan (movimento em grid ortogonal)
 */
export function getManhattanDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.abs(x2 - x1) + Math.abs(y2 - y1);
}

/**
 * Calcula distância Chebyshev (movimento em grid com diagonais)
 */
export function getChebyshevDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
}

/**
 * Verifica se uma célula está dentro dos limites do grid
 */
export function isInBounds(
  x: number,
  y: number,
  gridWidth: number,
  gridHeight: number
): boolean {
  return x >= 0 && x < gridWidth && y >= 0 && y < gridHeight;
}

/**
 * Verifica se uma célula está bloqueada por obstáculo
 */
export function isCellBlocked(
  x: number,
  y: number,
  obstacles: Array<{ posX: number; posY: number; destroyed?: boolean }>
): boolean {
  return _isCellBlockedByObstacle(x, y, obstacles);
}

/**
 * Verifica se uma célula está ocupada por unidade viva
 */
export function isCellOccupied(
  x: number,
  y: number,
  units: Array<{ posX: number; posY: number; isAlive: boolean }>
): boolean {
  return units.some(
    (unit) => unit.posX === x && unit.posY === y && unit.isAlive
  );
}

// =============================================================================
// FUNÇÕES DE DIREÇÃO
// =============================================================================

/**
 * Retorna delta de movimento para uma direção
 */
export function getDirectionDelta(direction: TargetingDirection): {
  dx: number;
  dy: number;
} {
  switch (direction) {
    case "NORTH":
      return { dx: 0, dy: -1 };
    case "SOUTH":
      return { dx: 0, dy: 1 };
    case "EAST":
      return { dx: 1, dy: 0 };
    case "WEST":
      return { dx: -1, dy: 0 };
    case "NORTHEAST":
      return { dx: 1, dy: -1 };
    case "NORTHWEST":
      return { dx: -1, dy: -1 };
    case "SOUTHEAST":
      return { dx: 1, dy: 1 };
    case "SOUTHWEST":
      return { dx: -1, dy: 1 };
  }
}

/**
 * Determina a direção entre dois pontos
 */
export function getDirectionBetweenPoints(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): TargetingDirection {
  const dx = toX - fromX;
  const dy = toY - fromY;

  // Prioriza direções cardinais se o movimento for mais nessa direção
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "EAST" : "WEST";
  } else if (Math.abs(dy) > Math.abs(dx)) {
    return dy > 0 ? "SOUTH" : "NORTH";
  } else {
    // Diagonal
    if (dx > 0 && dy > 0) return "SOUTHEAST";
    if (dx > 0 && dy < 0) return "NORTHEAST";
    if (dx < 0 && dy > 0) return "SOUTHWEST";
    return "NORTHWEST";
  }
}

// =============================================================================
// SISTEMA DE COORDINATE PATTERN
// =============================================================================

/**
 * Rotaciona uma coordenada baseado na direção
 * O pattern original assume que NORTH é a direção padrão (y negativo = frente)
 */
function rotateCoordinateByDirection(
  coord: PatternCoordinate,
  direction: TargetingDirection
): PatternCoordinate {
  const { x, y } = coord;

  switch (direction) {
    case "NORTH":
      return { x, y };
    case "SOUTH":
      return { x: -x, y: -y };
    case "EAST":
      return { x: -y, y: x };
    case "WEST":
      return { x: y, y: -x };
    case "NORTHEAST":
      return { x: x - y, y: x + y };
    case "NORTHWEST":
      return { x: x + y, y: -x + y };
    case "SOUTHEAST":
      return { x: -x - y, y: x - y };
    case "SOUTHWEST":
      return { x: -x + y, y: -x - y };
    default:
      return { x, y };
  }
}

/**
 * Calcula as células absolutas afetadas por um CoordinatePattern
 */
export function calculatePatternCells(
  pattern: CoordinatePattern,
  casterX: number,
  casterY: number,
  targetX: number,
  targetY: number,
  gridWidth: number,
  gridHeight: number
): PatternCoordinate[] {
  // Determinar origem das coordenadas
  let originX: number;
  let originY: number;

  switch (pattern.origin) {
    case "CASTER":
      originX = casterX;
      originY = casterY;
      break;
    case "TARGET":
      originX = targetX;
      originY = targetY;
      break;
    case "DIRECTION":
      originX = casterX;
      originY = casterY;
      break;
    default:
      originX = casterX;
      originY = casterY;
  }

  // Calcular direção se o pattern for rotacionável
  let direction: TargetingDirection = "NORTH";
  if (pattern.rotatable && (casterX !== targetX || casterY !== targetY)) {
    direction = getDirectionBetweenPoints(casterX, casterY, targetX, targetY);
  }

  // Converter coordenadas relativas para absolutas
  const absoluteCells: PatternCoordinate[] = [];

  for (const coord of pattern.coordinates) {
    const rotated = pattern.rotatable
      ? rotateCoordinateByDirection(coord, direction)
      : coord;

    const absX = originX + rotated.x;
    const absY = originY + rotated.y;

    if (absX >= 0 && absX < gridWidth && absY >= 0 && absY < gridHeight) {
      absoluteCells.push({ x: absX, y: absY });
    }
  }

  // Incluir origem se especificado
  if (pattern.includeOrigin) {
    const hasOrigin = absoluteCells.some(
      (c) => c.x === originX && c.y === originY
    );
    if (
      !hasOrigin &&
      originX >= 0 &&
      originX < gridWidth &&
      originY >= 0 &&
      originY < gridHeight
    ) {
      absoluteCells.unshift({ x: originX, y: originY });
    }
  }

  return absoluteCells;
}

/**
 * Calcula células selecionáveis baseado no maxRange do pattern
 */
export function calculateSelectableCells(
  pattern: CoordinatePattern,
  casterX: number,
  casterY: number,
  unitStats: UnitStats,
  gridWidth: number,
  gridHeight: number
): TargetingCell[] {
  // Se pattern é SELF (origin=CASTER sem range), apenas a célula do caster
  if (pattern.origin === "CASTER" && !pattern.maxRange) {
    return [{ x: casterX, y: casterY, type: "RANGE", distance: 0 }];
  }

  // Resolver maxRange
  const maxRange = pattern.maxRange
    ? resolveDynamicValue(pattern.maxRange, unitStats)
    : 1;

  const cells: TargetingCell[] = [];

  // Gerar células dentro do range (diamante Manhattan)
  for (let dx = -maxRange; dx <= maxRange; dx++) {
    for (let dy = -maxRange; dy <= maxRange; dy++) {
      const distance = Math.abs(dx) + Math.abs(dy);
      if (distance > maxRange || distance === 0) continue;

      const x = casterX + dx;
      const y = casterY + dy;

      if (isInBounds(x, y, gridWidth, gridHeight)) {
        cells.push({ x, y, type: "RANGE", distance });
      }
    }
  }

  return cells;
}

/**
 * Calcula células afetadas quando o mouse está sobre uma posição
 */
export function calculateAffectedCells(
  pattern: CoordinatePattern,
  casterX: number,
  casterY: number,
  targetX: number,
  targetY: number,
  gridWidth: number,
  gridHeight: number
): TargetingCell[] {
  const patternCells = calculatePatternCells(
    pattern,
    casterX,
    casterY,
    targetX,
    targetY,
    gridWidth,
    gridHeight
  );

  return patternCells.map((cell) => ({
    x: cell.x,
    y: cell.y,
    type: "IMPACT" as const,
    distance: getManhattanDistance(casterX, casterY, cell.x, cell.y),
  }));
}

/**
 * Calcula o preview completo de targeting baseado em CoordinatePattern
 */
export function calculateTargetingPreview(
  pattern: CoordinatePattern,
  casterX: number,
  casterY: number,
  unitStats: UnitStats,
  grid: GridContext,
  hoverX?: number,
  hoverY?: number
): TargetingPreview {
  // Se não há posição do mouse, retornar vazio
  if (hoverX === undefined || hoverY === undefined) {
    return {
      selectableCells: [],
      affectedCells: [],
      isValidTarget: false,
    };
  }

  // Calcular direção do mouse em relação à unidade
  const direction = getDirectionBetweenPoints(casterX, casterY, hoverX, hoverY);

  // Calcular células afetadas baseado no pattern
  const affectedCells = calculateAffectedCells(
    pattern,
    casterX,
    casterY,
    hoverX,
    hoverY,
    grid.gridWidth,
    grid.gridHeight
  );

  // Verificar se o alvo está dentro do range máximo
  const maxRange = pattern.maxRange
    ? resolveDynamicValue(pattern.maxRange, unitStats)
    : Infinity;
  const targetDistance = getManhattanDistance(casterX, casterY, hoverX, hoverY);
  const inRange = targetDistance <= maxRange;

  // Sempre válido se há células afetadas e está no range
  const isValidTarget = affectedCells.length > 0 && inRange;

  return {
    selectableCells: [], // Não usamos mais - sistema puramente direcional
    affectedCells,
    hoverCell: affectedCells.length > 0 ? affectedCells[0] : undefined,
    isValidTarget,
    errorMessage: isValidTarget ? undefined : "Fora do alcance",
    direction,
  };
}

// =============================================================================
// SISTEMA DE PROJÉTIL COM COORDINATE PATTERN
// =============================================================================

/**
 * Resultado do cálculo de trajetória de projétil
 */
export interface ProjectileTrajectory {
  orderedCells: Array<{ x: number; y: number; distance: number }>;
  currentIndex: number;
  hasMoreCells: boolean;
  nextCell?: { x: number; y: number };
}

/**
 * Ordena coordenadas do pattern para percurso de projétil
 */
export function orderCoordinatesForProjectile(
  coordinates: PatternCoordinate[],
  originX: number,
  originY: number,
  order: "DISTANCE" | "SEQUENTIAL" | "REVERSE" = "DISTANCE"
): Array<{ x: number; y: number; distance: number }> {
  const withDistance = coordinates.map((coord) => ({
    x: coord.x,
    y: coord.y,
    distance: getManhattanDistance(originX, originY, coord.x, coord.y),
  }));

  switch (order) {
    case "DISTANCE":
      return withDistance.sort((a, b) => a.distance - b.distance);
    case "REVERSE":
      return withDistance.sort((a, b) => b.distance - a.distance);
    case "SEQUENTIAL":
    default:
      return withDistance;
  }
}

/**
 * Calcula a trajetória completa de um projétil
 */
export function calculateProjectileTrajectory(
  pattern: CoordinatePattern,
  casterX: number,
  casterY: number,
  targetX: number,
  targetY: number,
  gridWidth: number,
  gridHeight: number
): ProjectileTrajectory {
  const affectedCells = calculatePatternCells(
    pattern,
    casterX,
    casterY,
    targetX,
    targetY,
    gridWidth,
    gridHeight
  );

  const projectileOrder = pattern.projectileOrder ?? "DISTANCE";
  const orderedCells = orderCoordinatesForProjectile(
    affectedCells,
    casterX,
    casterY,
    projectileOrder
  );

  return {
    orderedCells,
    currentIndex: 0,
    hasMoreCells: orderedCells.length > 0,
    nextCell: orderedCells.length > 0 ? orderedCells[0] : undefined,
  };
}

/**
 * Encontra o primeiro alvo na trajetória do projétil
 */
export function findNextProjectileTarget(
  trajectory: ProjectileTrajectory,
  units: ProjectileUnit[],
  casterId: string,
  startIndex: number = 0
): {
  target: ProjectileUnit | null;
  cellIndex: number;
  cell: { x: number; y: number } | null;
  remainingCells: Array<{ x: number; y: number; distance: number }>;
} {
  const aliveUnits = units.filter((u) => u.isAlive && u.id !== casterId);

  for (let i = startIndex; i < trajectory.orderedCells.length; i++) {
    const cell = trajectory.orderedCells[i];

    // Verificar se há unidade nesta célula (considerando tamanho)
    const unitInCell = aliveUnits.find((u) => {
      const cells = getUnitOccupiedCells(u);
      return cells.some((c) => c.x === cell.x && c.y === cell.y);
    });

    if (unitInCell) {
      return {
        target: unitInCell,
        cellIndex: i,
        cell: { x: cell.x, y: cell.y },
        remainingCells: trajectory.orderedCells.slice(i + 1),
      };
    }
  }

  return {
    target: null,
    cellIndex: -1,
    cell: null,
    remainingCells: [],
  };
}

/**
 * Continua a trajetória do projétil após uma esquiva
 */
export function continueProjectileAfterDodge(
  trajectory: ProjectileTrajectory,
  lastHitIndex: number,
  units: ProjectileUnit[],
  casterId: string
): {
  nextTarget: ProjectileUnit | null;
  nextCellIndex: number;
  projectileContinues: boolean;
} {
  const result = findNextProjectileTarget(
    trajectory,
    units,
    casterId,
    lastHitIndex + 1
  );

  return {
    nextTarget: result.target,
    nextCellIndex: result.cellIndex,
    projectileContinues: result.target !== null,
  };
}

/**
 * Resultado completo do processamento de projétil
 */
export interface ProjectileProcessResult {
  targets: ProjectileUnit[];
  pathCells: Array<{ x: number; y: number; distance: number }>;
  blocked: boolean;
  blockedByUnitId?: string;
  hasRemainingCells: boolean;
  remainingCells: Array<{ x: number; y: number; distance: number }>;
}

/**
 * Processa a trajetória completa de um projétil
 */
export function processProjectileForPattern(
  pattern: CoordinatePattern,
  casterX: number,
  casterY: number,
  targetX: number,
  targetY: number,
  units: ProjectileUnit[],
  gridWidth: number,
  gridHeight: number,
  config: {
    piercing?: boolean;
    maxTargets?: number;
  } = {}
): ProjectileProcessResult {
  const trajectory = calculateProjectileTrajectory(
    pattern,
    casterX,
    casterY,
    targetX,
    targetY,
    gridWidth,
    gridHeight
  );

  const aliveUnits = units.filter((u) => u.isAlive);
  const targets: ProjectileUnit[] = [];
  const pathCells: Array<{ x: number; y: number; distance: number }> = [];
  const maxTargets = config.maxTargets ?? (config.piercing ? Infinity : 1);

  let blocked = false;
  let blockedByUnitId: string | undefined;

  for (const cell of trajectory.orderedCells) {
    pathCells.push(cell);

    // Verificar se há unidade nesta célula (considerando tamanho)
    const unitInCell = aliveUnits.find((u) => {
      const cells = getUnitOccupiedCells(u);
      return cells.some((c) => c.x === cell.x && c.y === cell.y);
    });

    if (unitInCell) {
      targets.push(unitInCell);

      if (targets.length >= maxTargets) {
        blocked = true;
        blockedByUnitId = unitInCell.id;
        break;
      }

      if (!config.piercing) {
        blocked = true;
        blockedByUnitId = unitInCell.id;
        break;
      }
    }
  }

  const remainingCells = trajectory.orderedCells.slice(pathCells.length);

  return {
    targets,
    pathCells,
    blocked,
    blockedByUnitId,
    hasRemainingCells: remainingCells.length > 0,
    remainingCells,
  };
}

// =============================================================================
// SISTEMA DE VIAGEM + EXPLOSÃO (PROJECTILE WITH AOE)
// =============================================================================

/**
 * Obstáculo para cálculos de viagem
 */
export interface TravelObstacle {
  posX: number;
  posY: number;
  destroyed?: boolean;
  /** Tamanho do obstáculo para ocupar múltiplas células */
  size?: "SMALL" | "MEDIUM" | "LARGE" | "HUGE";
}

/**
 * Resultado do cálculo de viagem do projétil
 */
export interface TravelResult {
  /** Ponto de impacto final (onde explode/aplica área) */
  impactPoint: { x: number; y: number };
  /** Células percorridas durante a viagem */
  travelPath: Array<{ x: number; y: number }>;
  /** Se foi interceptado (não chegou ao destino original) */
  intercepted: boolean;
  /** Tipo de interceptação */
  interceptedBy?: "unit" | "obstacle" | "edge";
  /** ID da unidade que interceptou (se foi unidade) */
  interceptedUnitId?: string;
  /** Distância percorrida */
  distanceTraveled: number;
}

/**
 * Resultado completo do processamento de ability com viagem + área
 */
export interface AreaAbilityResult {
  /** Ponto de impacto (onde a área é aplicada) */
  impactPoint: { x: number; y: number };
  /** Células afetadas pela área de efeito */
  affectedCells: PatternCoordinate[];
  /** Unidades afetadas na área */
  affectedUnits: ProjectileUnit[];
  /** Se o projétil foi interceptado durante a viagem */
  intercepted: boolean;
  /** Detalhes da viagem (se houve) */
  travelDetails?: TravelResult;
}

/**
 * Calcula a viagem de um projétil até o ponto de impacto
 * Verifica interceptação por unidades e obstáculos no caminho
 */
export function calculateProjectileTravel(
  casterX: number,
  casterY: number,
  targetX: number,
  targetY: number,
  maxDistance: number,
  units: ProjectileUnit[],
  obstacles: TravelObstacle[],
  gridWidth: number,
  gridHeight: number,
  config: {
    stopsOnUnit?: boolean;
    stopsOnObstacle?: boolean;
    excludeCasterId?: string;
  } = {}
): TravelResult {
  const stopsOnUnit = config.stopsOnUnit ?? true;
  const stopsOnObstacle = config.stopsOnObstacle ?? true;

  // Calcular direção
  const direction = getDirectionBetweenPoints(
    casterX,
    casterY,
    targetX,
    targetY
  );
  const delta = getDirectionDelta(direction);

  const travelPath: Array<{ x: number; y: number }> = [];
  let currentX = casterX;
  let currentY = casterY;
  let intercepted = false;
  let interceptedBy: "unit" | "obstacle" | "edge" | undefined;
  let interceptedUnitId: string | undefined;

  // Unidades vivas (excluindo caster)
  const aliveUnits = units.filter(
    (u) => u.isAlive && u.id !== config.excludeCasterId
  );

  // Obstáculos ativos
  const activeObstacles = obstacles.filter((o) => !o.destroyed);

  // Percorrer células na direção do alvo
  for (let i = 1; i <= maxDistance; i++) {
    const nextX = casterX + delta.dx * i;
    const nextY = casterY + delta.dy * i;

    // Verificar limites do grid
    if (!isInBounds(nextX, nextY, gridWidth, gridHeight)) {
      intercepted = true;
      interceptedBy = "edge";
      break;
    }

    // Verificar obstáculo (considerando tamanho do obstáculo)
    if (stopsOnObstacle) {
      const hitObstacle = activeObstacles.find((o) => {
        const occupiedCells = getObstacleOccupiedCellsForBlocking(o);
        return occupiedCells.some(
          (cell) => cell.x === nextX && cell.y === nextY
        );
      });
      if (hitObstacle) {
        travelPath.push({ x: nextX, y: nextY });
        currentX = nextX;
        currentY = nextY;
        intercepted = true;
        interceptedBy = "obstacle";
        break;
      }
    }

    // Verificar unidade (considerando tamanho)
    if (stopsOnUnit) {
      const hitUnit = aliveUnits.find((u) => {
        const cells = getUnitOccupiedCells(u);
        return cells.some((c) => c.x === nextX && c.y === nextY);
      });
      if (hitUnit) {
        travelPath.push({ x: nextX, y: nextY });
        currentX = nextX;
        currentY = nextY;
        intercepted = true;
        interceptedBy = "unit";
        interceptedUnitId = hitUnit.id;
        break;
      }
    }

    // Célula livre, adicionar ao caminho
    travelPath.push({ x: nextX, y: nextY });
    currentX = nextX;
    currentY = nextY;

    // Chegou no destino original?
    if (nextX === targetX && nextY === targetY) {
      break;
    }
  }

  return {
    impactPoint: { x: currentX, y: currentY },
    travelPath,
    intercepted,
    interceptedBy,
    interceptedUnitId,
    distanceTraveled: travelPath.length,
  };
}

/**
 * Processa uma ability com sistema de viagem + explosão
 * Usado para spells como FIRE que viajam e depois explodem
 */
export function processAreaAbility(
  pattern: CoordinatePattern,
  casterX: number,
  casterY: number,
  targetX: number,
  targetY: number,
  units: ProjectileUnit[],
  obstacles: TravelObstacle[],
  gridWidth: number,
  gridHeight: number,
  travelDistance?: number,
  casterId?: string
): AreaAbilityResult {
  let impactPoint = { x: targetX, y: targetY };
  let travelDetails: TravelResult | undefined;
  let intercepted = false;

  // Se tem viagem, calcular trajetória
  if (travelDistance && travelDistance > 0) {
    travelDetails = calculateProjectileTravel(
      casterX,
      casterY,
      targetX,
      targetY,
      travelDistance,
      units,
      obstacles,
      gridWidth,
      gridHeight,
      {
        stopsOnUnit: pattern.stopsOnUnit ?? true,
        stopsOnObstacle: pattern.stopsOnObstacle ?? true,
        excludeCasterId: casterId,
      }
    );

    impactPoint = travelDetails.impactPoint;
    intercepted = travelDetails.intercepted;
  }

  // Determinar pattern de explosão (pode ser um sub-pattern ou o próprio pattern)
  const explosionPattern = pattern.explosionPattern ?? pattern;

  // Calcular células afetadas pela explosão no ponto de impacto
  const affectedCells = calculatePatternCells(
    explosionPattern,
    casterX,
    casterY,
    impactPoint.x,
    impactPoint.y,
    gridWidth,
    gridHeight
  );

  // Encontrar unidades na área afetada (considerando tamanho da unidade)
  const aliveUnits = units.filter((u) => u.isAlive);
  const affectedUnits = aliveUnits.filter((unit) => {
    // Obter todas as células ocupadas pela unidade
    const unitCells = getUnitOccupiedCells(unit);
    // Verificar se alguma célula da unidade está na área afetada
    return unitCells.some((unitCell) =>
      affectedCells.some(
        (areaCell) => areaCell.x === unitCell.x && areaCell.y === unitCell.y
      )
    );
  });

  return {
    impactPoint,
    affectedCells,
    affectedUnits,
    intercepted,
    travelDetails,
  };
}

/**
 * Helper simplificado para executores de abilities de área
 * Retorna apenas as unidades afetadas, considerando viagem + explosão
 */
export function getTargetsInArea(
  pattern: CoordinatePattern,
  casterX: number,
  casterY: number,
  targetX: number,
  targetY: number,
  units: ProjectileUnit[],
  obstacles: TravelObstacle[],
  gridWidth: number,
  gridHeight: number,
  travelDistance?: number,
  casterId?: string,
  filterFn?: (unit: ProjectileUnit) => boolean
): {
  targets: ProjectileUnit[];
  impactPoint: { x: number; y: number };
  affectedCells: PatternCoordinate[];
  intercepted: boolean;
} {
  const result = processAreaAbility(
    pattern,
    casterX,
    casterY,
    targetX,
    targetY,
    units,
    obstacles,
    gridWidth,
    gridHeight,
    travelDistance,
    casterId
  );

  // Aplicar filtro opcional (ex: apenas inimigos)
  let targets = result.affectedUnits;
  if (filterFn) {
    targets = targets.filter(filterFn);
  }

  return {
    targets,
    impactPoint: result.impactPoint,
    affectedCells: result.affectedCells,
    intercepted: result.intercepted,
  };
}

// =============================================================================
// QTE HANDLER (PLACEHOLDER)
// =============================================================================

/**
 * Handler para iniciar QTE ao confirmar alvo
 */
export function handleQTE(
  actionType: "ATTACK" | "ABILITY",
  unitId: string,
  targetX: number,
  targetY: number,
  abilityCode?: string
): void {
  console.log(`[QTE] ${actionType} by ${unitId} at (${targetX}, ${targetY})`, {
    abilityCode,
  });
}
