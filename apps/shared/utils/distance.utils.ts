// shared/utils/distance.utils.ts
// FONTE DE VERDADE para funções de distância - Compartilhado entre Frontend e Backend
// Centraliza todos os cálculos de distância usados no jogo

// =============================================================================
// DISTÂNCIA MANHATTAN (4 direções: cima, baixo, esquerda, direita)
// =============================================================================

/**
 * Calcula distância Manhattan entre duas posições
 * Soma das diferenças absolutas em X e Y
 * Usada para: alcance de skills, área de efeito tipo diamante
 */
export function getManhattanDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

/**
 * Verifica se uma posição está adjacente (distância Manhattan = 1)
 * Apenas 4 direções: cima, baixo, esquerda, direita
 */
export function isAdjacent(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): boolean {
  return getManhattanDistance(x1, y1, x2, y2) === 1;
}

// =============================================================================
// DISTÂNCIA CHEBYSHEV (8 direções: inclui diagonais)
// =============================================================================

/**
 * Calcula distância Chebyshev entre duas posições
 * Máximo das diferenças absolutas em X e Y (permite diagonais)
 * Usada para: movimento, ataque corpo-a-corpo, adjacência omnidirecional
 */
export function getChebyshevDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

/**
 * Verifica se uma posição está adjacente (8 direções - Chebyshev)
 * Inclui diagonais
 */
export function isAdjacentOmnidirectional(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): boolean {
  return getChebyshevDistance(x1, y1, x2, y2) === 1;
}

/**
 * Verifica se uma posição está dentro de um alcance específico (8 direções - Chebyshev)
 */
export function isWithinRange(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  range: number
): boolean {
  return getChebyshevDistance(x1, y1, x2, y2) <= range;
}

// =============================================================================
// POSIÇÕES ADJACENTES
// =============================================================================

/**
 * Obtém todas as posições adjacentes a um ponto (4 direções - Manhattan)
 */
export function getAdjacentPositions(
  x: number,
  y: number,
  gridWidth: number,
  gridHeight: number
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  const deltas = [
    { dx: 0, dy: -1 }, // cima
    { dx: 0, dy: 1 }, // baixo
    { dx: -1, dy: 0 }, // esquerda
    { dx: 1, dy: 0 }, // direita
  ];

  for (const { dx, dy } of deltas) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
      positions.push({ x: nx, y: ny });
    }
  }

  return positions;
}

/**
 * Obtém todas as posições adjacentes incluindo diagonais (8 direções)
 */
export function getAdjacentPositionsOmnidirectional(
  x: number,
  y: number,
  gridWidth: number,
  gridHeight: number
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  const deltas = [
    { dx: 0, dy: -1 }, // cima
    { dx: 0, dy: 1 }, // baixo
    { dx: -1, dy: 0 }, // esquerda
    { dx: 1, dy: 0 }, // direita
    { dx: -1, dy: -1 }, // diagonal superior esquerda
    { dx: 1, dy: -1 }, // diagonal superior direita
    { dx: -1, dy: 1 }, // diagonal inferior esquerda
    { dx: 1, dy: 1 }, // diagonal inferior direita
  ];

  for (const { dx, dy } of deltas) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
      positions.push({ x: nx, y: ny });
    }
  }

  return positions;
}

// =============================================================================
// POSIÇÕES EM ÁREA
// =============================================================================

/**
 * Obtém todas as posições dentro de um raio (Manhattan - forma de diamante)
 */
export function getPositionsInRadius(
  centerX: number,
  centerY: number,
  radius: number,
  gridWidth: number,
  gridHeight: number,
  includeSelf: boolean = true
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const distance = Math.abs(dx) + Math.abs(dy);
      if (distance > radius) continue;
      if (!includeSelf && dx === 0 && dy === 0) continue;

      const nx = centerX + dx;
      const ny = centerY + dy;
      if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
        positions.push({ x: nx, y: ny });
      }
    }
  }

  return positions;
}

/**
 * Obtém posições válidas para RANGED (mínimo 1, máximo range)
 */
export function getPositionsInRange(
  centerX: number,
  centerY: number,
  range: number,
  gridWidth: number,
  gridHeight: number
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];

  for (let dx = -range; dx <= range; dx++) {
    for (let dy = -range; dy <= range; dy++) {
      const distance = Math.abs(dx) + Math.abs(dy);
      // RANGED: mínimo 1, máximo range
      if (distance < 1 || distance > range) continue;

      const nx = centerX + dx;
      const ny = centerY + dy;
      if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
        positions.push({ x: nx, y: ny });
      }
    }
  }

  return positions;
}

// =============================================================================
// INTERFACE PARA COMPATIBILIDADE COM AI (Position)
// =============================================================================

interface Position {
  x: number;
  y: number;
}

/**
 * Wrapper Manhattan para interface Position (usado pela AI)
 */
export function manhattanDistance(a: Position, b: Position): number {
  return getManhattanDistance(a.x, a.y, b.x, b.y);
}

/**
 * Wrapper Chebyshev para interface Position (usado pela AI)
 */
export function chebyshevDistance(a: Position, b: Position): number {
  return getChebyshevDistance(a.x, a.y, b.x, b.y);
}
