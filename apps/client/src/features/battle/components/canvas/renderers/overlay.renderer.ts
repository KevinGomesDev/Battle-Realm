/**
 * Renderer para overlays do canvas de batalha
 * Responsável por fog of war, targeting preview e spell area preview
 */

import type {
  BattleUnitState,
  BattleObstacleState,
} from "@/services/colyseus.service";
import type { TargetingPreview } from "@boundless/shared/utils/targeting.utils";
import type {
  GridColors,
  Position,
  SpellAreaPreview,
  TeleportLinePreview,
} from "../types";

interface DrawFogOfWarParams {
  ctx: CanvasRenderingContext2D;
  visibleCells: Set<string>;
  gridWidth: number;
  gridHeight: number;
  cellSize: number;
  animationTime: number;
}

/**
 * Desenha fog of war sobre células não visíveis
 */
export function drawFogOfWar({
  ctx,
  visibleCells,
  gridWidth,
  gridHeight,
  cellSize,
  animationTime,
}: DrawFogOfWarParams): void {
  for (let x = 0; x < gridWidth; x++) {
    for (let y = 0; y < gridHeight; y++) {
      const cellKey = `${x},${y}`;
      if (!visibleCells.has(cellKey)) {
        const cellX = x * cellSize;
        const cellY = y * cellSize;

        // Névoa escura semi-transparente
        ctx.fillStyle = "rgba(10, 10, 20, 0.75)";
        ctx.fillRect(cellX, cellY, cellSize, cellSize);

        // Padrão de nuvem sutil (efeito visual)
        const cloudOffset =
          Math.sin((x + y) * 0.5 + animationTime / 2000) * 0.1;
        ctx.fillStyle = `rgba(40, 40, 60, ${0.3 + cloudOffset})`;
        ctx.beginPath();
        ctx.arc(
          cellX + cellSize / 2,
          cellY + cellSize / 2,
          cellSize * 0.4,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
  }
}

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

    // Verificar se há unidade ou obstáculo nesta célula
    const unitInCell = units.find(
      (u) => u.isAlive && u.posX === cell.x && u.posY === cell.y
    );
    const obstacleInCell = obstacles.find(
      (o) => !o.destroyed && o.posX === cell.x && o.posY === cell.y
    );
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

interface DrawSpellRangeIndicatorParams {
  ctx: CanvasRenderingContext2D;
  spellAreaPreview: SpellAreaPreview;
  gridWidth: number;
  gridHeight: number;
  cellSize: number;
  gridColors: GridColors;
}

/**
 * Desenha indicador de range para spell/skill
 * Células fora do alcance são marcadas em vermelho
 */
export function drawSpellRangeIndicator({
  ctx,
  spellAreaPreview,
  gridWidth,
  gridHeight,
  cellSize,
  gridColors,
}: DrawSpellRangeIndicatorParams): void {
  if (
    spellAreaPreview.maxRange === undefined ||
    !spellAreaPreview.casterPos ||
    spellAreaPreview.centerOnSelf
  ) {
    return;
  }

  const casterX = spellAreaPreview.casterPos.x;
  const casterY = spellAreaPreview.casterPos.y;
  const maxRange = spellAreaPreview.maxRange;

  for (let gx = 0; gx < gridWidth; gx++) {
    for (let gy = 0; gy < gridHeight; gy++) {
      // Usar Chebyshev distance (8 direções)
      const distance = Math.max(Math.abs(gx - casterX), Math.abs(gy - casterY));

      if (distance > maxRange) {
        const cellX = gx * cellSize;
        const cellY = gy * cellSize;
        ctx.fillStyle = gridColors.areaPreviewOutOfRange;
        ctx.fillRect(cellX, cellY, cellSize, cellSize);
      }
    }
  }
}

interface DrawSpellAreaPreviewParams {
  ctx: CanvasRenderingContext2D;
  spellAreaPreview: SpellAreaPreview;
  centerPos: Position;
  units: BattleUnitState[];
  obstacles: BattleObstacleState[];
  hoveredCell: Position | null;
  gridWidth: number;
  gridHeight: number;
  cellSize: number;
  gridColors: GridColors;
}

/**
 * Desenha preview de área de spell/skill
 */
export function drawSpellAreaPreview({
  ctx,
  spellAreaPreview,
  centerPos,
  units,
  obstacles,
  hoveredCell,
  gridWidth,
  gridHeight,
  cellSize,
  gridColors,
}: DrawSpellAreaPreviewParams): void {
  const radius = Math.floor(spellAreaPreview.size / 2);
  const centerX = centerPos.x;
  const centerY = centerPos.y;

  // Verificar se a posição central está fora do alcance
  let isCenterOutOfRange = false;
  if (
    spellAreaPreview.maxRange !== undefined &&
    spellAreaPreview.casterPos &&
    hoveredCell
  ) {
    const casterX = spellAreaPreview.casterPos.x;
    const casterY = spellAreaPreview.casterPos.y;
    const distanceToHover = Math.max(
      Math.abs(hoveredCell.x - casterX),
      Math.abs(hoveredCell.y - casterY)
    );
    isCenterOutOfRange = distanceToHover > spellAreaPreview.maxRange;
  }

  // Desenhar área de efeito
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const areaX = centerX + dx;
      const areaY = centerY + dy;

      // Verificar limites do grid
      if (areaX < 0 || areaX >= gridWidth || areaY < 0 || areaY >= gridHeight) {
        continue;
      }

      const cellX = areaX * cellSize;
      const cellY = areaY * cellSize;

      // Verificar se há unidade ou obstáculo nesta célula
      const unitInCell = units.find(
        (u) => u.isAlive && u.posX === areaX && u.posY === areaY
      );
      const obstacleInCell = obstacles.find(
        (o) => !o.destroyed && o.posX === areaX && o.posY === areaY
      );
      const hasTarget = unitInCell || obstacleInCell;

      // Determinar cor baseada no contexto
      if (isCenterOutOfRange) {
        ctx.fillStyle = gridColors.areaPreviewOutOfRange;
        ctx.strokeStyle = gridColors.areaPreviewOutOfRangeBorder;
        ctx.lineWidth = 1;
      } else if (hasTarget) {
        ctx.fillStyle = gridColors.areaPreviewTarget;
        ctx.strokeStyle = gridColors.areaPreviewTargetBorder;
        ctx.lineWidth = 2;
      } else {
        ctx.fillStyle = gridColors.areaPreviewEmpty;
        ctx.strokeStyle = gridColors.areaPreviewEmptyBorder;
        ctx.lineWidth = 1;
      }

      ctx.fillRect(cellX, cellY, cellSize, cellSize);
      ctx.strokeRect(cellX, cellY, cellSize, cellSize);
    }
  }

  // Desenhar centro com destaque especial
  const centerCellX = centerX * cellSize;
  const centerCellY = centerY * cellSize;
  ctx.strokeStyle = isCenterOutOfRange
    ? gridColors.areaPreviewOutOfRangeBorder
    : gridColors.areaPreviewCenter;
  ctx.lineWidth = 3;
  ctx.strokeRect(centerCellX + 2, centerCellY + 2, cellSize - 4, cellSize - 4);
}

/**
 * Calcula o centro do preview de área (clamped ao maxRange)
 */
export function calculateAreaPreviewCenter(
  spellAreaPreview: SpellAreaPreview | null,
  selectedUnit: BattleUnitState | undefined,
  hoveredCell: Position | null
): Position | null {
  if (!spellAreaPreview) return null;

  // SELF: sempre centrado na unidade selecionada
  if (spellAreaPreview.centerOnSelf) {
    return selectedUnit ? { x: selectedUnit.posX, y: selectedUnit.posY } : null;
  }

  // Sem hover, não mostra preview
  if (!hoveredCell) return null;

  // Se não tem maxRange definido, usa posição do mouse diretamente
  if (spellAreaPreview.maxRange === undefined || !spellAreaPreview.casterPos) {
    return hoveredCell;
  }

  // Calcular distância do caster até o hover
  const casterX = spellAreaPreview.casterPos.x;
  const casterY = spellAreaPreview.casterPos.y;
  const maxRange = spellAreaPreview.maxRange;

  // Distância Chebyshev (8 direções)
  const distance = Math.max(
    Math.abs(hoveredCell.x - casterX),
    Math.abs(hoveredCell.y - casterY)
  );

  // Se dentro do alcance, usa posição do mouse
  if (distance <= maxRange) {
    return hoveredCell;
  }

  // Fora do alcance: clamp para o último bloco válido na direção
  const dx = hoveredCell.x - casterX;
  const dy = hoveredCell.y - casterY;

  // Normalizar direção e escalar para maxRange
  const scale = maxRange / Math.max(Math.abs(dx), Math.abs(dy));
  const clampedX = Math.round(casterX + dx * scale);
  const clampedY = Math.round(casterY + dy * scale);

  return { x: clampedX, y: clampedY };
}

interface DrawTeleportLineParams {
  ctx: CanvasRenderingContext2D;
  teleportPreview: TeleportLinePreview;
  hoveredCell: Position | null;
  cellSize: number;
  animationTime: number;
  gridWidth: number;
  gridHeight: number;
}

/**
 * Desenha linha de preview para Teleport
 * Mostra uma linha tracejada do caster até a posição alvo (limitada pelo maxRange)
 */
export function drawTeleportLine({
  ctx,
  teleportPreview,
  hoveredCell,
  cellSize,
  animationTime,
  gridWidth,
  gridHeight,
}: DrawTeleportLineParams): void {
  if (!hoveredCell) return;

  const { from, maxRange, color } = teleportPreview;

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
