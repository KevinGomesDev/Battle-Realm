import type { BattleUnit } from "../types/battle.types";

/**
 * Interface para obstáculos usados na validação de movimento
 */
export interface ObstaclePosition {
  posX: number;
  posY: number;
  destroyed?: boolean;
}

/**
 * Resultado da validação de movimento
 */
export interface MoveValidationResult {
  valid: boolean;
  error?: string;
  baseCost: number;
  engagementCost: number;
  totalCost: number;
}

/**
 * Valida completamente um movimento de unidade.
 * Esta função centraliza toda a lógica de validação usada pelo cliente e servidor.
 *
 * @param unit A unidade que está se movendo
 * @param toX Posição X de destino
 * @param toY Posição Y de destino
 * @param allUnits Todas as unidades na batalha
 * @param obstacles Lista de obstáculos
 * @param gridWidth Largura do grid
 * @param gridHeight Altura do grid
 * @returns Resultado da validação com custo de movimento
 */
export function validateMove(
  unit: BattleUnit,
  toX: number,
  toY: number,
  allUnits: BattleUnit[],
  obstacles: ObstaclePosition[],
  gridWidth: number,
  gridHeight: number
): MoveValidationResult {
  // Verificar limites do grid
  if (toX < 0 || toX >= gridWidth || toY < 0 || toY >= gridHeight) {
    return {
      valid: false,
      error: "Destino fora do grid",
      baseCost: 0,
      engagementCost: 0,
      totalCost: 0,
    };
  }

  // Verificar se não é a mesma posição
  if (toX === unit.posX && toY === unit.posY) {
    return {
      valid: false,
      error: "Destino inválido",
      baseCost: 0,
      engagementCost: 0,
      totalCost: 0,
    };
  }

  // Calcular custos
  const baseCost = Math.abs(toX - unit.posX) + Math.abs(toY - unit.posY);
  const engagementCost = calculateEngagementCost(unit, toX, toY, allUnits);
  const totalCost = baseCost + engagementCost;

  // Verificar se a unidade tem movimento suficiente
  if (totalCost > unit.movesLeft) {
    return {
      valid: false,
      error:
        engagementCost > 0
          ? `Movimento bloqueado por engajamento inimigo (custo: ${totalCost}, disponível: ${unit.movesLeft})`
          : "Movimento excede pontos disponíveis",
      baseCost,
      engagementCost,
      totalCost,
    };
  }

  // Verificar se há caminho livre (inclui verificação de ocupação, cadáveres e obstáculos)
  const pathFree = hasFreePath(
    unit.posX,
    unit.posY,
    toX,
    toY,
    allUnits,
    obstacles,
    unit.id,
    gridWidth,
    gridHeight
  );

  if (!pathFree) {
    return {
      valid: false,
      error: "Caminho bloqueado",
      baseCost,
      engagementCost,
      totalCost,
    };
  }

  return {
    valid: true,
    baseCost,
    engagementCost,
    totalCost,
  };
}

/**
 * Verifica se duas posições são adjacentes (distância Manhattan = 1)
 */
export function isAdjacentPosition(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): boolean {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2) === 1;
}

/**
 * Calcula o custo extra de movimento para sair do engajamento com unidades inimigas.
 * Cada inimigo adjacente com speed maior adiciona a diferença ao custo.
 * Se o inimigo tiver speed igual ou menor, não adiciona custo.
 *
 * @param unit A unidade que está se movendo
 * @param toX Posição X de destino
 * @param toY Posição Y de destino
 * @param allUnits Todas as unidades na batalha
 * @returns Custo extra de movimento por engajamento
 */
export function calculateEngagementCost(
  unit: BattleUnit,
  toX: number,
  toY: number,
  allUnits: BattleUnit[]
): number {
  let extraCost = 0;

  // Encontrar inimigos adjacentes à posição atual da unidade
  const adjacentEnemies = allUnits.filter(
    (u) =>
      u.isAlive &&
      u.ownerId !== unit.ownerId && // É inimigo
      isAdjacentPosition(unit.posX, unit.posY, u.posX, u.posY) // Está adjacente
  );

  for (const enemy of adjacentEnemies) {
    // Verificar se a unidade está saindo de perto deste inimigo
    // (ou seja, o destino NÃO é adjacente a este inimigo)
    const willStillBeAdjacent = isAdjacentPosition(
      toX,
      toY,
      enemy.posX,
      enemy.posY
    );

    if (!willStillBeAdjacent) {
      // Saindo de perto deste inimigo - verificar diferença de resistance vs speed
      // Inimigo com maior resistance bloqueia unidades mais lentas
      const resistanceDiff = enemy.resistance - unit.speed;
      if (resistanceDiff > 0) {
        // Inimigo tem mais resistance que nossa speed, adiciona custo
        extraCost += resistanceDiff;
      }
    }
  }

  return extraCost;
}

/**
 * Calcula informações de movimento para uma célula considerando engajamento.
 * Retorna o custo total e se há custo extra de engajamento.
 */
export function getMovementCostInfo(
  unit: BattleUnit,
  toX: number,
  toY: number,
  allUnits: BattleUnit[]
): {
  baseCost: number;
  engagementCost: number;
  totalCost: number;
  hasEngagementPenalty: boolean;
} {
  const baseCost = Math.abs(toX - unit.posX) + Math.abs(toY - unit.posY);
  const engagementCost = calculateEngagementCost(unit, toX, toY, allUnits);

  return {
    baseCost,
    engagementCost,
    totalCost: baseCost + engagementCost,
    hasEngagementPenalty: engagementCost > 0,
  };
}

/**
 * Verifica se existe um caminho em LINHA RETA entre duas posições.
 * Movimento é feito primeiro na horizontal, depois na vertical (ou vice-versa).
 * Considera unidades vivas, cadáveres e obstáculos não destruídos como bloqueios.
 *
 * @param fromX Posição X de origem
 * @param fromY Posição Y de origem
 * @param toX Posição X de destino
 * @param toY Posição Y de destino
 * @param allUnits Todas as unidades na batalha
 * @param obstacles Lista de obstáculos
 * @param unitId ID da unidade que está se movendo (para ignorar ela mesma)
 * @param gridWidth Largura do grid (não usado, mantido para compatibilidade)
 * @param gridHeight Altura do grid (não usado, mantido para compatibilidade)
 * @returns true se caminho em linha reta está livre, false caso contrário
 */
export function hasFreePath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  allUnits: BattleUnit[],
  obstacles: ObstaclePosition[],
  unitId: string,
  _gridWidth: number,
  _gridHeight: number
): boolean {
  // Se é a mesma posição ou adjacente, sempre tem caminho
  const distance = Math.abs(toX - fromX) + Math.abs(toY - fromY);
  if (distance <= 1) return true;

  // Criar set de posições bloqueadas
  const blocked = new Set<string>();

  // Adicionar unidades vivas (exceto a própria unidade)
  allUnits.forEach((u) => {
    if (u.isAlive && u.id !== unitId) {
      blocked.add(`${u.posX},${u.posY}`);
    }
  });

  // Adicionar cadáveres
  allUnits.forEach((u) => {
    if (!u.isAlive && !u.conditions?.includes("CORPSE_REMOVED")) {
      blocked.add(`${u.posX},${u.posY}`);
    }
  });

  // Adicionar obstáculos não destruídos
  obstacles.forEach((obs) => {
    if (!obs.destroyed) {
      blocked.add(`${obs.posX},${obs.posY}`);
    }
  });

  // Verificar caminho em LINHA RETA
  // O movimento é feito célula por célula em linha reta
  // Primeiro tentamos horizontal depois vertical, e depois vertical primeiro horizontal
  // Se QUALQUER um dos caminhos estiver livre, retorna true

  // Caminho 1: Horizontal primeiro, depois Vertical
  const path1Free = checkStraightPath(
    fromX,
    fromY,
    toX,
    toY,
    blocked,
    "horizontal-first"
  );

  // Caminho 2: Vertical primeiro, depois Horizontal
  const path2Free = checkStraightPath(
    fromX,
    fromY,
    toX,
    toY,
    blocked,
    "vertical-first"
  );

  // PELO MENOS UM caminho em L deve estar livre para permitir movimento
  // A unidade pode escolher qualquer caminho que esteja disponível
  return path1Free || path2Free;
}

/**
 * Verifica se um caminho em linha reta (L-shape) está livre
 */
function checkStraightPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  blocked: Set<string>,
  order: "horizontal-first" | "vertical-first"
): boolean {
  const cells: Array<{ x: number; y: number }> = [];

  let currentX = fromX;
  let currentY = fromY;

  if (order === "horizontal-first") {
    // Primeiro move horizontal
    const stepX = toX > fromX ? 1 : toX < fromX ? -1 : 0;
    while (currentX !== toX) {
      currentX += stepX;
      cells.push({ x: currentX, y: currentY });
    }
    // Depois move vertical
    const stepY = toY > fromY ? 1 : toY < fromY ? -1 : 0;
    while (currentY !== toY) {
      currentY += stepY;
      cells.push({ x: currentX, y: currentY });
    }
  } else {
    // Primeiro move vertical
    const stepY = toY > fromY ? 1 : toY < fromY ? -1 : 0;
    while (currentY !== toY) {
      currentY += stepY;
      cells.push({ x: currentX, y: currentY });
    }
    // Depois move horizontal
    const stepX = toX > fromX ? 1 : toX < fromX ? -1 : 0;
    while (currentX !== toX) {
      currentX += stepX;
      cells.push({ x: currentX, y: currentY });
    }
  }

  // Verificar se alguma célula intermediária está bloqueada
  // A célula de destino (última) pode ter unidade inimiga (para ataque), mas não obstáculo
  for (let i = 0; i < cells.length - 1; i++) {
    const cell = cells[i];
    const key = `${cell.x},${cell.y}`;
    if (blocked.has(key)) {
      return false; // Caminho bloqueado
    }
  }

  // A última célula (destino) não pode ter obstáculo/unidade para movimento
  // Mas essa verificação já é feita em outro lugar, então aqui só verificamos intermediárias
  return true;
}

/**
 * Tipo de célula de movimento
 */
export type MovementCellType = "normal" | "engagement" | "blocked";

/**
 * Informações completas de movimento para uma célula
 */
export interface MovementCellInfo {
  /** Custo base (distância Manhattan) */
  baseCost: number;
  /** Custo extra de engajamento */
  engagementCost: number;
  /** Custo total */
  totalCost: number;
  /** Tipo de célula */
  type: MovementCellType;
  /** Se há penalidade de engajamento */
  hasEngagementPenalty: boolean;
  /** Se o caminho está bloqueado */
  isBlocked: boolean;
}

/**
 * Calcula informações completas de movimento para uma célula,
 * incluindo verificação de caminho.
 */
export function getFullMovementInfo(
  unit: BattleUnit,
  toX: number,
  toY: number,
  allUnits: BattleUnit[],
  obstacles: ObstaclePosition[],
  gridWidth: number,
  gridHeight: number
): MovementCellInfo {
  const baseCost = Math.abs(toX - unit.posX) + Math.abs(toY - unit.posY);
  const engagementCost = calculateEngagementCost(unit, toX, toY, allUnits);
  const totalCost = baseCost + engagementCost;

  // Verificar se há caminho livre
  const pathFree = hasFreePath(
    unit.posX,
    unit.posY,
    toX,
    toY,
    allUnits,
    obstacles,
    unit.id,
    gridWidth,
    gridHeight
  );

  let type: MovementCellType;
  if (!pathFree) {
    type = "blocked";
  } else if (engagementCost > 0) {
    type = "engagement";
  } else {
    type = "normal";
  }

  return {
    baseCost,
    engagementCost,
    totalCost,
    type,
    hasEngagementPenalty: engagementCost > 0,
    isBlocked: !pathFree,
  };
}
