// shared/utils/targeting.utils.ts
// Sistema unificado de targeting para Skills e Spells
// Calcula preview de alcance, células afetadas e validação de alvos

import type {
  AbilityRange,
  AbilityTargetType,
  DynamicValue,
  TargetingShape,
  TargetingDirection,
} from "../types/ability.types";
import {
  DEFAULT_RANGE_DISTANCE,
  resolveDynamicValue,
} from "../types/ability.types";

// Re-exportar tipos para conveniência
export type { TargetingShape, TargetingDirection };

// =============================================================================
// TIPOS DE TARGETING
// =============================================================================

/**
 * Configuração de targeting de uma habilidade
 */
export interface TargetingConfig {
  /** Tipo de alcance base */
  range: AbilityRange;
  /** Distância máxima (pode ser dinâmica baseada em atributo) */
  rangeDistance?: DynamicValue;
  /** Tipo de alvo */
  targetType: AbilityTargetType;
  /** Forma do padrão de targeting */
  shape: TargetingShape;
  /** Tamanho da área de efeito (para SQUARE, DIAMOND, etc) */
  areaSize?: DynamicValue;
  /** Se pode atravessar obstáculos */
  piercing?: boolean;
  /** Se inclui a célula do próprio usuário */
  includeSelf?: boolean;
  /** Número de alvos máximos (para multi-target) */
  maxTargets?: number;
}

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
  return obstacles.some(
    (obs) => obs.posX === x && obs.posY === y && !obs.destroyed
  );
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
// FUNÇÕES DE GERAÇÃO DE CÉLULAS
// =============================================================================

/**
 * Gera células em um padrão de diamante (distância Manhattan)
 */
export function getDiamondCells(
  centerX: number,
  centerY: number,
  radius: number,
  gridWidth: number,
  gridHeight: number,
  includeSelf: boolean = true
): TargetingCell[] {
  const cells: TargetingCell[] = [];

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const distance = Math.abs(dx) + Math.abs(dy);
      if (distance > radius) continue;
      if (!includeSelf && dx === 0 && dy === 0) continue;

      const x = centerX + dx;
      const y = centerY + dy;

      if (isInBounds(x, y, gridWidth, gridHeight)) {
        cells.push({ x, y, type: "RANGE", distance });
      }
    }
  }

  return cells;
}

/**
 * Gera células em um padrão quadrado
 */
export function getSquareCells(
  centerX: number,
  centerY: number,
  size: number,
  gridWidth: number,
  gridHeight: number,
  includeSelf: boolean = true
): TargetingCell[] {
  const cells: TargetingCell[] = [];
  const halfSize = Math.floor(size / 2);

  for (let dx = -halfSize; dx <= halfSize; dx++) {
    for (let dy = -halfSize; dy <= halfSize; dy++) {
      if (!includeSelf && dx === 0 && dy === 0) continue;

      const x = centerX + dx;
      const y = centerY + dy;
      const distance = getChebyshevDistance(centerX, centerY, x, y);

      if (isInBounds(x, y, gridWidth, gridHeight)) {
        cells.push({ x, y, type: "AREA", distance });
      }
    }
  }

  return cells;
}

/**
 * Gera células em uma linha reta
 */
export function getLineCells(
  startX: number,
  startY: number,
  direction: TargetingDirection,
  length: number,
  gridWidth: number,
  gridHeight: number
): TargetingCell[] {
  const cells: TargetingCell[] = [];
  const deltas = getDirectionDelta(direction);

  for (let i = 1; i <= length; i++) {
    const x = startX + deltas.dx * i;
    const y = startY + deltas.dy * i;
    const distance = i;

    if (isInBounds(x, y, gridWidth, gridHeight)) {
      cells.push({ x, y, type: "RANGE", distance });
    } else {
      break; // Parar se sair do grid
    }
  }

  return cells;
}

/**
 * Gera células em padrão de cruz (+)
 */
export function getCrossCells(
  centerX: number,
  centerY: number,
  radius: number,
  gridWidth: number,
  gridHeight: number,
  includeSelf: boolean = true
): TargetingCell[] {
  const cells: TargetingCell[] = [];

  // Centro
  if (includeSelf) {
    cells.push({ x: centerX, y: centerY, type: "RANGE", distance: 0 });
  }

  // 4 direções cardinais
  const directions: TargetingDirection[] = ["NORTH", "SOUTH", "EAST", "WEST"];
  for (const dir of directions) {
    const lineCells = getLineCells(
      centerX,
      centerY,
      dir,
      radius,
      gridWidth,
      gridHeight
    );
    cells.push(...lineCells);
  }

  return cells;
}

/**
 * Gera células em anel (ring) ao redor de um ponto
 */
export function getRingCells(
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  gridWidth: number,
  gridHeight: number
): TargetingCell[] {
  const cells: TargetingCell[] = [];

  for (let dx = -outerRadius; dx <= outerRadius; dx++) {
    for (let dy = -outerRadius; dy <= outerRadius; dy++) {
      const distance = Math.abs(dx) + Math.abs(dy);
      if (distance < innerRadius || distance > outerRadius) continue;

      const x = centerX + dx;
      const y = centerY + dy;

      if (isInBounds(x, y, gridWidth, gridHeight)) {
        cells.push({ x, y, type: "RANGE", distance });
      }
    }
  }

  return cells;
}

// =============================================================================
// HELPERS DE DIREÇÃO
// =============================================================================

/**
 * Obtém o delta de movimento para uma direção
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
// FUNÇÃO PRINCIPAL DE CÁLCULO DE TARGETING PREVIEW
// =============================================================================

/**
 * Calcula as células selecionáveis para uma habilidade baseado na configuração
 */
export function calculateSelectableCells(
  config: TargetingConfig,
  unitX: number,
  unitY: number,
  unitStats: UnitStats,
  grid: GridContext
): TargetingCell[] {
  // Resolver distância do range
  const rangeDistance = config.rangeDistance
    ? resolveDynamicValue(config.rangeDistance, unitStats)
    : DEFAULT_RANGE_DISTANCE[config.range];

  let cells: TargetingCell[] = [];

  switch (config.range) {
    case "SELF":
      // Apenas a própria célula
      cells = [{ x: unitX, y: unitY, type: "RANGE", distance: 0 }];
      break;

    case "MELEE":
      // Células adjacentes (distância 1) - usando Chebyshev para 8 direções
      cells = getSquareCells(
        unitX,
        unitY,
        3, // 3x3 para incluir todas as 8 células adjacentes
        grid.gridWidth,
        grid.gridHeight,
        false // Não inclui self em melee
      ).map((c) => ({ ...c, type: "RANGE" as const }));
      break;

    case "RANGED":
      // Todas as células dentro do range (exceto self)
      cells = getDiamondCells(
        unitX,
        unitY,
        rangeDistance,
        grid.gridWidth,
        grid.gridHeight,
        false
      );
      break;

    case "AREA":
      // Todas as células dentro do range (pode incluir self)
      cells = getDiamondCells(
        unitX,
        unitY,
        rangeDistance,
        grid.gridWidth,
        grid.gridHeight,
        config.includeSelf ?? true
      );
      break;
  }

  // Filtrar células bloqueadas (se não tiver piercing)
  if (!config.piercing) {
    cells = cells.filter(
      (cell) => !isCellBlocked(cell.x, cell.y, grid.obstacles)
    );
  }

  return cells;
}

/**
 * Calcula as células que serão afetadas quando o mouse está sobre uma célula alvo
 */
export function calculateAffectedCells(
  config: TargetingConfig,
  unitX: number,
  unitY: number,
  targetX: number,
  targetY: number,
  unitStats: UnitStats,
  grid: GridContext
): TargetingCell[] {
  // Resolver tamanho da área
  const areaSize = config.areaSize
    ? resolveDynamicValue(config.areaSize, unitStats)
    : 1;

  let cells: TargetingCell[] = [];

  switch (config.shape) {
    case "SINGLE":
      // Apenas a célula alvo
      cells = [
        {
          x: targetX,
          y: targetY,
          type: "IMPACT",
          distance: 0,
        },
      ];
      break;

    case "LINE":
      // Linha do usuário até o alvo (e além, se areaSize > 1)
      const direction = getDirectionBetweenPoints(
        unitX,
        unitY,
        targetX,
        targetY
      );
      cells = getLineCells(
        unitX,
        unitY,
        direction,
        areaSize,
        grid.gridWidth,
        grid.gridHeight
      );
      // Marcar todas como IMPACT
      cells = cells.map((c) => ({ ...c, type: "IMPACT" as const }));
      break;

    case "CROSS":
      cells = getCrossCells(
        targetX,
        targetY,
        areaSize,
        grid.gridWidth,
        grid.gridHeight,
        true
      );
      cells = cells.map((c) => ({ ...c, type: "IMPACT" as const }));
      break;

    case "DIAMOND":
      cells = getDiamondCells(
        targetX,
        targetY,
        areaSize,
        grid.gridWidth,
        grid.gridHeight,
        true
      );
      cells = cells.map((c) => ({ ...c, type: "IMPACT" as const }));
      break;

    case "SQUARE":
      cells = getSquareCells(
        targetX,
        targetY,
        areaSize,
        grid.gridWidth,
        grid.gridHeight,
        true
      );
      break;

    case "RING":
      // Anel ao redor do alvo
      cells = getRingCells(
        targetX,
        targetY,
        1, // inner radius
        areaSize, // outer radius
        grid.gridWidth,
        grid.gridHeight
      );
      cells = cells.map((c) => ({ ...c, type: "IMPACT" as const }));
      break;

    case "CONE":
      // TODO: Implementar cone
      cells = [{ x: targetX, y: targetY, type: "IMPACT", distance: 0 }];
      break;
  }

  return cells;
}

/**
 * Calcula o preview completo de targeting
 */
export function calculateTargetingPreview(
  config: TargetingConfig,
  unitX: number,
  unitY: number,
  unitStats: UnitStats,
  grid: GridContext,
  hoverX?: number,
  hoverY?: number
): TargetingPreview {
  // Resolver distância do range
  const rangeDistance = config.rangeDistance
    ? resolveDynamicValue(config.rangeDistance, unitStats)
    : DEFAULT_RANGE_DISTANCE[config.range];

  // Se não há posição do mouse, retornar vazio
  if (hoverX === undefined || hoverY === undefined) {
    return {
      selectableCells: [],
      affectedCells: [],
      isValidTarget: false,
    };
  }

  // === SISTEMA DE MIRA DIRECIONAL ===
  // Em vez de mostrar todas as células selecionáveis,
  // calculamos a DIREÇÃO do mouse e mostramos apenas as células afetadas nessa direção

  // Calcular direção do mouse em relação à unidade
  const direction = getDirectionBetweenPoints(unitX, unitY, hoverX, hoverY);
  const delta = getDirectionDelta(direction);

  // Calcular células afetadas na direção do mouse
  let affectedCells: TargetingCell[] = [];

  switch (config.shape) {
    case "SINGLE":
      // Apenas células em linha reta na direção apontada
      for (let i = 1; i <= rangeDistance; i++) {
        const cellX = unitX + delta.dx * i;
        const cellY = unitY + delta.dy * i;

        if (isInBounds(cellX, cellY, grid.gridWidth, grid.gridHeight)) {
          // Verificar se há obstáculo bloqueando (se não tem piercing)
          if (!config.piercing && isCellBlocked(cellX, cellY, grid.obstacles)) {
            break; // Para antes do obstáculo
          }

          affectedCells.push({
            x: cellX,
            y: cellY,
            type: "IMPACT",
            distance: i,
          });
        }
      }
      break;

    case "LINE":
      // Linha inteira na direção
      const areaSize = config.areaSize
        ? resolveDynamicValue(config.areaSize, unitStats)
        : rangeDistance;

      for (let i = 1; i <= areaSize; i++) {
        const cellX = unitX + delta.dx * i;
        const cellY = unitY + delta.dy * i;

        if (isInBounds(cellX, cellY, grid.gridWidth, grid.gridHeight)) {
          if (!config.piercing && isCellBlocked(cellX, cellY, grid.obstacles)) {
            break;
          }
          affectedCells.push({
            x: cellX,
            y: cellY,
            type: "IMPACT",
            distance: i,
          });
        }
      }
      break;

    case "DIAMOND":
    case "SQUARE":
    case "CROSS":
      // Para shapes de área, calcular o centro na direção e expandir
      const centerDistance = Math.min(
        rangeDistance,
        Math.max(Math.abs(hoverX - unitX), Math.abs(hoverY - unitY))
      );
      const centerX = unitX + delta.dx * Math.max(1, centerDistance);
      const centerY = unitY + delta.dy * Math.max(1, centerDistance);

      const size = config.areaSize
        ? resolveDynamicValue(config.areaSize, unitStats)
        : 1;

      if (config.shape === "DIAMOND") {
        affectedCells = getDiamondCells(
          centerX,
          centerY,
          size,
          grid.gridWidth,
          grid.gridHeight,
          true
        ).map((c) => ({ ...c, type: "IMPACT" as const }));
      } else if (config.shape === "SQUARE") {
        affectedCells = getSquareCells(
          centerX,
          centerY,
          size,
          grid.gridWidth,
          grid.gridHeight,
          true
        ).map((c) => ({ ...c, type: "IMPACT" as const }));
      } else if (config.shape === "CROSS") {
        affectedCells = getCrossCells(
          centerX,
          centerY,
          size,
          grid.gridWidth,
          grid.gridHeight,
          true
        ).map((c) => ({ ...c, type: "IMPACT" as const }));
      }
      break;

    default:
      // Fallback: célula única na primeira posição da direção
      const fallbackX = unitX + delta.dx;
      const fallbackY = unitY + delta.dy;
      if (isInBounds(fallbackX, fallbackY, grid.gridWidth, grid.gridHeight)) {
        affectedCells = [
          { x: fallbackX, y: fallbackY, type: "IMPACT", distance: 1 },
        ];
      }
  }

  // Sempre válido se há células afetadas (sistema de mira direcional)
  const isValidTarget = affectedCells.length > 0;

  // Não usamos mais selectableCells - o sistema é puramente direcional
  return {
    selectableCells: [], // Vazio - não mostramos mais área selecionável
    affectedCells,
    hoverCell: affectedCells.length > 0 ? affectedCells[0] : undefined,
    isValidTarget,
    errorMessage: isValidTarget ? undefined : "Fora do alcance",
    direction, // Direção para rotação do sprite
  };
}

// =============================================================================
// SISTEMA DE PROJÉTIL - FILTRAGEM DE ALVOS POR DISTÂNCIA
// =============================================================================

/**
 * Representa uma unidade com posição para cálculo de projétil
 */
export interface ProjectileUnit {
  id: string;
  posX: number;
  posY: number;
  isAlive: boolean;
  ownerId?: string;
}

/**
 * Configuração para filtragem de projétil
 */
export interface ProjectileConfig {
  /** Se true, projétil atravessa unidades e continua até maxTargets ou fim do alcance */
  piercing?: boolean;
  /** Número máximo de alvos a serem atingidos (default: 1 se não piercing, infinito se piercing) */
  maxTargets?: number;
  /** Se true, inclui unidades aliadas como bloqueio/alvo */
  hitsAllies?: boolean;
}

/**
 * Resultado da filtragem de projétil
 */
export interface ProjectileFilterResult {
  /** Unidades que serão atingidas, ordenadas da mais próxima para a mais distante */
  targets: ProjectileUnit[];
  /** Células que o projétil percorre até parar */
  pathCells: Array<{ x: number; y: number; distance: number }>;
  /** Se o projétil foi bloqueado antes de atingir todas as células */
  blocked: boolean;
  /** ID da unidade que bloqueou o projétil (se aplicável) */
  blockedByUnitId?: string;
}

/**
 * Ordena unidades por distância do ponto de origem (mais próximo primeiro)
 * Usa distância Manhattan para consistência com o sistema de grid
 */
export function sortUnitsByDistance(
  units: ProjectileUnit[],
  originX: number,
  originY: number
): ProjectileUnit[] {
  return [...units].sort((a, b) => {
    const distA = getManhattanDistance(originX, originY, a.posX, a.posY);
    const distB = getManhattanDistance(originX, originY, b.posX, b.posY);
    return distA - distB;
  });
}

/**
 * Filtra células afetadas baseado em comportamento de projétil
 * Retorna as células que serão atingidas considerando bloqueio por unidades
 *
 * @param affectedCells - Células originalmente afetadas pela habilidade
 * @param originX - Posição X de origem do projétil (caster)
 * @param originY - Posição Y de origem do projétil (caster)
 * @param units - Todas as unidades no campo de batalha
 * @param config - Configuração do projétil
 * @param casterId - ID do caster (para excluir da filtragem)
 */
export function filterCellsByProjectile(
  affectedCells: TargetingCell[],
  originX: number,
  originY: number,
  units: ProjectileUnit[],
  config: ProjectileConfig,
  casterId?: string
): ProjectileFilterResult {
  // Se não há células, retornar vazio
  if (affectedCells.length === 0) {
    return { targets: [], pathCells: [], blocked: false };
  }

  // Ordenar células pela distância do origin
  const sortedCells = [...affectedCells].sort((a, b) => {
    const distA = getManhattanDistance(originX, originY, a.x, a.y);
    const distB = getManhattanDistance(originX, originY, b.x, b.y);
    return distA - distB;
  });

  // Filtrar unidades vivas (excluindo caster)
  const aliveUnits = units.filter((u) => u.isAlive && u.id !== casterId);

  // Resultado
  const targets: ProjectileUnit[] = [];
  const pathCells: Array<{ x: number; y: number; distance: number }> = [];
  let blocked = false;
  let blockedByUnitId: string | undefined;

  // Determinar maxTargets
  const maxTargets = config.maxTargets ?? (config.piercing ? Infinity : 1);

  // Percorrer células em ordem de distância
  for (const cell of sortedCells) {
    const distance = getManhattanDistance(originX, originY, cell.x, cell.y);

    // Verificar se há unidade nesta célula
    const unitInCell = aliveUnits.find(
      (u) => u.posX === cell.x && u.posY === cell.y
    );

    if (unitInCell) {
      // Unidade encontrada na célula
      targets.push(unitInCell);
      pathCells.push({ x: cell.x, y: cell.y, distance });

      // Verificar se atingiu o máximo de alvos
      if (targets.length >= maxTargets) {
        blocked = true;
        blockedByUnitId = unitInCell.id;
        break;
      }

      // Se não é piercing, para no primeiro alvo
      if (!config.piercing) {
        blocked = true;
        blockedByUnitId = unitInCell.id;
        break;
      }
    } else {
      // Célula vazia, adicionar ao path
      pathCells.push({ x: cell.x, y: cell.y, distance });
    }
  }

  return {
    targets,
    pathCells,
    blocked,
    blockedByUnitId,
  };
}

/**
 * Obtém unidades alvos de um projétil, ordenadas por distância
 * Função de conveniência que combina filtragem e extração de alvos
 *
 * @param casterX - Posição X do caster
 * @param casterY - Posição Y do caster
 * @param targetX - Posição X do alvo clicado
 * @param targetY - Posição Y do alvo clicado
 * @param units - Todas as unidades no campo
 * @param config - Configuração do projétil
 * @param casterId - ID do caster
 * @param maxRange - Alcance máximo do projétil
 */
export function getProjectileTargets(
  casterX: number,
  casterY: number,
  targetX: number,
  targetY: number,
  units: ProjectileUnit[],
  config: ProjectileConfig,
  casterId?: string,
  maxRange?: number
): ProjectileUnit[] {
  // Calcular direção do caster ao target
  const direction = getDirectionBetweenPoints(
    casterX,
    casterY,
    targetX,
    targetY
  );
  const range =
    maxRange ?? getManhattanDistance(casterX, casterY, targetX, targetY);

  // Gerar linha de células usando a direção calculada
  const lineCells = getLineCells(
    casterX,
    casterY,
    direction,
    range,
    100, // gridWidth (valor alto para não limitar)
    100 // gridHeight
  );

  // Aplicar filtragem de projétil
  const result = filterCellsByProjectile(
    lineCells,
    casterX,
    casterY,
    units,
    config,
    casterId
  );

  return result.targets;
}

/**
 * Converte configuração de ability para ProjectileConfig
 */
export function abilityToProjectileConfig(ability: {
  piercing?: boolean;
  maxTargets?: number;
}): ProjectileConfig {
  return {
    piercing: ability.piercing ?? false,
    maxTargets: ability.maxTargets,
    hitsAllies: false,
  };
}

// =============================================================================
// CONFIGURAÇÕES DE TARGETING PARA AÇÕES COMUNS
// =============================================================================

/**
 * Configuração de targeting para ataque básico
 * Range baseado em attackRange da unidade (modificado por condições)
 */
export function getBasicAttackTargeting(attackRange: number): TargetingConfig {
  return {
    range: attackRange <= 1 ? "MELEE" : "RANGED",
    rangeDistance: attackRange,
    targetType: "POSITION",
    shape: "SINGLE",
    includeSelf: false,
  };
}

/**
 * Configuração de targeting para DASH
 */
export function getDashTargeting(dashRange: number): TargetingConfig {
  return {
    range: "RANGED",
    rangeDistance: dashRange,
    targetType: "GROUND",
    shape: "SINGLE",
    includeSelf: false,
  };
}

/**
 * Configuração de targeting para skills de área
 */
export function getAreaTargeting(
  range: number,
  areaSize: number
): TargetingConfig {
  return {
    range: "AREA",
    rangeDistance: range,
    targetType: "POSITION",
    shape: "DIAMOND",
    areaSize,
    includeSelf: true,
  };
}

// =============================================================================
// CONVERSÃO DE ABILITY PARA TARGETING CONFIG
// =============================================================================

/**
 * Converte uma AbilityDefinition para TargetingConfig
 * Unifica skills e spells - ambos usam a mesma estrutura
 */
export function abilityToTargetingConfig(
  ability: {
    range?: AbilityRange | "ADJACENT";
    rangeDistance?: DynamicValue;
    rangeValue?: number;
    targetType?: AbilityTargetType;
    targetingShape?: TargetingShape;
    areaSize?: DynamicValue;
  },
  attackRangeMod: number = 0
): TargetingConfig {
  // Mapear range legado (ADJACENT → MELEE)
  let range: AbilityRange = "MELEE";
  if (ability.range) {
    range = ability.range === "ADJACENT" ? "MELEE" : ability.range;
  }

  // Calcular distância
  let rangeDistance: DynamicValue = DEFAULT_RANGE_DISTANCE[range];
  if (ability.rangeDistance !== undefined) {
    rangeDistance = ability.rangeDistance;
  } else if (ability.rangeValue !== undefined) {
    rangeDistance = ability.rangeValue;
  }

  // Aplicar modificador de range (de condições)
  if (typeof rangeDistance === "number") {
    rangeDistance = rangeDistance + attackRangeMod;
  }

  return {
    range,
    rangeDistance,
    targetType: ability.targetType || "UNIT",
    shape: ability.targetingShape || "SINGLE",
    areaSize: ability.areaSize,
    includeSelf: range === "SELF" || range === "AREA",
  };
}

/** @deprecated Use abilityToTargetingConfig */
export const skillToTargetingConfig = abilityToTargetingConfig;

/** @deprecated Use abilityToTargetingConfig */
export const spellToTargetingConfig = (spell: {
  range: AbilityRange | "ADJACENT";
  rangeDistance?: DynamicValue;
  targetType: AbilityTargetType;
  targetingShape?: TargetingShape;
  areaSize?: DynamicValue;
}): TargetingConfig => abilityToTargetingConfig(spell);

// =============================================================================
// PLACEHOLDER PARA QTE
// =============================================================================

/**
 * Handler para Quick Time Event após confirmar alvo
 * @param actionType Tipo de ação (ATTACK ou ABILITY - unificado)
 * @param unitId ID da unidade executando
 * @param targetX Coordenada X do alvo
 * @param targetY Coordenada Y do alvo
 * @param abilityCode Código da ability (opcional para ATTACK)
 */
export function handleQTE(
  actionType: "ATTACK" | "ABILITY",
  unitId: string,
  targetX: number,
  targetY: number,
  abilityCode?: string
): void {
  // TODO: Implementar sistema de QTE
  // Esta função será chamada quando o jogador confirmar o alvo
  // clicando na célula durante o preview de targeting
  console.log(`[QTE] ${actionType} by ${unitId} at (${targetX}, ${targetY})`, {
    abilityCode,
  });
}
