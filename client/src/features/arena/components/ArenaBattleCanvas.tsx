import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  memo,
} from "react";
import type { ArenaUnit, ArenaBattle } from "../types/arena.types";
import type { BattleObstacle } from "../../../../../shared/types/battle.types";

interface ArenaBattleCanvasProps {
  battle: ArenaBattle;
  units: ArenaUnit[];
  currentUserId: string;
  selectedUnitId: string | null;
  onCellClick?: (x: number, y: number) => void;
  onUnitClick?: (unit: ArenaUnit) => void;
}

/**
 * ArenaBattleCanvas - Grid de batalha otimizado
 * Usa configuração recebida do servidor (battle.config)
 */

// Cores locais para elementos de UI (não do mapa)
const UI_COLORS = {
  hostHighlight: "#7ab8ff",
  guestHighlight: "#ff7a7a",
  hpFull: "#4ade80",
  hpMedium: "#fbbf24",
  hpLow: "#ef4444",
  protection: "#60a5fa",
  protectionBroken: "#6b7280",
  turnIndicator: "#ffd700",
  deadUnit: "#4a4a4a",
};

export const ArenaBattleCanvas: React.FC<ArenaBattleCanvasProps> = memo(
  ({
    battle,
    units,
    currentUserId,
    selectedUnitId,
    onCellClick,
    onUnitClick,
  }) => {
    // Extrair configuração do servidor (grid/mapa)
    const { config } = battle;
    const GRID_WIDTH = config.grid.width;
    const GRID_HEIGHT = config.grid.height;
    const GRID_COLORS = config.colors;
    const CONDITION_COLORS = config.conditionColors;
    const MAP_CONFIG = config.map;
    const OBSTACLES = MAP_CONFIG?.obstacles || [];
    const WEATHER_CSS_FILTER = MAP_CONFIG?.weatherCssFilter || "";

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const needsRedrawRef = useRef(true);

    const [hoveredCell, setHoveredCell] = useState<{
      x: number;
      y: number;
    } | null>(null);
    const [canvasSize, setCanvasSize] = useState(640);

    // Calcular tamanho da célula baseado no canvas (usando a maior dimensão)
    const cellSize = Math.min(
      canvasSize / GRID_WIDTH,
      canvasSize / GRID_HEIGHT
    );
    const canvasWidth = cellSize * GRID_WIDTH;
    const canvasHeight = cellSize * GRID_HEIGHT;

    // === MEMOIZAÇÃO DE CÁLCULOS PESADOS ===
    const selectedUnit = useMemo(
      () => units.find((u) => u.id === selectedUnitId),
      [units, selectedUnitId]
    );

    // Map de posições para lookup O(1)
    const unitPositionMap = useMemo(() => {
      const map = new Map<string, ArenaUnit>();
      units.forEach((unit) => {
        if (unit.isAlive) {
          map.set(`${unit.posX},${unit.posY}`, unit);
        }
      });
      return map;
    }, [units]);

    // Map de obstáculos para lookup O(1)
    const obstaclePositionMap = useMemo(() => {
      const map = new Map<string, BattleObstacle>();
      OBSTACLES.forEach((obs) => {
        map.set(`${obs.posX},${obs.posY}`, obs);
      });
      return map;
    }, [OBSTACLES]);

    // Células movíveis como Set para O(1) lookup
    const movableCells = useMemo((): Set<string> => {
      if (!selectedUnit || selectedUnit.movesLeft <= 0) return new Set();

      const movable = new Set<string>();
      const range = selectedUnit.movesLeft;

      for (let dx = -range; dx <= range; dx++) {
        for (let dy = -range; dy <= range; dy++) {
          if (Math.abs(dx) + Math.abs(dy) <= range && (dx !== 0 || dy !== 0)) {
            const nx = selectedUnit.posX + dx;
            const ny = selectedUnit.posY + dy;
            if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
              const key = `${nx},${ny}`;
              // Verificar se não tem unidade NEM obstáculo
              if (!unitPositionMap.has(key) && !obstaclePositionMap.has(key)) {
                movable.add(key);
              }
            }
          }
        }
      }
      return movable;
    }, [selectedUnit, unitPositionMap, obstaclePositionMap]);

    // Células atacáveis como Set
    const attackableCells = useMemo((): Set<string> => {
      if (!selectedUnit || selectedUnit.actionsLeft <= 0) return new Set();

      const attackable = new Set<string>();

      units.forEach((enemy) => {
        if (enemy.ownerId !== currentUserId && enemy.isAlive) {
          const dx = Math.abs(enemy.posX - selectedUnit.posX);
          const dy = Math.abs(enemy.posY - selectedUnit.posY);
          if (dx <= 1 && dy <= 1 && dx + dy <= 1) {
            attackable.add(`${enemy.posX},${enemy.posY}`);
          }
        }
      });

      return attackable;
    }, [selectedUnit, units, currentUserId]);

    // Função para desenhar unidade
    const drawUnit = useCallback(
      (
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        size: number,
        unit: ArenaUnit,
        isOwned: boolean
      ) => {
        const colors = isOwned
          ? {
              primary: GRID_COLORS.hostPrimary,
              secondary: GRID_COLORS.hostSecondary,
              highlight: UI_COLORS.hostHighlight,
            }
          : {
              primary: GRID_COLORS.guestPrimary,
              secondary: GRID_COLORS.guestSecondary,
              highlight: UI_COLORS.guestHighlight,
            };

        if (!unit.isAlive) {
          ctx.fillStyle = UI_COLORS.deadUnit;
          const cx = x + size / 2;
          const cy = y + size / 2;
          ctx.fillRect(cx - 6, cy - 2, 4, 4);
          ctx.fillRect(cx + 2, cy - 2, 4, 4);
          ctx.fillRect(cx - 2, cy + 2, 4, 4);
          return;
        }

        const px = Math.max(2, size / 16);
        const offsetX = x + size * 0.15;
        const offsetY = y + size * 0.1;

        // Coroa
        ctx.fillStyle = colors.highlight;
        ctx.fillRect(offsetX + size * 0.35, offsetY, px * 2, px);

        // Cabeça
        ctx.fillStyle = colors.primary;
        ctx.fillRect(offsetX + size * 0.2, offsetY + px, size * 0.5, px * 3);

        // Olhos
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(offsetX + size * 0.25, offsetY + px * 2, px, px);
        ctx.fillRect(offsetX + size * 0.45, offsetY + px * 2, px, px);

        // Corpo
        ctx.fillStyle = colors.primary;
        ctx.fillRect(
          offsetX + size * 0.15,
          offsetY + px * 4,
          size * 0.6,
          px * 3
        );

        // Detalhe armadura
        ctx.fillStyle = colors.highlight;
        ctx.fillRect(offsetX + size * 0.3, offsetY + px * 4, size * 0.2, px);

        // Pernas
        ctx.fillStyle = colors.secondary;
        ctx.fillRect(offsetX + size * 0.2, offsetY + px * 7, px * 2, px * 2);
        ctx.fillRect(offsetX + size * 0.45, offsetY + px * 7, px * 2, px * 2);

        // Espada
        ctx.fillStyle = "#c0c0c0";
        ctx.fillRect(offsetX + size * 0.7, offsetY + px * 3, px, px * 4);
        ctx.fillStyle = "#8b4513";
        ctx.fillRect(offsetX + size * 0.7, offsetY + px * 7, px, px * 2);

        // Seleção
        if (unit.id === selectedUnitId) {
          ctx.strokeStyle = UI_COLORS.turnIndicator;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
        }
      },
      [selectedUnitId, GRID_COLORS]
    );

    // Função para barras de HP/Proteção
    const drawUnitBars = useCallback(
      (
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        size: number,
        unit: ArenaUnit
      ) => {
        const barWidth = size - 8;
        const barHeight = Math.max(2, size / 16);
        const barX = x + 4;
        const barY = y + size - barHeight * 3;

        // HP
        const hpPercent = unit.currentHp / unit.maxHp;
        const hpColor =
          hpPercent > 0.6
            ? UI_COLORS.hpFull
            : hpPercent > 0.3
            ? UI_COLORS.hpMedium
            : UI_COLORS.hpLow;

        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = hpColor;
        ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

        // Proteção
        if (unit.protection > 0 || unit.protectionBroken) {
          const protY = barY - barHeight - 1;
          const maxProt = unit.armor * 2;
          const protPercent = unit.protection / maxProt;

          ctx.fillStyle = "#1a1a1a";
          ctx.fillRect(barX, protY, barWidth, barHeight - 1);
          ctx.fillStyle = unit.protectionBroken
            ? UI_COLORS.protectionBroken
            : UI_COLORS.protection;
          ctx.fillRect(barX, protY, barWidth * protPercent, barHeight - 1);
        }
      },
      []
    );

    // Função para condições
    const drawConditions = useCallback(
      (
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        conditions: string[]
      ) => {
        conditions.slice(0, 3).forEach((cond, i) => {
          ctx.fillStyle = CONDITION_COLORS[cond] || "#ffffff";
          ctx.fillRect(x + 4 + i * 6, y + 2, 4, 4);
        });
      },
      [CONDITION_COLORS]
    );

    // === FUNÇÃO DE DESENHO OTIMIZADA ===
    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.imageSmoothingEnabled = false;

      // Limpar canvas
      ctx.fillStyle = GRID_COLORS.gridBackground;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // === DESENHAR GRID ===
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const cellX = x * cellSize;
          const cellY = y * cellSize;
          const cellKey = `${x},${y}`;

          // Padrão xadrez
          const isLight = (x + y) % 2 === 0;
          let cellColor: string = isLight
            ? GRID_COLORS.cellLight
            : GRID_COLORS.cellDark;

          // Destacar células especiais
          if (attackableCells.has(cellKey)) {
            cellColor = GRID_COLORS.cellAttackable;
          } else if (movableCells.has(cellKey)) {
            cellColor = GRID_COLORS.cellMovable;
          }

          // Hover
          if (hoveredCell?.x === x && hoveredCell?.y === y) {
            cellColor = GRID_COLORS.cellHover;
          }

          // Desenhar célula
          ctx.fillStyle = cellColor;
          ctx.fillRect(cellX, cellY, cellSize, cellSize);

          // Borda
          ctx.strokeStyle = GRID_COLORS.gridLine;
          ctx.lineWidth = 1;
          ctx.strokeRect(cellX, cellY, cellSize, cellSize);

          // Ponto central decorativo
          if ((x + y) % 4 === 0) {
            ctx.fillStyle = GRID_COLORS.gridDot;
            ctx.fillRect(
              cellX + cellSize / 2 - 1,
              cellY + cellSize / 2 - 1,
              2,
              2
            );
          }
        }
      }

      // === SPAWN AREAS ===
      ctx.strokeStyle = GRID_COLORS.hostSecondary;
      ctx.lineWidth = 2;
      ctx.strokeRect(8 * cellSize, 18 * cellSize, 4 * cellSize, 2 * cellSize);

      ctx.strokeStyle = GRID_COLORS.guestSecondary;
      ctx.strokeRect(8 * cellSize, 0, 4 * cellSize, 2 * cellSize);

      // === DESENHAR OBSTÁCULOS ===
      OBSTACLES.forEach((obstacle) => {
        const cellX = obstacle.posX * cellSize;
        const cellY = obstacle.posY * cellSize;

        // Desenhar emoji do obstáculo
        const fontSize = Math.max(12, cellSize * 0.6);
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          obstacle.emoji,
          cellX + cellSize / 2,
          cellY + cellSize / 2
        );
      });

      // === DESENHAR UNIDADES ===
      units.forEach((unit) => {
        const cellX = unit.posX * cellSize;
        const cellY = unit.posY * cellSize;
        const isOwned = unit.ownerId === currentUserId;

        drawUnit(ctx, cellX, cellY, cellSize, unit, isOwned);

        if (unit.isAlive) {
          drawUnitBars(ctx, cellX, cellY, cellSize, unit);
          drawConditions(ctx, cellX, cellY, unit.conditions);
        }
      });

      // Indicador de turno - Círculo ao redor da unidade do turno atual
      const currentTurnUnit = units.find(
        (u) => u.ownerId === battle.currentPlayerId && u.isAlive
      );
      if (currentTurnUnit) {
        const cellX = currentTurnUnit.posX * cellSize;
        const cellY = currentTurnUnit.posY * cellSize;
        const isMyUnit = currentTurnUnit.ownerId === currentUserId;

        // Cor: verde para minha unidade, vermelho para inimigo
        const turnColor = isMyUnit ? "#22c55e" : "#ef4444";

        // Efeito pulsante
        const pulse = Math.sin(Date.now() / 150) * 0.3 + 0.7;

        // Desenhar círculo ao redor
        ctx.strokeStyle = turnColor;
        ctx.lineWidth = 3;
        ctx.globalAlpha = pulse;
        ctx.beginPath();
        ctx.arc(
          cellX + cellSize / 2,
          cellY + cellSize / 2,
          cellSize / 2 + 2,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Pequeno indicador de diamante acima
        const diamondY = cellY - 8 + Math.sin(Date.now() / 200) * 2;
        ctx.fillStyle = turnColor;
        ctx.beginPath();
        ctx.moveTo(cellX + cellSize / 2, diamondY);
        ctx.lineTo(cellX + cellSize / 2 + 4, diamondY + 4);
        ctx.lineTo(cellX + cellSize / 2, diamondY + 8);
        ctx.lineTo(cellX + cellSize / 2 - 4, diamondY + 4);
        ctx.closePath();
        ctx.fill();
      }
    }, [
      units,
      hoveredCell,
      battle.currentPlayerId,
      currentUserId,
      movableCells,
      attackableCells,
      canvasSize,
      cellSize,
      drawUnit,
      drawUnitBars,
      drawConditions,
      GRID_COLORS,
      GRID_WIDTH,
      GRID_HEIGHT,
      canvasWidth,
      canvasHeight,
      OBSTACLES,
    ]);

    // === MARCAR PARA REDESENHO ===
    useEffect(() => {
      needsRedrawRef.current = true;
    }, [
      units,
      hoveredCell,
      selectedUnitId,
      battle.currentPlayerId,
      movableCells,
      attackableCells,
    ]);

    // === LOOP DE ANIMAÇÃO OTIMIZADO ===
    useEffect(() => {
      let running = true;

      const animate = () => {
        if (!running) return;

        // Só redesenha se necessário OU para animação do indicador de turno
        const hasCurrentTurnUnit = units.some(
          (u) => u.ownerId === battle.currentPlayerId && u.isAlive
        );

        if (needsRedrawRef.current || hasCurrentTurnUnit) {
          draw();
          needsRedrawRef.current = false;
        }

        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animate();

      return () => {
        running = false;
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }, [draw, units, battle.currentPlayerId]);

    // === RESIZE RESPONSIVO ===
    useEffect(() => {
      const handleResize = () => {
        const container = containerRef.current;
        if (!container) return;

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // Usar o menor valor para manter proporção quadrada, sem limite máximo
        const newSize = Math.min(containerWidth, containerHeight);
        setCanvasSize(Math.max(newSize, 320));
        needsRedrawRef.current = true;
      };

      handleResize();

      const resizeObserver = new ResizeObserver(handleResize);
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      return () => resizeObserver.disconnect();
    }, []);

    // === HANDLERS DE MOUSE ===
    const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = Math.floor(
          ((e.clientX - rect.left) / rect.width) * GRID_WIDTH
        );
        const y = Math.floor(
          ((e.clientY - rect.top) / rect.height) * GRID_HEIGHT
        );

        if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
          setHoveredCell((prev) => {
            if (prev?.x === x && prev?.y === y) return prev;
            return { x, y };
          });
        } else {
          setHoveredCell(null);
        }
      },
      [GRID_WIDTH, GRID_HEIGHT]
    );

    const handleMouseLeave = useCallback(() => {
      setHoveredCell(null);
    }, []);

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = Math.floor(
          ((e.clientX - rect.left) / rect.width) * GRID_WIDTH
        );
        const y = Math.floor(
          ((e.clientY - rect.top) / rect.height) * GRID_HEIGHT
        );

        if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
          const clickedUnit = unitPositionMap.get(`${x},${y}`);
          if (clickedUnit) {
            onUnitClick?.(clickedUnit);
          } else {
            onCellClick?.(x, y);
          }
        }
      },
      [unitPositionMap, onCellClick, onUnitClick, GRID_WIDTH, GRID_HEIGHT]
    );

    return (
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center"
      >
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          style={{
            width: canvasWidth,
            height: canvasHeight,
            imageRendering: "pixelated",
            cursor: "pointer",
            filter: WEATHER_CSS_FILTER || undefined,
            transition: "filter 0.5s ease-in-out",
          }}
          className="border-4 border-metal-iron rounded-lg shadow-2xl"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        />
      </div>
    );
  }
);

ArenaBattleCanvas.displayName = "ArenaBattleCanvas";
