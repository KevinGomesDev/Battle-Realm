/**
 * Renderer para highlights de células (movíveis, atacáveis, hover)
 * Responsável por desenhar indicadores visuais de interação no grid
 */

import type { MovementCellInfo } from "@boundless/shared/utils/engagement.utils";
import type { GridColors, Position } from "../types";

interface DrawCellHighlightsParams {
  ctx: CanvasRenderingContext2D;
  cellSize: number;
  movableCellsMap: Map<string, MovementCellInfo>;
  attackableCells: Set<string>;
  hoveredCell: Position | null;
  gridColors: GridColors;
  hasAbilityAreaPreview: boolean;
}

/**
 * Desenha highlights de células movíveis e atacáveis
 */
export function drawCellHighlights({
  ctx,
  cellSize,
  movableCellsMap,
  attackableCells,
  hoveredCell,
  gridColors,
  hasAbilityAreaPreview,
}: DrawCellHighlightsParams): void {
  // Desenhar células movíveis
  movableCellsMap.forEach((cellInfo, cellKey) => {
    const [x, y] = cellKey.split(",").map(Number);
    const cellX = x * cellSize;
    const cellY = y * cellSize;

    // Cores baseadas no tipo de célula
    if (cellInfo.hasEngagementPenalty) {
      // Laranja - movimento com custo de engajamento
      ctx.fillStyle = gridColors.cellMovableEngagement;
      ctx.fillRect(cellX, cellY, cellSize, cellSize);
      ctx.strokeStyle = gridColors.cellMovableEngagementBorder;
      ctx.lineWidth = 1;
      ctx.strokeRect(cellX, cellY, cellSize, cellSize);
    } else {
      // Verde - movimento normal
      ctx.fillStyle = gridColors.cellMovableNormal;
      ctx.fillRect(cellX, cellY, cellSize, cellSize);
      ctx.strokeStyle = gridColors.cellMovableNormalBorder;
      ctx.lineWidth = 1;
      ctx.strokeRect(cellX, cellY, cellSize, cellSize);
    }
  });

  // Desenhar células atacáveis
  attackableCells.forEach((cellKey) => {
    const [x, y] = cellKey.split(",").map(Number);
    const cellX = x * cellSize;
    const cellY = y * cellSize;
    ctx.fillStyle = gridColors.cellAttackable;
    ctx.fillRect(cellX, cellY, cellSize, cellSize);
    ctx.strokeStyle = gridColors.gridLine;
    ctx.lineWidth = 1;
    ctx.strokeRect(cellX, cellY, cellSize, cellSize);
  });

  // Hover removido - não exibe highlight ao passar o mouse
}
