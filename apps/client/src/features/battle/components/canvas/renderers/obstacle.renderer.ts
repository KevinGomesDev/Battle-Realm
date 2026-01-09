/**
 * Renderer para obstáculos 2.5D no canvas de batalha
 * Responsável por desenhar blocos 3D com perspectiva dinâmica
 * Suporta obstáculos de tamanhos variados (SMALL=1x1, MEDIUM=2x2, LARGE=3x3, HUGE=4x4)
 */

import type { BattleObstacleState } from "@/services/colyseus.service";
import type { ObstacleType } from "@boundless/shared/types/battle.types";
import {
  getObstacleVisualConfig,
  getObstacleDimension,
} from "@boundless/shared/config";
import type { ObstacleSize } from "@boundless/shared/config";
import type { Position } from "../types";

interface DrawObstacle3DParams {
  ctx: CanvasRenderingContext2D;
  obstacle: BattleObstacleState;
  cellSize: number;
  perspectivePos: Position;
}

/**
 * Desenha uma face do bloco 3D
 */
function drawFace(
  ctx: CanvasRenderingContext2D,
  points: Position[],
  fillColor: string,
  strokeColor: string = "#000"
): void {
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/**
 * Desenha um obstáculo com efeito 2.5D baseado na posição da perspectiva
 * Suporta tamanhos variados (dimension x dimension células)
 */
export function drawObstacle3D({
  ctx,
  obstacle,
  cellSize,
  perspectivePos,
}: DrawObstacle3DParams): void {
  const config = getObstacleVisualConfig(
    (obstacle.type as ObstacleType) || "ROCK"
  );

  // Obter dimensão do obstáculo baseado no tamanho
  const dimension = getObstacleDimension(
    (obstacle.size as ObstacleSize) || "SMALL"
  );
  const obstacleSize = cellSize * dimension;

  const baseX = obstacle.posX * cellSize;
  const baseY = obstacle.posY * cellSize;

  // Centro do obstáculo (considerando tamanho)
  const centerX = baseX + obstacleSize / 2;
  const centerY = baseY + obstacleSize / 2;

  // Vetor do centro para a perspectiva (determina perspectiva)
  const vecX = centerX - perspectivePos.x;
  const vecY = centerY - perspectivePos.y;

  // Força da perspectiva baseada na altura do obstáculo (escala com tamanho)
  const perspectiveStrength = 0.15;
  const heightMultiplier = 1 + (dimension - 1) * 0.3; // Obstáculos maiores são mais altos
  const shiftX =
    vecX * perspectiveStrength * config.heightScale * heightMultiplier;
  const shiftY =
    vecY * perspectiveStrength * config.heightScale * heightMultiplier;

  // Tamanho do bloco (ligeiramente menor que o total de células para dar espaço)
  const blockSize = obstacleSize * 0.9;
  const offset = (obstacleSize - blockSize) / 2;

  // Cantos da base
  const bTL = { x: baseX + offset, y: baseY + offset };
  const bTR = { x: baseX + offset + blockSize, y: baseY + offset };
  const bBR = { x: baseX + offset + blockSize, y: baseY + offset + blockSize };
  const bBL = { x: baseX + offset, y: baseY + offset + blockSize };

  // Cantos do topo (deslocados pela perspectiva)
  const tTL = { x: bTL.x + shiftX, y: bTL.y + shiftY };
  const tTR = { x: bTR.x + shiftX, y: bTR.y + shiftY };
  const tBR = { x: bBR.x + shiftX, y: bBR.y + shiftY };
  const tBL = { x: bBL.x + shiftX, y: bBL.y + shiftY };

  // Face Y (Norte ou Sul)
  if (vecY > 0) {
    drawFace(ctx, [bTL, bTR, tTR, tTL], config.sideYColor);
  } else {
    drawFace(ctx, [bBL, bBR, tBR, tBL], config.sideYColor);
  }

  // Face X (Oeste ou Leste)
  if (vecX > 0) {
    drawFace(ctx, [bTL, bBL, tBL, tTL], config.sideXColor);
  } else {
    drawFace(ctx, [bTR, bBR, tBR, tTR], config.sideXColor);
  }

  // Topo
  ctx.fillStyle = config.topColor;
  ctx.beginPath();
  ctx.moveTo(tTL.x, tTL.y);
  ctx.lineTo(tTR.x, tTR.y);
  ctx.lineTo(tBR.x, tBR.y);
  ctx.lineTo(tBL.x, tBL.y);
  ctx.closePath();
  ctx.fill();

  // Borda do topo (highlight)
  if (config.highlightColor) {
    ctx.strokeStyle = config.highlightColor;
    ctx.lineWidth = 1 + (dimension - 1) * 0.5; // Borda mais grossa para obstáculos maiores
    ctx.stroke();
  }
}

interface DrawAllObstaclesParams {
  ctx: CanvasRenderingContext2D;
  obstacles: BattleObstacleState[];
  visibleCells: Set<string>;
  cellSize: number;
  perspectivePos: Position;
}

/**
 * Desenha todos os obstáculos visíveis ordenados por distância
 * Considera o tamanho do obstáculo para visibilidade (visível se qualquer célula for visível)
 */
export function drawAllObstacles({
  ctx,
  obstacles,
  visibleCells,
  cellSize,
  perspectivePos,
}: DrawAllObstaclesParams): void {
  // Função auxiliar para verificar se obstáculo tem alguma célula visível
  const isObstacleVisible = (obs: BattleObstacleState): boolean => {
    const dimension = getObstacleDimension(
      (obs.size as ObstacleSize) || "SMALL"
    );
    for (let dx = 0; dx < dimension; dx++) {
      for (let dy = 0; dy < dimension; dy++) {
        if (visibleCells.has(`${obs.posX + dx},${obs.posY + dy}`)) {
          return true;
        }
      }
    }
    return false;
  };

  // Ordenar obstáculos por distância à perspectiva (mais distantes primeiro)
  const sortedObstacles = [...obstacles]
    .filter((obs) => !obs.destroyed && isObstacleVisible(obs))
    .sort((a, b) => {
      // Calcular centro considerando tamanho
      const aDim = getObstacleDimension((a.size as ObstacleSize) || "SMALL");
      const bDim = getObstacleDimension((b.size as ObstacleSize) || "SMALL");
      const aCenterX = a.posX * cellSize + (aDim * cellSize) / 2;
      const aCenterY = a.posY * cellSize + (aDim * cellSize) / 2;
      const bCenterX = b.posX * cellSize + (bDim * cellSize) / 2;
      const bCenterY = b.posY * cellSize + (bDim * cellSize) / 2;
      const aDistSq =
        (aCenterX - perspectivePos.x) ** 2 + (aCenterY - perspectivePos.y) ** 2;
      const bDistSq =
        (bCenterX - perspectivePos.x) ** 2 + (bCenterY - perspectivePos.y) ** 2;
      return bDistSq - aDistSq; // Mais distante primeiro
    });

  // Renderizar obstáculos ordenados
  sortedObstacles.forEach((obstacle) => {
    drawObstacle3D({ ctx, obstacle, cellSize, perspectivePos });
  });
}

/**
 * Calcula a posição de perspectiva baseada nas unidades do jogador
 */
export function calculatePerspectivePosition(
  selectedUnitId: string | null,
  units: Array<{
    id: string;
    posX: number;
    posY: number;
    isAlive: boolean;
    ownerId: string;
  }>,
  currentUserId: string,
  cellSize: number,
  gridWidth: number,
  gridHeight: number
): Position {
  const gridCenterX = (gridWidth * cellSize) / 2;
  const gridCenterY = (gridHeight * cellSize) / 2;
  let perspectivePos = { x: gridCenterX, y: gridCenterY };

  // Primeiro, tentar usar a unidade selecionada
  const perspectiveUnit = selectedUnitId
    ? units.find((u) => u.id === selectedUnitId)
    : null;

  if (perspectiveUnit && perspectiveUnit.isAlive) {
    perspectivePos = {
      x: perspectiveUnit.posX * cellSize + cellSize / 2,
      y: perspectiveUnit.posY * cellSize + cellSize / 2,
    };
  } else {
    // Fallback: usar a unidade do jogador mais próxima do centro do grid
    const myAliveUnits = units.filter(
      (u) => u.ownerId === currentUserId && u.isAlive
    );

    if (myAliveUnits.length > 0) {
      let closestUnit = myAliveUnits[0];
      let closestDistSq = Infinity;

      for (const unit of myAliveUnits) {
        const unitCenterX = unit.posX * cellSize + cellSize / 2;
        const unitCenterY = unit.posY * cellSize + cellSize / 2;
        const distSq =
          (unitCenterX - gridCenterX) ** 2 + (unitCenterY - gridCenterY) ** 2;

        if (distSq < closestDistSq) {
          closestDistSq = distSq;
          closestUnit = unit;
        }
      }

      perspectivePos = {
        x: closestUnit.posX * cellSize + cellSize / 2,
        y: closestUnit.posY * cellSize + cellSize / 2,
      };
    }
  }

  return perspectivePos;
}
