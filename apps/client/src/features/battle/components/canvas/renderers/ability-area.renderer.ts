/**
 * Renderer para preview de área de abilities no canvas de batalha
 * Responsável por desenhar indicadores de alcance e área de efeito
 */

import type {
  BattleUnitState,
  BattleObstacleState,
} from "@/services/colyseus.service";
import type { GridColors, Position, AbilityAreaPreview } from "../types";
import {
  getUnitSizeDefinition,
  getObstacleDimension,
  type UnitSize,
  type ObstacleSize,
} from "@boundless/shared/config";

interface DrawAbilityRangeIndicatorParams {
  ctx: CanvasRenderingContext2D;
  abilityAreaPreview: AbilityAreaPreview;
  gridWidth: number;
  gridHeight: number;
  cellSize: number;
  gridColors: GridColors;
}

/**
 * Desenha indicador de range para abilities
 * Células fora do alcance são marcadas em vermelho
 */
export function drawAbilityRangeIndicator({
  ctx,
  abilityAreaPreview,
  gridWidth,
  gridHeight,
  cellSize,
  gridColors,
}: DrawAbilityRangeIndicatorParams): void {
  if (
    abilityAreaPreview.maxRange === undefined ||
    !abilityAreaPreview.casterPos ||
    abilityAreaPreview.centerOnSelf
  ) {
    return;
  }

  const casterX = abilityAreaPreview.casterPos.x;
  const casterY = abilityAreaPreview.casterPos.y;
  const maxRange = abilityAreaPreview.maxRange;

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

interface DrawAbilityAreaPreviewParams {
  ctx: CanvasRenderingContext2D;
  abilityAreaPreview: AbilityAreaPreview;
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
 * Desenha preview de área de efeito de abilities
 */
export function drawAbilityAreaPreview({
  ctx,
  abilityAreaPreview,
  centerPos,
  units,
  obstacles,
  hoveredCell,
  gridWidth,
  gridHeight,
  cellSize,
  gridColors,
}: DrawAbilityAreaPreviewParams): void {
  const radius = Math.floor(abilityAreaPreview.size / 2);
  const centerX = centerPos.x;
  const centerY = centerPos.y;

  // Verificar se a posição central está fora do alcance
  let isCenterOutOfRange = false;
  if (
    abilityAreaPreview.maxRange !== undefined &&
    abilityAreaPreview.casterPos &&
    hoveredCell
  ) {
    const casterX = abilityAreaPreview.casterPos.x;
    const casterY = abilityAreaPreview.casterPos.y;
    const distanceToHover = Math.max(
      Math.abs(hoveredCell.x - casterX),
      Math.abs(hoveredCell.y - casterY)
    );
    isCenterOutOfRange = distanceToHover > abilityAreaPreview.maxRange;
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

      // Verificar se há unidade nesta célula (considerando tamanho)
      const unitInCell = units.find((u) => {
        if (!u.isAlive) return false;
        const sizeDef = getUnitSizeDefinition(u.size as UnitSize);
        const dimension = sizeDef.dimension;
        for (let dx = 0; dx < dimension; dx++) {
          for (let dy = 0; dy < dimension; dy++) {
            if (u.posX + dx === areaX && u.posY + dy === areaY) {
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
            if (o.posX + dx === areaX && o.posY + dy === areaY) {
              return true;
            }
          }
        }
        return false;
      });
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
  abilityAreaPreview: AbilityAreaPreview | null,
  selectedUnit: BattleUnitState | undefined,
  hoveredCell: Position | null
): Position | null {
  if (!abilityAreaPreview) return null;

  // SELF: sempre centrado na unidade selecionada
  if (abilityAreaPreview.centerOnSelf) {
    return selectedUnit ? { x: selectedUnit.posX, y: selectedUnit.posY } : null;
  }

  // Sem hover, não mostra preview
  if (!hoveredCell) return null;

  // Se não tem maxRange definido, usa posição do mouse diretamente
  if (
    abilityAreaPreview.maxRange === undefined ||
    !abilityAreaPreview.casterPos
  ) {
    return hoveredCell;
  }

  // Calcular distância do caster até o hover
  const casterX = abilityAreaPreview.casterPos.x;
  const casterY = abilityAreaPreview.casterPos.y;
  const maxRange = abilityAreaPreview.maxRange;

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
