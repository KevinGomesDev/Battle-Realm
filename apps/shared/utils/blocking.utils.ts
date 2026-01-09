// shared/utils/blocking.utils.ts
// Sistema unificado de bloqueio para visão e movimento
// FONTE DE VERDADE: Todas as verificações de bloqueio devem usar estas funções

// =============================================================================
// TIPOS
// =============================================================================

/**
 * Posição de um bloqueador (obstáculo ou unidade)
 * Usado para visão E movimento
 */
export interface BlockerPosition {
  posX: number;
  posY: number;
}

/**
 * Unidade para verificação de bloqueio
 */
export interface UnitForBlocking {
  id: string;
  posX: number;
  posY: number;
  isAlive: boolean;
  /** Tamanho da unidade para ocupar múltiplas células */
  size?: "NORMAL" | "LARGE" | "HUGE" | "GARGANTUAN";
  /** Condições da unidade (para verificar CORPSE_REMOVED) */
  conditions?: string[];
}

/**
 * Obstáculo para verificação de bloqueio
 */
export interface ObstacleForBlocking {
  posX: number;
  posY: number;
  destroyed?: boolean;
  /** Tamanho do obstáculo para ocupar múltiplas células */
  size?: "SMALL" | "MEDIUM" | "LARGE" | "HUGE";
}

/**
 * Opções para criação de lista de bloqueadores
 */
export interface BlockingOptions {
  /** IDs de unidades para excluir (ex: observador e alvo) */
  excludeUnitIds?: string[];
  /** Incluir cadáveres como bloqueadores (default: true para movimento, false para visão) */
  includeCorpses?: boolean;
}

// =============================================================================
// FUNÇÕES DE TAMANHO DE UNIDADE
// =============================================================================

/**
 * Retorna a dimensão de uma unidade baseada no tamanho
 */
export function getUnitDimension(
  size: "NORMAL" | "LARGE" | "HUGE" | "GARGANTUAN" = "NORMAL"
): number {
  switch (size) {
    case "NORMAL":
      return 1;
    case "LARGE":
      return 2;
    case "HUGE":
      return 4;
    case "GARGANTUAN":
      return 8;
    default:
      return 1;
  }
}

/**
 * Obtém todas as células ocupadas por uma unidade (considerando tamanho)
 */
export function getUnitOccupiedCells(
  unit: UnitForBlocking
): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  const dimension = getUnitDimension(unit.size);

  for (let dx = 0; dx < dimension; dx++) {
    for (let dy = 0; dy < dimension; dy++) {
      cells.push({ x: unit.posX + dx, y: unit.posY + dy });
    }
  }

  return cells;
}

// =============================================================================
// FUNÇÕES DE CONVERSÃO PARA BLOQUEADORES
// =============================================================================

/**
 * Converte unidades em lista de bloqueadores (todas as células ocupadas)
 * @param units Unidades para converter
 * @param options Opções de filtragem
 */
export function unitsToBlockers(
  units: UnitForBlocking[],
  options: BlockingOptions = {}
): BlockerPosition[] {
  const blockers: BlockerPosition[] = [];
  const excludeSet = new Set(options.excludeUnitIds ?? []);
  const includeCorpses = options.includeCorpses ?? false;

  for (const unit of units) {
    // Excluir unidades específicas
    if (excludeSet.has(unit.id)) continue;

    // Verificar se unidade está viva ou é cadáver válido
    if (unit.isAlive) {
      // Unidade viva - sempre bloqueia
      const cells = getUnitOccupiedCells(unit);
      for (const cell of cells) {
        blockers.push({ posX: cell.x, posY: cell.y });
      }
    } else if (includeCorpses) {
      // Cadáver - só bloqueia se includeCorpses=true E não foi removido
      const isCorpseRemoved = unit.conditions?.includes("CORPSE_REMOVED");
      if (!isCorpseRemoved) {
        const cells = getUnitOccupiedCells(unit);
        for (const cell of cells) {
          blockers.push({ posX: cell.x, posY: cell.y });
        }
      }
    }
  }

  return blockers;
}

/**
 * Retorna a dimensão de um obstáculo baseada no tamanho
 */
export function getObstacleDimensionForBlocking(
  size: "SMALL" | "MEDIUM" | "LARGE" | "HUGE" = "SMALL"
): number {
  switch (size) {
    case "SMALL":
      return 1;
    case "MEDIUM":
      return 2;
    case "LARGE":
      return 3;
    case "HUGE":
      return 4;
    default:
      return 1;
  }
}

/**
 * Obtém todas as células ocupadas por um obstáculo (considerando tamanho)
 */
export function getObstacleOccupiedCellsForBlocking(
  obstacle: ObstacleForBlocking
): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  const dimension = getObstacleDimensionForBlocking(obstacle.size);

  for (let dx = 0; dx < dimension; dx++) {
    for (let dy = 0; dy < dimension; dy++) {
      cells.push({ x: obstacle.posX + dx, y: obstacle.posY + dy });
    }
  }

  return cells;
}

/**
 * Converte obstáculos em lista de bloqueadores (todas as células ocupadas)
 * @param obstacles Obstáculos para converter
 */
export function obstaclesToBlockers(
  obstacles: ObstacleForBlocking[]
): BlockerPosition[] {
  const blockers: BlockerPosition[] = [];
  
  for (const obs of obstacles) {
    if (obs.destroyed) continue;
    
    const cells = getObstacleOccupiedCellsForBlocking(obs);
    for (const cell of cells) {
      blockers.push({ posX: cell.x, posY: cell.y });
    }
  }
  
  return blockers;
}

/**
 * Combina obstáculos e unidades em uma lista única de bloqueadores
 * Esta é a função principal para obter todos os bloqueadores
 *
 * @param obstacles Obstáculos do mapa
 * @param units Unidades na batalha
 * @param options Opções de filtragem
 */
export function getAllBlockers(
  obstacles: ObstacleForBlocking[],
  units: UnitForBlocking[],
  options: BlockingOptions = {}
): BlockerPosition[] {
  const obstacleBlockers = obstaclesToBlockers(obstacles);
  const unitBlockers = unitsToBlockers(units, options);
  return [...obstacleBlockers, ...unitBlockers];
}

// =============================================================================
// FUNÇÕES DE VERIFICAÇÃO DE BLOQUEIO
// =============================================================================

/**
 * Cria um Set de posições bloqueadas para lookup O(1)
 * Útil quando precisa verificar múltiplas posições
 */
export function createBlockerSet(blockers: BlockerPosition[]): Set<string> {
  const set = new Set<string>();
  for (const blocker of blockers) {
    set.add(`${blocker.posX},${blocker.posY}`);
  }
  return set;
}

/**
 * Verifica se uma posição específica está bloqueada
 * @param x Posição X
 * @param y Posição Y
 * @param blockers Lista de bloqueadores
 */
export function isPositionBlocked(
  x: number,
  y: number,
  blockers: BlockerPosition[]
): boolean {
  return blockers.some((b) => b.posX === x && b.posY === y);
}

/**
 * Verifica se uma posição está bloqueada usando um Set pré-computado
 * Mais eficiente para múltiplas verificações
 */
export function isPositionBlockedBySet(
  x: number,
  y: number,
  blockerSet: Set<string>
): boolean {
  return blockerSet.has(`${x},${y}`);
}

/**
 * Verifica se uma célula está bloqueada por obstáculo OU unidade
 * Versão conveniente que aceita arrays separados
 *
 * @param x Posição X
 * @param y Posição Y
 * @param obstacles Obstáculos do mapa
 * @param units Unidades na batalha
 * @param options Opções de filtragem
 */
export function isCellBlocked(
  x: number,
  y: number,
  obstacles: ObstacleForBlocking[],
  units: UnitForBlocking[],
  options: BlockingOptions = {}
): boolean {
  const blockers = getAllBlockers(obstacles, units, options);
  return isPositionBlocked(x, y, blockers);
}

/**
 * Verifica se uma célula está bloqueada apenas por obstáculo
 * Versão simplificada quando não precisa considerar unidades
 * Considera o tamanho do obstáculo
 */
export function isCellBlockedByObstacle(
  x: number,
  y: number,
  obstacles: ObstacleForBlocking[]
): boolean {
  for (const obs of obstacles) {
    if (obs.destroyed) continue;
    
    const cells = getObstacleOccupiedCellsForBlocking(obs);
    if (cells.some(cell => cell.x === x && cell.y === y)) {
      return true;
    }
  }
  return false;
}

// =============================================================================
// PRESETS DE OPÇÕES
// =============================================================================

/**
 * Opções para verificação de VISÃO (Line of Sight)
 * - Não inclui cadáveres (pode-se ver através deles)
 */
export function getVisionBlockingOptions(
  excludeUnitIds?: string[]
): BlockingOptions {
  return {
    excludeUnitIds,
    includeCorpses: false,
  };
}

/**
 * Opções para verificação de MOVIMENTO
 * - Inclui cadáveres (não pode andar sobre eles)
 */
export function getMovementBlockingOptions(
  excludeUnitIds?: string[]
): BlockingOptions {
  return {
    excludeUnitIds,
    includeCorpses: true,
  };
}
