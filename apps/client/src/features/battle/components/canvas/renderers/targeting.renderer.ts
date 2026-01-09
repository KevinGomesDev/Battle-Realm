/**
 * Renderer para preview de targeting no canvas de batalha
 * Responsável por desenhar indicadores visuais de mira direcional
 */

import type {
  BattleUnitState,
  BattleObstacleState,
} from "@/services/colyseus.service";
import type { TargetingPreview } from "@boundless/shared/utils/targeting.utils";
import {
  getUnitSizeDefinition,
  getObstacleDimension,
  type UnitSize,
  type ObstacleSize,
} from "@boundless/shared/config";

interface DrawTargetingPreviewParams {
  ctx: CanvasRenderingContext2D;
  targetingPreview: TargetingPreview;
  units: BattleUnitState[];
  obstacles: BattleObstacleState[];
  cellSize: number;
  animationTime: number;
}

/**
 * Desenha preview de targeting direcional
 */
export function drawTargetingPreview({
  ctx,
  targetingPreview,
  units,
  obstacles,
  cellSize,
  animationTime,
}: DrawTargetingPreviewParams): void {
  if (targetingPreview.affectedCells.length === 0) return;

  targetingPreview.affectedCells.forEach((cell, index) => {
    const cellX = cell.x * cellSize;
    const cellY = cell.y * cellSize;

    // Verificar se há unidade nesta célula (considerando tamanho)
    const unitInCell = units.find((u) => {
      if (!u.isAlive) return false;
      const sizeDef = getUnitSizeDefinition(u.size as UnitSize);
      const dimension = sizeDef.dimension;
      for (let dx = 0; dx < dimension; dx++) {
        for (let dy = 0; dy < dimension; dy++) {
          if (u.posX + dx === cell.x && u.posY + dy === cell.y) {
            return true;
          }
        }
      }
      return false;
    });
    // Verificar se há obstáculo nesta célula (considerando tamanho)
    const obstacleInCell = obstacles.find((o) => {
      if (o.destroyed) return false;
      const dimension = getObstacleDimension(o.size as ObstacleSize);
      for (let dx = 0; dx < dimension; dx++) {
        for (let dy = 0; dy < dimension; dy++) {
          if (o.posX + dx === cell.x && o.posY + dy === cell.y) {
            return true;
          }
        }
      }
      return false;
    });
    const hasTarget = !!unitInCell || !!obstacleInCell;

    // Pulsação sutil para indicar mira ativa
    const pulse = Math.sin(animationTime / 150 + index * 0.5) * 0.15 + 0.85;

    if (hasTarget) {
      // Com alvo - vermelho intenso com glow
      ctx.fillStyle = `rgba(239, 68, 68, ${0.5 * pulse})`;
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.9 * pulse})`;
      ctx.lineWidth = 3;
    } else {
      // Sem alvo - vermelho mais suave
      ctx.fillStyle = `rgba(239, 68, 68, ${0.3 * pulse})`;
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.6 * pulse})`;
      ctx.lineWidth = 2;
    }

    ctx.fillRect(cellX, cellY, cellSize, cellSize);
    ctx.strokeRect(cellX, cellY, cellSize, cellSize);

    // Desenhar crosshair no centro da célula de mira
    if (index === 0) {
      const centerX = cellX + cellSize / 2;
      const centerY = cellY + cellSize / 2;
      const crossSize = cellSize * 0.25;

      ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 * pulse})`;
      ctx.lineWidth = 2;

      // Linha horizontal
      ctx.beginPath();
      ctx.moveTo(centerX - crossSize, centerY);
      ctx.lineTo(centerX + crossSize, centerY);
      ctx.stroke();

      // Linha vertical
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - crossSize);
      ctx.lineTo(centerX, centerY + crossSize);
      ctx.stroke();
    }
  });
}
