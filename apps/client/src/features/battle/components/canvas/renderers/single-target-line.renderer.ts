/**
 * Renderer para preview de linha de abilities com alvo único no canvas de batalha
 * Responsável por desenhar linha tracejada do caster até o destino
 */

import type { Position, SingleTargetLinePreview } from "../types";

interface DrawSingleTargetLineParams {
  ctx: CanvasRenderingContext2D;
  singleTargetPreview: SingleTargetLinePreview;
  hoveredCell: Position | null;
  cellSize: number;
  animationTime: number;
  gridWidth: number;
  gridHeight: number;
}

/**
 * Desenha linha de preview para abilities com alvo único
 * Mostra uma linha tracejada do caster até a posição alvo (limitada pelo maxRange)
 */
export function drawSingleTargetLine({
  ctx,
  singleTargetPreview,
  hoveredCell,
  cellSize,
  animationTime,
  gridWidth,
  gridHeight,
}: DrawSingleTargetLineParams): void {
  if (!hoveredCell) return;

  const { from, maxRange, color } = singleTargetPreview;

  // Calcular centro da célula do caster
  const startX = from.x * cellSize + cellSize / 2;
  const startY = from.y * cellSize + cellSize / 2;

  // Calcular distância até o hover
  const dx = hoveredCell.x - from.x;
  const dy = hoveredCell.y - from.y;
  const distance = Math.max(Math.abs(dx), Math.abs(dy)); // Chebyshev

  // Determinar posição final (clampada ao maxRange)
  let targetPos: Position;
  let isOutOfRange = false;

  if (distance <= maxRange) {
    targetPos = hoveredCell;
  } else {
    isOutOfRange = true;
    // Clamp para o limite do alcance
    const scale = maxRange / Math.max(Math.abs(dx), Math.abs(dy));
    targetPos = {
      x: Math.round(from.x + dx * scale),
      y: Math.round(from.y + dy * scale),
    };
  }

  // Verificar limites do grid
  targetPos.x = Math.max(0, Math.min(gridWidth - 1, targetPos.x));
  targetPos.y = Math.max(0, Math.min(gridHeight - 1, targetPos.y));

  // Calcular centro da célula alvo
  const endX = targetPos.x * cellSize + cellSize / 2;
  const endY = targetPos.y * cellSize + cellSize / 2;

  // Animação de dash offset para efeito de movimento
  const dashOffset = (animationTime / 50) % 20;

  // Configurar estilo da linha
  ctx.save();

  // Linha principal (tracejada)
  ctx.setLineDash([10, 6]);
  ctx.lineDashOffset = -dashOffset;
  ctx.lineWidth = 3;
  ctx.strokeStyle = isOutOfRange ? "rgba(239, 68, 68, 0.8)" : color;
  ctx.lineCap = "round";

  // Desenhar linha
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // Glow effect
  ctx.setLineDash([10, 6]);
  ctx.lineDashOffset = -dashOffset;
  ctx.lineWidth = 6;
  ctx.strokeStyle = isOutOfRange
    ? "rgba(239, 68, 68, 0.3)"
    : color.replace("0.8", "0.3").replace(")", ", 0.3)");
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  ctx.setLineDash([]);

  // Desenhar círculo pulsante no destino
  const pulse = Math.sin(animationTime / 150) * 0.3 + 0.7;
  const circleRadius = cellSize * 0.35 * pulse;

  // Círculo externo (glow)
  ctx.beginPath();
  ctx.arc(endX, endY, circleRadius + 4, 0, Math.PI * 2);
  ctx.fillStyle = isOutOfRange
    ? "rgba(239, 68, 68, 0.2)"
    : color.replace("0.8", "0.2").replace(")", ", 0.2)");
  ctx.fill();

  // Círculo interno
  ctx.beginPath();
  ctx.arc(endX, endY, circleRadius, 0, Math.PI * 2);
  ctx.strokeStyle = isOutOfRange ? "rgba(239, 68, 68, 0.9)" : color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Ícone de teleport no centro (cruz com círculo)
  const iconSize = cellSize * 0.15;
  ctx.strokeStyle = isOutOfRange
    ? "rgba(255, 255, 255, 0.7)"
    : "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 2;

  // Cruz
  ctx.beginPath();
  ctx.moveTo(endX - iconSize, endY);
  ctx.lineTo(endX + iconSize, endY);
  ctx.moveTo(endX, endY - iconSize);
  ctx.lineTo(endX, endY + iconSize);
  ctx.stroke();

  ctx.restore();
}
