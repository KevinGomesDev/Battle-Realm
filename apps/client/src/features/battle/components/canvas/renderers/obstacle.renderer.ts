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
 * Função hash determinística para posição (igual ao grid.renderer)
 * Cria padrão "aleatório" consistente para mesma posição
 */
function hashPosition(x: number, y: number): number {
  const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return hash - Math.floor(hash);
}

/**
 * Escurece uma cor hex por uma porcentagem
 */
function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.floor((num >> 16) * (1 - percent)));
  const g = Math.max(0, Math.floor(((num >> 8) & 0x00ff) * (1 - percent)));
  const b = Math.max(0, Math.floor((num & 0x0000ff) * (1 - percent)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/**
 * Clareia uma cor hex por uma porcentagem
 */
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(
    255,
    Math.floor((num >> 16) + (255 - (num >> 16)) * percent)
  );
  const g = Math.min(
    255,
    Math.floor(((num >> 8) & 0x00ff) + (255 - ((num >> 8) & 0x00ff)) * percent)
  );
  const b = Math.min(
    255,
    Math.floor((num & 0x0000ff) + (255 - (num & 0x0000ff)) * percent)
  );
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/**
 * Desenha uma face do bloco 3D com textura sutil
 */
function drawFaceWithTexture(
  ctx: CanvasRenderingContext2D,
  points: Position[],
  baseColor: string,
  obstacleX: number,
  obstacleY: number,
  faceIndex: number
): void {
  // Desenhar face base
  ctx.fillStyle = baseColor;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fill();

  // Adicionar textura sutil (variação baseada em hash)
  const hash = hashPosition(obstacleX * 7 + faceIndex, obstacleY * 11);
  if (hash > 0.5) {
    ctx.fillStyle = lightenColor(baseColor, 0.08);
    ctx.fill();
  }

  // Borda sutil interna (mais suave que linha preta)
  ctx.strokeStyle = darkenColor(baseColor, 0.15) + "60";
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * Desenha um obstáculo com efeito 2.5D baseado na posição da perspectiva
 * Suporta tamanhos variados (dimension x dimension células)
 * Estilo integrado com o terreno do grid
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
  const blockSize = obstacleSize * 0.88;
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

  // Sombra suave no chão (integração com terreno)
  ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
  ctx.beginPath();
  ctx.moveTo(bTL.x + 2, bTL.y + 2);
  ctx.lineTo(bTR.x + 2, bTR.y + 2);
  ctx.lineTo(bBR.x + 2, bBR.y + 2);
  ctx.lineTo(bBL.x + 2, bBL.y + 2);
  ctx.closePath();
  ctx.fill();

  // Face Y (Norte ou Sul) - com textura
  if (vecY > 0) {
    drawFaceWithTexture(
      ctx,
      [bTL, bTR, tTR, tTL],
      config.sideYColor,
      obstacle.posX,
      obstacle.posY,
      0
    );
  } else {
    drawFaceWithTexture(
      ctx,
      [bBL, bBR, tBR, tBL],
      config.sideYColor,
      obstacle.posX,
      obstacle.posY,
      1
    );
  }

  // Face X (Oeste ou Leste) - com textura
  if (vecX > 0) {
    drawFaceWithTexture(
      ctx,
      [bTL, bBL, tBL, tTL],
      config.sideXColor,
      obstacle.posX,
      obstacle.posY,
      2
    );
  } else {
    drawFaceWithTexture(
      ctx,
      [bTR, bBR, tBR, tTR],
      config.sideXColor,
      obstacle.posX,
      obstacle.posY,
      3
    );
  }

  // Topo com textura e variação
  const topHash = hashPosition(obstacle.posX * 13, obstacle.posY * 17);
  let topColor = config.topColor;
  if (topHash > 0.6) {
    topColor = lightenColor(config.topColor, 0.1);
  } else if (topHash < 0.3) {
    topColor = darkenColor(config.topColor, 0.08);
  }

  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.moveTo(tTL.x, tTL.y);
  ctx.lineTo(tTR.x, tTR.y);
  ctx.lineTo(tBR.x, tBR.y);
  ctx.lineTo(tBL.x, tBL.y);
  ctx.closePath();
  ctx.fill();

  // Borda sutil do topo (highlight suave, não mais linha grossa)
  if (config.highlightColor) {
    ctx.strokeStyle = config.highlightColor + "80"; // 50% opacity
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Detalhes decorativos no topo (similar ao grid)
  const detailHash = hashPosition(obstacle.posX * 5, obstacle.posY * 9);
  if (detailHash > 0.65) {
    const detailColor = darkenColor(config.topColor, 0.12) + "50";
    ctx.fillStyle = detailColor;
    const detailX = tTL.x + (tTR.x - tTL.x) * detailHash * 0.5 + 2;
    const detailY =
      tTL.y +
      (tBL.y - tTL.y) *
        hashPosition(obstacle.posX * 3, obstacle.posY * 7) *
        0.5 +
      2;
    const detailSize = 2 + Math.floor(detailHash * 2);
    ctx.fillRect(detailX, detailY, detailSize, detailSize);
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
 * Usa posição visual interpolada para transição suave
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
  gridHeight: number,
  getVisualPosition?: (
    unitId: string,
    logicalX: number,
    logicalY: number
  ) => { x: number; y: number }
): Position {
  const gridCenterX = (gridWidth * cellSize) / 2;
  const gridCenterY = (gridHeight * cellSize) / 2;
  let perspectivePos = { x: gridCenterX, y: gridCenterY };

  // Primeiro, tentar usar a unidade selecionada
  const perspectiveUnit = selectedUnitId
    ? units.find((u) => u.id === selectedUnitId)
    : null;

  if (perspectiveUnit && perspectiveUnit.isAlive) {
    // Usar posição visual interpolada se disponível
    const visualPos = getVisualPosition
      ? getVisualPosition(
          perspectiveUnit.id,
          perspectiveUnit.posX,
          perspectiveUnit.posY
        )
      : { x: perspectiveUnit.posX, y: perspectiveUnit.posY };

    perspectivePos = {
      x: visualPos.x * cellSize + cellSize / 2,
      y: visualPos.y * cellSize + cellSize / 2,
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

      // Usar posição visual interpolada se disponível
      const visualPos = getVisualPosition
        ? getVisualPosition(closestUnit.id, closestUnit.posX, closestUnit.posY)
        : { x: closestUnit.posX, y: closestUnit.posY };

      perspectivePos = {
        x: visualPos.x * cellSize + cellSize / 2,
        y: visualPos.y * cellSize + cellSize / 2,
      };
    }
  }

  return perspectivePos;
}
