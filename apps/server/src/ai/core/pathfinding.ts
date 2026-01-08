// server/src/ai/core/pathfinding.ts
// Pathfinding usando Pathfinding.js

import PF from "pathfinding";
import type {
  BattleObstacle,
  BattleUnit,
} from "@boundless/shared/types/battle.types";
import { getManhattanDistance } from "@boundless/shared/utils/distance.utils";

interface Position {
  x: number;
  y: number;
}

// ============================================
// FUNÇÕES UTILITÁRIAS DE DISTÂNCIA
// ============================================

/**
 * Calcula distância Manhattan entre dois pontos
 * Wrapper para manter interface Position usada pela IA
 */
export function manhattanDistance(a: Position, b: Position): number {
  return getManhattanDistance(a.x, a.y, b.x, b.y);
}

/**
 * Calcula distância Chebyshev (permite diagonais)
 */
export function chebyshevDistance(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

// ============================================
// FUNÇÕES DE VALIDAÇÃO DE GRID
// ============================================

/**
 * Verifica se uma posição está dentro do grid
 */
export function isInBounds(
  pos: Position,
  gridWidth: number,
  gridHeight: number
): boolean {
  return pos.x >= 0 && pos.x < gridWidth && pos.y >= 0 && pos.y < gridHeight;
}

/**
 * Verifica se uma célula está bloqueada
 */
export function isCellBlocked(
  pos: Position,
  units: BattleUnit[],
  obstacles: BattleObstacle[],
  ignoreUnitId?: string
): boolean {
  // Verificar obstáculos não destruídos
  const hasObstacle = obstacles.some(
    (obs) => !obs.destroyed && obs.posX === pos.x && obs.posY === pos.y
  );
  if (hasObstacle) return true;

  // Verificar unidades vivas (exceto a unidade que está se movendo)
  const hasUnit = units.some(
    (u) =>
      u.isAlive && u.posX === pos.x && u.posY === pos.y && u.id !== ignoreUnitId
  );
  if (hasUnit) return true;

  // Verificar cadáveres (unidades mortas sem CORPSE_REMOVED)
  const hasCorpse = units.some(
    (u) =>
      !u.isAlive &&
      u.posX === pos.x &&
      u.posY === pos.y &&
      !u.conditions?.includes("CORPSE_REMOVED")
  );
  return hasCorpse;
}

/**
 * Obtém vizinhos válidos de uma posição (4 direções: cima, baixo, esquerda, direita)
 */
export function getNeighbors(
  pos: Position,
  gridWidth: number,
  gridHeight: number,
  units: BattleUnit[],
  obstacles: BattleObstacle[],
  ignoreUnitId?: string
): Position[] {
  const directions = [
    { x: 0, y: -1 }, // Cima
    { x: 0, y: 1 }, // Baixo
    { x: -1, y: 0 }, // Esquerda
    { x: 1, y: 0 }, // Direita
  ];

  return directions
    .map((dir) => ({ x: pos.x + dir.x, y: pos.y + dir.y }))
    .filter(
      (newPos) =>
        isInBounds(newPos, gridWidth, gridHeight) &&
        !isCellBlocked(newPos, units, obstacles, ignoreUnitId)
    );
}

// ============================================
// PATHFINDING.JS - GRID E FINDER
// ============================================

/**
 * Cria um grid do Pathfinding.js a partir do estado atual da batalha
 */
function createPFGrid(
  gridWidth: number,
  gridHeight: number,
  units: BattleUnit[],
  obstacles: BattleObstacle[],
  ignoreUnitId?: string
): PF.Grid {
  const grid = new PF.Grid(gridWidth, gridHeight);

  // Marcar obstáculos como não walkable
  for (const obs of obstacles) {
    if (
      !obs.destroyed &&
      isInBounds({ x: obs.posX, y: obs.posY }, gridWidth, gridHeight)
    ) {
      grid.setWalkableAt(obs.posX, obs.posY, false);
    }
  }

  // Marcar unidades como não walkable
  for (const unit of units) {
    if (unit.id === ignoreUnitId) continue;
    if (!isInBounds({ x: unit.posX, y: unit.posY }, gridWidth, gridHeight))
      continue;

    // Unidades vivas bloqueiam
    if (unit.isAlive) {
      grid.setWalkableAt(unit.posX, unit.posY, false);
      continue;
    }

    // Cadáveres bloqueiam (exceto se removidos)
    if (!unit.conditions?.includes("CORPSE_REMOVED")) {
      grid.setWalkableAt(unit.posX, unit.posY, false);
    }
  }

  return grid;
}

// Finder singleton para performance (sem diagonais)
const finder = new PF.AStarFinder({
  diagonalMovement: PF.DiagonalMovement.Never,
});

// ============================================
// FUNÇÕES PRINCIPAIS DE PATHFINDING
// ============================================

/**
 * Encontra o caminho mais curto entre dois pontos usando A* (Pathfinding.js)
 * Retorna array de posições (excluindo a posição inicial)
 */
export function findPath(
  start: Position,
  goal: Position,
  gridWidth: number,
  gridHeight: number,
  units: BattleUnit[],
  obstacles: BattleObstacle[],
  ignoreUnitId?: string,
  _maxSteps: number = 50 // Mantido para compatibilidade de API
): Position[] {
  // Se já está no objetivo, retorna vazio
  if (start.x === goal.x && start.y === goal.y) {
    return [];
  }

  // Validar bounds
  if (
    !isInBounds(start, gridWidth, gridHeight) ||
    !isInBounds(goal, gridWidth, gridHeight)
  ) {
    return [];
  }

  // Criar grid e encontrar caminho
  const grid = createPFGrid(
    gridWidth,
    gridHeight,
    units,
    obstacles,
    ignoreUnitId
  );

  // Se o destino está bloqueado, tentar encontrar posição adjacente mais próxima
  if (!grid.isWalkableAt(goal.x, goal.y)) {
    const adjacentPositions = getNeighbors(
      goal,
      gridWidth,
      gridHeight,
      units,
      obstacles,
      ignoreUnitId
    );
    if (adjacentPositions.length === 0) {
      return [];
    }
    // Encontrar a posição adjacente mais próxima do start
    adjacentPositions.sort(
      (a, b) => manhattanDistance(start, a) - manhattanDistance(start, b)
    );
    goal = adjacentPositions[0];
  }

  // Pathfinding.js modifica o grid, então clonamos
  const gridClone = grid.clone();
  const rawPath = finder.findPath(start.x, start.y, goal.x, goal.y, gridClone);

  // Converter para nosso formato (excluindo posição inicial)
  if (rawPath.length <= 1) {
    return [];
  }

  return rawPath.slice(1).map(([x, y]) => ({ x, y }));
}

/**
 * Encontra a melhor posição para mover em direção a um alvo
 * Considerando movimentos disponíveis
 */
export function findBestMoveTowards(
  unit: BattleUnit,
  targetPos: Position,
  movesLeft: number,
  gridWidth: number,
  gridHeight: number,
  units: BattleUnit[],
  obstacles: BattleObstacle[]
): Position | null {
  if (movesLeft <= 0) return null;

  const path = findPath(
    { x: unit.posX, y: unit.posY },
    targetPos,
    gridWidth,
    gridHeight,
    units,
    obstacles,
    unit.id
  );

  if (path.length > 0) {
    // Retornar a posição mais longe que podemos alcançar com os movimentos disponíveis
    const reachableIndex = Math.min(movesLeft - 1, path.length - 1);
    return path[reachableIndex];
  }

  // Fallback: movimento direto na direção do alvo
  return findDirectMoveTowards(
    unit,
    targetPos,
    movesLeft,
    gridWidth,
    gridHeight,
    units,
    obstacles
  );
}

/**
 * Movimento direto na direção do alvo (fallback quando pathfinding falha)
 * Tenta mover em linha reta, priorizando eixo com maior diferença
 */
function findDirectMoveTowards(
  unit: BattleUnit,
  targetPos: Position,
  movesLeft: number,
  gridWidth: number,
  gridHeight: number,
  units: BattleUnit[],
  obstacles: BattleObstacle[]
): Position | null {
  const startPos = { x: unit.posX, y: unit.posY };
  let currentPos = { ...startPos };
  let stepsRemaining = movesLeft;

  while (stepsRemaining > 0) {
    const remainingDx = targetPos.x - currentPos.x;
    const remainingDy = targetPos.y - currentPos.y;

    // Se chegou ao alvo
    if (remainingDx === 0 && remainingDy === 0) break;

    // Determinar próximo passo (priorizar eixo com maior diferença)
    let nextPos: Position | null = null;
    const candidates: Position[] = [];

    if (Math.abs(remainingDx) >= Math.abs(remainingDy)) {
      if (remainingDx !== 0) {
        candidates.push({
          x: currentPos.x + Math.sign(remainingDx),
          y: currentPos.y,
        });
      }
      if (remainingDy !== 0) {
        candidates.push({
          x: currentPos.x,
          y: currentPos.y + Math.sign(remainingDy),
        });
      }
    } else {
      if (remainingDy !== 0) {
        candidates.push({
          x: currentPos.x,
          y: currentPos.y + Math.sign(remainingDy),
        });
      }
      if (remainingDx !== 0) {
        candidates.push({
          x: currentPos.x + Math.sign(remainingDx),
          y: currentPos.y,
        });
      }
    }

    // Encontrar primeira posição válida
    for (const candidate of candidates) {
      if (
        isInBounds(candidate, gridWidth, gridHeight) &&
        !isCellBlocked(candidate, units, obstacles, unit.id)
      ) {
        nextPos = candidate;
        break;
      }
    }

    if (!nextPos) break;

    currentPos = nextPos;
    stepsRemaining--;
  }

  if (currentPos.x !== startPos.x || currentPos.y !== startPos.y) {
    return currentPos;
  }

  return null;
}

/**
 * Encontra a melhor posição para fugir de inimigos
 */
export function findBestRetreatPosition(
  unit: BattleUnit,
  enemies: BattleUnit[],
  movesLeft: number,
  gridWidth: number,
  gridHeight: number,
  units: BattleUnit[],
  obstacles: BattleObstacle[]
): Position | null {
  if (movesLeft <= 0 || enemies.length === 0) return null;

  // Encontrar direção oposta aos inimigos mais próximos
  const enemyCenter = {
    x: enemies.reduce((sum, e) => sum + e.posX, 0) / enemies.length,
    y: enemies.reduce((sum, e) => sum + e.posY, 0) / enemies.length,
  };

  // Direção de fuga (oposta ao centro dos inimigos)
  const fleeDirection = {
    x: unit.posX - enemyCenter.x,
    y: unit.posY - enemyCenter.y,
  };

  const magnitude = Math.sqrt(
    fleeDirection.x * fleeDirection.x + fleeDirection.y * fleeDirection.y
  );
  if (magnitude === 0) return null;

  const normalizedDirection = {
    x: fleeDirection.x / magnitude,
    y: fleeDirection.y / magnitude,
  };

  const targetPos = {
    x: Math.round(
      Math.max(
        0,
        Math.min(gridWidth - 1, unit.posX + normalizedDirection.x * movesLeft)
      )
    ),
    y: Math.round(
      Math.max(
        0,
        Math.min(gridHeight - 1, unit.posY + normalizedDirection.y * movesLeft)
      )
    ),
  };

  return findBestMoveTowards(
    unit,
    targetPos,
    movesLeft,
    gridWidth,
    gridHeight,
    units,
    obstacles
  );
}

/**
 * Encontra posição para manter distância de um alvo
 */
export function findPositionAtRange(
  unit: BattleUnit,
  target: BattleUnit,
  desiredRange: number,
  movesLeft: number,
  gridWidth: number,
  gridHeight: number,
  units: BattleUnit[],
  obstacles: BattleObstacle[]
): Position | null {
  const currentDistance = manhattanDistance(
    { x: unit.posX, y: unit.posY },
    { x: target.posX, y: target.posY }
  );

  // Já está na distância ideal
  if (currentDistance === desiredRange) return null;

  // Precisa se aproximar
  if (currentDistance > desiredRange) {
    return findBestMoveTowards(
      unit,
      { x: target.posX, y: target.posY },
      movesLeft,
      gridWidth,
      gridHeight,
      units,
      obstacles
    );
  }

  // Precisa se afastar
  return findBestRetreatPosition(
    unit,
    [target],
    movesLeft,
    gridWidth,
    gridHeight,
    units,
    obstacles
  );
}
