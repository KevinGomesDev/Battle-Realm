/**
 * Renderer para Fog of War no canvas de batalha
 * Responsável por desenhar névoa sobre células não visíveis
 */

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
