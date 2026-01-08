// shared/utils/line-of-sight.utils.ts
// Sistema de Line of Sight (LoS) para verificar visibilidade através de bloqueadores
// Usa algoritmo de Bresenham para rastrear células entre dois pontos

// =============================================================================
// TIPOS
// =============================================================================

/**
 * Posição de um bloqueador (obstáculo ou unidade)
 */
export interface BlockerPosition {
  posX: number;
  posY: number;
}

/**
 * Configuração para checagem de LoS
 */
export interface LoSConfig {
  /** Obstáculos que bloqueiam visão */
  obstacles: BlockerPosition[];
  /** Unidades que bloqueiam visão (exceto a própria unidade observadora e o alvo) */
  units: BlockerPosition[];
  /** ID da unidade observadora (para não considerar ela como bloqueador) */
  observerId?: string;
  /** ID do alvo (para não considerar ele como bloqueador) */
  targetId?: string;
}

/**
 * Unidade com posição e ID para filtragem
 */
export interface UnitForLoS {
  id: string;
  posX: number;
  posY: number;
  isAlive: boolean;
  /** Tamanho da unidade para ocupar múltiplas células */
  size?: "NORMAL" | "LARGE" | "HUGE" | "GARGANTUAN";
}

/**
 * Obstáculo para verificação de LoS
 */
export interface ObstacleForLoS {
  posX: number;
  posY: number;
  destroyed?: boolean;
}

// =============================================================================
// ALGORITMO DE BRESENHAM
// =============================================================================

/**
 * Retorna todas as células em uma linha reta entre dois pontos usando Bresenham
 * @param x0 X inicial
 * @param y0 Y inicial
 * @param x1 X final
 * @param y1 Y final
 * @returns Array de posições {x, y} na linha (excluindo o ponto inicial)
 */
export function getBresenhamLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0;
  let y = y0;

  while (x !== x1 || y !== y1) {
    const e2 = 2 * err;

    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }

    if (e2 < dx) {
      err += dx;
      y += sy;
    }

    // Adiciona a célula (exceto o ponto inicial que não é contado)
    if (x !== x0 || y !== y0) {
      cells.push({ x, y });
    }
  }

  return cells;
}

// =============================================================================
// FUNÇÕES DE VERIFICAÇÃO DE BLOQUEADORES
// =============================================================================

/**
 * Cria um Set de posições bloqueadas para lookup O(1)
 */
function createBlockerSet(blockers: BlockerPosition[]): Set<string> {
  const set = new Set<string>();
  for (const blocker of blockers) {
    set.add(`${blocker.posX},${blocker.posY}`);
  }
  return set;
}

/**
 * Obtém todas as células ocupadas por uma unidade (considerando tamanho)
 */
export function getUnitOccupiedCells(
  unit: UnitForLoS
): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  const dimension = getUnitDimension(unit.size ?? "NORMAL");

  for (let dx = 0; dx < dimension; dx++) {
    for (let dy = 0; dy < dimension; dy++) {
      cells.push({ x: unit.posX + dx, y: unit.posY + dy });
    }
  }

  return cells;
}

/**
 * Retorna a dimensão de uma unidade baseada no tamanho
 */
function getUnitDimension(
  size: "NORMAL" | "LARGE" | "HUGE" | "GARGANTUAN"
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
 * Converte unidades em lista de bloqueadores (todas as células ocupadas)
 * @param units Unidades vivas
 * @param excludeIds IDs de unidades para excluir (observador e alvo)
 */
export function unitsToBlockers(
  units: UnitForLoS[],
  excludeIds: string[] = []
): BlockerPosition[] {
  const blockers: BlockerPosition[] = [];
  const excludeSet = new Set(excludeIds);

  for (const unit of units) {
    if (!unit.isAlive) continue;
    if (excludeSet.has(unit.id)) continue;

    const cells = getUnitOccupiedCells(unit);
    for (const cell of cells) {
      blockers.push({ posX: cell.x, posY: cell.y });
    }
  }

  return blockers;
}

/**
 * Converte obstáculos em lista de bloqueadores
 * @param obstacles Obstáculos não destruídos
 */
export function obstaclesToBlockers(
  obstacles: ObstacleForLoS[]
): BlockerPosition[] {
  return obstacles
    .filter((obs) => !obs.destroyed)
    .map((obs) => ({ posX: obs.posX, posY: obs.posY }));
}

// =============================================================================
// FUNÇÃO PRINCIPAL DE LINE OF SIGHT
// =============================================================================

/**
 * Verifica se há linha de visão clara entre dois pontos
 * Usa Bresenham para traçar a linha e verifica se há bloqueadores
 *
 * @param fromX X do observador
 * @param fromY Y do observador
 * @param toX X do alvo
 * @param toY Y do alvo
 * @param blockers Lista de posições bloqueadoras
 * @returns true se há linha de visão clara (sem bloqueadores no caminho)
 */
export function hasLineOfSight(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  blockers: BlockerPosition[]
): boolean {
  // Se origem e destino são a mesma célula, há LoS
  if (fromX === toX && fromY === toY) {
    return true;
  }

  // Criar set de bloqueadores para lookup O(1)
  const blockerSet = createBlockerSet(blockers);

  // Obter todas as células na linha entre os dois pontos
  const lineCells = getBresenhamLine(fromX, fromY, toX, toY);

  // Verificar cada célula (exceto a última que é o alvo)
  // A última célula não conta como bloqueador pois é o alvo que queremos ver
  for (let i = 0; i < lineCells.length - 1; i++) {
    const cell = lineCells[i];
    if (blockerSet.has(`${cell.x},${cell.y}`)) {
      return false; // Bloqueador encontrado no caminho
    }
  }

  return true;
}

/**
 * Versão completa que aceita unidades e obstáculos separadamente
 * Mais conveniente para uso geral
 *
 * @param fromX X do observador
 * @param fromY Y do observador
 * @param toX X do alvo
 * @param toY Y do alvo
 * @param obstacles Obstáculos do mapa
 * @param units Unidades na batalha
 * @param observerId ID do observador (para excluir)
 * @param targetId ID do alvo (para excluir)
 */
export function hasLineOfSightFull(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  obstacles: ObstacleForLoS[],
  units: UnitForLoS[],
  observerId?: string,
  targetId?: string
): boolean {
  // Combinar bloqueadores
  const obstacleBlockers = obstaclesToBlockers(obstacles);
  const excludeIds = [observerId, targetId].filter(Boolean) as string[];
  const unitBlockers = unitsToBlockers(units, excludeIds);
  const allBlockers = [...obstacleBlockers, ...unitBlockers];

  return hasLineOfSight(fromX, fromY, toX, toY, allBlockers);
}

/**
 * Verifica LoS de qualquer célula ocupada por uma unidade grande até um alvo
 *
 * @param observer Unidade observadora (pode ocupar múltiplas células)
 * @param targetX X do alvo
 * @param targetY Y do alvo
 * @param blockers Lista de bloqueadores
 */
export function hasLineOfSightFromUnit(
  observer: UnitForLoS,
  targetX: number,
  targetY: number,
  blockers: BlockerPosition[]
): boolean {
  const observerCells = getUnitOccupiedCells(observer);

  // Se qualquer célula da unidade tem LoS para o alvo, retorna true
  for (const cell of observerCells) {
    if (hasLineOfSight(cell.x, cell.y, targetX, targetY, blockers)) {
      return true;
    }
  }

  return false;
}

/**
 * Versão completa de hasLineOfSightFromUnit que aceita unidades e obstáculos
 */
export function hasLineOfSightFromUnitFull(
  observer: UnitForLoS,
  targetX: number,
  targetY: number,
  obstacles: ObstacleForLoS[],
  units: UnitForLoS[],
  targetId?: string
): boolean {
  // Combinar bloqueadores (excluindo observador e alvo)
  const obstacleBlockers = obstaclesToBlockers(obstacles);
  const excludeIds = [observer.id, targetId].filter(Boolean) as string[];
  const unitBlockers = unitsToBlockers(units, excludeIds);
  const allBlockers = [...obstacleBlockers, ...unitBlockers];

  return hasLineOfSightFromUnit(observer, targetX, targetY, allBlockers);
}

/**
 * Verifica se uma célula específica está visível para um observador
 * Combina verificação de distância E linha de visão
 *
 * @param observer Unidade observadora
 * @param cellX X da célula alvo
 * @param cellY Y da célula alvo
 * @param visionRange Range de visão da unidade
 * @param obstacles Obstáculos do mapa
 * @param units Unidades na batalha
 */
export function isCellVisibleWithLoS(
  observer: UnitForLoS,
  cellX: number,
  cellY: number,
  visionRange: number,
  obstacles: ObstacleForLoS[],
  units: UnitForLoS[]
): boolean {
  const observerCells = getUnitOccupiedCells(observer);

  // Verificar cada célula ocupada pela unidade
  for (const cell of observerCells) {
    // Verificar distância de Manhattan
    const distance = Math.abs(cellX - cell.x) + Math.abs(cellY - cell.y);
    if (distance > visionRange) continue;

    // Verificar linha de visão
    const obstacleBlockers = obstaclesToBlockers(obstacles);
    const unitBlockers = unitsToBlockers(units, [observer.id]);
    const allBlockers = [...obstacleBlockers, ...unitBlockers];

    if (hasLineOfSight(cell.x, cell.y, cellX, cellY, allBlockers)) {
      return true;
    }
  }

  return false;
}
