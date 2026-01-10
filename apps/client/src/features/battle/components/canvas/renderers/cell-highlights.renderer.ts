/**
 * Renderer para highlights de células (movíveis, atacáveis, disparada, hover)
 * Responsável por desenhar indicadores visuais de interação no grid
 */

import type { MovementCellInfo } from "@boundless/shared/utils/engagement.utils";
import type { GridColors, Position } from "../types";

interface DrawCellHighlightsParams {
  ctx: CanvasRenderingContext2D;
  cellSize: number;
  movableCellsMap: Map<string, MovementCellInfo>;
  dashableCellsMap: Map<string, MovementCellInfo>;
  attackableCells: Set<string>;
  hoveredCell: Position | null;
  gridColors: GridColors;
  hasAbilityAreaPreview: boolean;
}

/**
 * Desenha highlights de células movíveis, de disparada e atacáveis
 */
export function drawCellHighlights({
  ctx,
  cellSize,
  movableCellsMap,
  dashableCellsMap,
  attackableCells,
  gridColors,
  hasAbilityAreaPreview,
}: DrawCellHighlightsParams): void {
  // Não desenhar highlights de movimento quando em modo de preview de ability
  if (hasAbilityAreaPreview) {
    return;
  }

  // Desenhar células de disparada primeiro (ficam atrás)
  dashableCellsMap.forEach((cellInfo, cellKey) => {
    const [x, y] = cellKey.split(",").map(Number);
    const cellX = x * cellSize;
    const cellY = y * cellSize;

    // Cores baseadas no tipo de célula
    if (cellInfo.hasEngagementPenalty) {
      // Ciano escuro - disparada com custo de engajamento
      ctx.fillStyle = gridColors.cellDashEngagement;
      ctx.fillRect(cellX, cellY, cellSize, cellSize);
      ctx.strokeStyle = gridColors.cellDashEngagementBorder;
      ctx.lineWidth = 1;
      ctx.strokeRect(cellX, cellY, cellSize, cellSize);
    } else {
      // Ciano claro - disparada normal
      ctx.fillStyle = gridColors.cellDashNormal;
      ctx.fillRect(cellX, cellY, cellSize, cellSize);
      ctx.strokeStyle = gridColors.cellDashNormalBorder;
      ctx.lineWidth = 1;
      ctx.strokeRect(cellX, cellY, cellSize, cellSize);
    }
  });

  // Desenhar células movíveis normais (ficam na frente das de disparada)
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
