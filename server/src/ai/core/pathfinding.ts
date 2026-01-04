// server/src/ai/core/pathfinding.ts
// Pathfinding simples para a IA (A* simplificado)

import type {
  BattleObstacle,
  BattleUnit,
} from "../../../../shared/types/battle.types";
import { getManhattanDistance } from "../../../../shared/types/skills.types";

interface Position {
  x: number;
  y: number;
}

interface PathNode extends Position {
  g: number; // Custo do início até aqui
  h: number; // Heurística (distância estimada até o objetivo)
  f: number; // g + h
  parent: PathNode | null;
}

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

/**
 * Encontra o caminho mais curto entre dois pontos usando A*
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
  maxSteps: number = 50
): Position[] {
  // Se já está no objetivo, retorna vazio
  if (start.x === goal.x && start.y === goal.y) {
    return [];
  }

  const openSet: PathNode[] = [];
  const closedSet = new Set<string>();

  const startNode: PathNode = {
    x: start.x,
    y: start.y,
    g: 0,
    h: manhattanDistance(start, goal),
    f: manhattanDistance(start, goal),
    parent: null,
  };

  openSet.push(startNode);

  while (openSet.length > 0 && closedSet.size < maxSteps) {
    // Encontrar nó com menor f
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift()!;
    const currentKey = `${current.x},${current.y}`;

    // Se chegou ao objetivo, reconstruir caminho
    if (current.x === goal.x && current.y === goal.y) {
      const path: Position[] = [];
      let node: PathNode | null = current;
      while (node && node.parent) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path;
    }

    closedSet.add(currentKey);

    // Explorar vizinhos
    const neighbors = getNeighbors(
      current,
      gridWidth,
      gridHeight,
      units,
      obstacles,
      ignoreUnitId
    );

    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x},${neighbor.y}`;
      if (closedSet.has(neighborKey)) continue;

      const g = current.g + 1;
      const h = manhattanDistance(neighbor, goal);
      const f = g + h;

      // Verificar se já existe no openSet com custo menor
      const existingIndex = openSet.findIndex(
        (n) => n.x === neighbor.x && n.y === neighbor.y
      );

      if (existingIndex !== -1) {
        if (g < openSet[existingIndex].g) {
          openSet[existingIndex].g = g;
          openSet[existingIndex].f = f;
          openSet[existingIndex].parent = current;
        }
      } else {
        openSet.push({
          x: neighbor.x,
          y: neighbor.y,
          g,
          h,
          f,
          parent: current,
        });
      }
    }
  }

  // Não encontrou caminho - retornar caminho parcial mais próximo
  return [];
}

/**
 * Encontra a melhor posição para mover em direção a um alvo
 * Considerando movimentos disponíveis
 * Se A* falhar (alvo muito longe), usa movimento direto
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

  // Tentar A* primeiro
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
  // Usado quando A* falha (alvo muito longe, sem caminho direto)
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
 * Movimento direto na direção do alvo (fallback quando A* falha)
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

  // Calcular direção
  const dx = targetPos.x - unit.posX;
  const dy = targetPos.y - unit.posY;

  // Mover passo a passo na direção do alvo
  while (stepsRemaining > 0) {
    const remainingDx = targetPos.x - currentPos.x;
    const remainingDy = targetPos.y - currentPos.y;

    // Se chegou ao alvo
    if (remainingDx === 0 && remainingDy === 0) break;

    // Determinar próximo passo (priorizar eixo com maior diferença)
    let nextPos: Position | null = null;
    const candidates: Position[] = [];

    // Priorizar baseado na distância restante
    if (Math.abs(remainingDx) >= Math.abs(remainingDy)) {
      // Tentar X primeiro, depois Y
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
      // Tentar Y primeiro, depois X
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

    // Adicionar movimentos laterais como fallback
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

    // Se não há movimento válido, parar
    if (!nextPos) break;

    currentPos = nextPos;
    stepsRemaining--;
  }

  // Retornar posição final se diferente da inicial
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

  // Normalizar e escalar
  const magnitude = Math.sqrt(
    fleeDirection.x * fleeDirection.x + fleeDirection.y * fleeDirection.y
  );
  if (magnitude === 0) return null;

  const normalizedDirection = {
    x: fleeDirection.x / magnitude,
    y: fleeDirection.y / magnitude,
  };

  // Tentar posições na direção de fuga
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
