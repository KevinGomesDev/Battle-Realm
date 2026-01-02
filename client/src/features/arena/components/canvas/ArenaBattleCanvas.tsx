import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  memo,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { ArenaUnit, ArenaBattle } from "../../types/arena.types";
import type { BattleObstacle } from "../../../../../../shared/types/battle.types";
import { useSprites, updateSpriteFrame } from "./useSprites";
import { useUnitAnimations } from "./useUnitAnimations";
import { UI_COLORS, UNIT_RENDER_CONFIG } from "./canvas.constants";
import type { SpriteDirection } from "./sprite.config";
import {
  CameraController,
  type CameraControllerRef,
} from "../../../../components/CameraController";

// Re-export SpriteDirection for external use
export type { SpriteDirection };

/** Métodos expostos via ref */
export interface ArenaBattleCanvasRef {
  /** Centralizar câmera em uma unidade pelo ID */
  centerOnUnit: (unitId: string) => void;
}

interface ArenaBattleCanvasProps {
  battle: ArenaBattle;
  units: ArenaUnit[];
  currentUserId: string;
  selectedUnitId: string | null;
  onCellClick?: (x: number, y: number) => void;
  onUnitClick?: (unit: ArenaUnit) => void;
  onObstacleClick?: (obstacle: BattleObstacle) => void;
  /** Direção para virar a unidade selecionada (baseado no movimento/clique) */
  unitDirection?: { unitId: string; direction: SpriteDirection } | null;
  /** Ação pendente - quando "attack", mostra células atacáveis */
  pendingAction?: string | null;
}

/**
 * ArenaBattleCanvas - Grid de batalha otimizado
 * Usa configuração recebida do servidor (battle.config)
 */
export const ArenaBattleCanvas = memo(
  forwardRef<ArenaBattleCanvasRef, ArenaBattleCanvasProps>(
    (
      {
        battle,
        units,
        currentUserId,
        selectedUnitId,
        onCellClick,
        onUnitClick,
        onObstacleClick,
        unitDirection,
        pendingAction,
      },
      ref
    ) => {
      // Extrair configuração do servidor (grid/mapa)
      const { config } = battle;
      const GRID_WIDTH = config.grid.width;
      const GRID_HEIGHT = config.grid.height;
      const GRID_COLORS = config.colors;
      const CONDITION_COLORS = config.conditionColors;
      const MAP_CONFIG = config.map;
      const OBSTACLES = MAP_CONFIG?.obstacles || [];
      const WEATHER_CSS_FILTER = MAP_CONFIG?.weatherCssFilter || "";

      // Tamanho fixo da célula para o canvas interno (sem zoom)
      const BASE_CELL_SIZE = 40; // pixels por célula
      const canvasWidth = GRID_WIDTH * BASE_CELL_SIZE;
      const canvasHeight = GRID_HEIGHT * BASE_CELL_SIZE;
      const cellSize = BASE_CELL_SIZE;

      const canvasRef = useRef<HTMLCanvasElement>(null);
      const cameraRef = useRef<CameraControllerRef>(null);
      const animationFrameRef = useRef<number | null>(null);
      const needsRedrawRef = useRef(true);

      // Canvas offscreen para cache do grid estático
      const gridCacheRef = useRef<HTMLCanvasElement | null>(null);
      const gridCacheValidRef = useRef(false);
      // Timestamp do animation frame para animações (evita Date.now())
      const animationTimeRef = useRef(0);

      const [hoveredCell, setHoveredCell] = useState<{
        x: number;
        y: number;
      } | null>(null);

      // Hook de sprites (usa refs para evitar re-renders)
      const {
        getSprite,
        allLoaded: spritesLoaded,
        frameIndexRef,
        lastFrameChangeRef,
      } = useSprites();

      // Hook de animações de movimento
      const {
        getVisualPosition,
        startMoveAnimation,
        hasActiveAnimations,
        updateAnimations,
      } = useUnitAnimations();

      // Rastrear posições anteriores para detectar movimento
      const prevPositionsRef = useRef<Map<string, { x: number; y: number }>>(
        new Map()
      );

      // Direção de cada unidade (para virar o sprite)
      const unitDirectionsRef = useRef<Map<string, SpriteDirection>>(new Map());

      // Detectar mudanças de posição e iniciar animações
      useEffect(() => {
        units.forEach((unit) => {
          const prevPos = prevPositionsRef.current.get(unit.id);
          if (prevPos && (prevPos.x !== unit.posX || prevPos.y !== unit.posY)) {
            // Unidade moveu! Iniciar animação
            startMoveAnimation(
              unit.id,
              prevPos.x,
              prevPos.y,
              unit.posX,
              unit.posY
            );
          }
          // Atualizar posição anterior
          prevPositionsRef.current.set(unit.id, { x: unit.posX, y: unit.posY });
        });
      }, [units, startMoveAnimation]);

      // Atualizar direção da unidade quando receber nova direção
      useEffect(() => {
        if (unitDirection) {
          unitDirectionsRef.current.set(
            unitDirection.unitId,
            unitDirection.direction
          );
          needsRedrawRef.current = true;
        }
      }, [unitDirection]);

      // === MEMOIZAÇÃO DE CÁLCULOS PESADOS ===
      const selectedUnit = useMemo(
        () => units.find((u) => u.id === selectedUnitId),
        [units, selectedUnitId]
      );

      // Map de posições de unidades vivas para lookup O(1)
      const unitPositionMap = useMemo(() => {
        const map = new Map<string, ArenaUnit>();
        units.forEach((unit) => {
          if (unit.isAlive) {
            map.set(`${unit.posX},${unit.posY}`, unit);
          }
        });
        return map;
      }, [units]);

      // Map de cadáveres para lookup O(1) (unidades mortas que não foram removidas)
      const corpsePositionMap = useMemo(() => {
        const map = new Map<string, ArenaUnit>();
        units.forEach((unit) => {
          if (!unit.isAlive && !unit.conditions?.includes("CORPSE_REMOVED")) {
            map.set(`${unit.posX},${unit.posY}`, unit);
          }
        });
        return map;
      }, [units]);

      // === FOG OF WAR - Células visíveis pelo jogador atual ===
      // Calcula quais células são visíveis baseado no visionRange de cada unidade aliada
      const visibleCells = useMemo((): Set<string> => {
        const visible = new Set<string>();

        // Obter todas as unidades aliadas vivas
        const myUnits = units.filter(
          (u) => u.ownerId === currentUserId && u.isAlive
        );

        // Se não tem unidades, não mostra nada (ou mostra tudo para debug)
        if (myUnits.length === 0) {
          // Fallback: mostrar tudo se não tem unidades
          for (let x = 0; x < GRID_WIDTH; x++) {
            for (let y = 0; y < GRID_HEIGHT; y++) {
              visible.add(`${x},${y}`);
            }
          }
          return visible;
        }

        // Para cada unidade aliada, adicionar células visíveis
        myUnits.forEach((unit) => {
          // visionRange vem do servidor (max(10, focus))
          // Se não tiver, usa default de 10
          const visionRange = unit.visionRange ?? 10;
          const unitSize = unit.size ?? "NORMAL";

          // Dimensão baseada no tamanho da unidade
          const dimension =
            unitSize === "NORMAL"
              ? 1
              : unitSize === "LARGE"
              ? 2
              : unitSize === "HUGE"
              ? 4
              : 8; // GARGANTUAN

          // Para cada célula ocupada pela unidade, calcular visão
          for (let dx = 0; dx < dimension; dx++) {
            for (let dy = 0; dy < dimension; dy++) {
              const unitCellX = unit.posX + dx;
              const unitCellY = unit.posY + dy;

              // Adicionar todas as células dentro do alcance de visão
              for (let vx = -visionRange; vx <= visionRange; vx++) {
                for (let vy = -visionRange; vy <= visionRange; vy++) {
                  // Usar distância de Manhattan
                  if (Math.abs(vx) + Math.abs(vy) <= visionRange) {
                    const targetX = unitCellX + vx;
                    const targetY = unitCellY + vy;

                    // Verificar limites do grid
                    if (
                      targetX >= 0 &&
                      targetX < GRID_WIDTH &&
                      targetY >= 0 &&
                      targetY < GRID_HEIGHT
                    ) {
                      visible.add(`${targetX},${targetY}`);
                    }
                  }
                }
              }
            }
          }
        });

        return visible;
      }, [units, currentUserId, GRID_WIDTH, GRID_HEIGHT]);

      // Map de obstáculos para lookup O(1) (apenas não destruídos)
      const obstaclePositionMap = useMemo(() => {
        const map = new Map<string, BattleObstacle>();
        OBSTACLES.forEach((obs) => {
          if (!obs.destroyed) {
            map.set(`${obs.posX},${obs.posY}`, obs);
          }
        });
        return map;
      }, [OBSTACLES]);

      // Verificar se é o turno do jogador atual
      const isMyTurn = battle.currentPlayerId === currentUserId;

      // Células movíveis como Set para O(1) lookup
      // Só mostra quando é o turno do jogador
      const movableCells = useMemo((): Set<string> => {
        if (!isMyTurn) return new Set();
        if (!selectedUnit || selectedUnit.movesLeft <= 0) return new Set();

        const movable = new Set<string>();
        const range = selectedUnit.movesLeft;

        for (let dx = -range; dx <= range; dx++) {
          for (let dy = -range; dy <= range; dy++) {
            if (
              Math.abs(dx) + Math.abs(dy) <= range &&
              (dx !== 0 || dy !== 0)
            ) {
              const nx = selectedUnit.posX + dx;
              const ny = selectedUnit.posY + dy;
              if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
                const key = `${nx},${ny}`;
                // Verificar se não tem unidade viva, cadáver NEM obstáculo
                if (
                  !unitPositionMap.has(key) &&
                  !corpsePositionMap.has(key) &&
                  !obstaclePositionMap.has(key)
                ) {
                  movable.add(key);
                }
              }
            }
          }
        }
        return movable;
      }, [
        isMyTurn,
        selectedUnit,
        unitPositionMap,
        corpsePositionMap,
        obstaclePositionMap,
        GRID_WIDTH,
        GRID_HEIGHT,
      ]);

      // Células atacáveis como Set (8 direções - omnidirecional)
      // Só mostra quando pendingAction === "attack"
      const attackableCells = useMemo((): Set<string> => {
        // Só mostrar quando for meu turno
        if (!isMyTurn) return new Set();
        // Só mostrar células atacáveis quando ação de ataque estiver selecionada
        if (pendingAction !== "attack") return new Set();
        if (!selectedUnit) return new Set();
        // Pode atacar se tem ações OU ataques extras restantes
        const hasExtraAttacks = (selectedUnit.attacksLeftThisTurn ?? 0) > 0;
        if (selectedUnit.actionsLeft <= 0 && !hasExtraAttacks) return new Set();

        const attackable = new Set<string>();

        units.forEach((enemy) => {
          if (enemy.ownerId !== currentUserId && enemy.isAlive) {
            const dx = Math.abs(enemy.posX - selectedUnit.posX);
            const dy = Math.abs(enemy.posY - selectedUnit.posY);
            // Chebyshev distance: máximo de |dx| e |dy| === 1 (permite diagonais)
            if (Math.max(dx, dy) === 1) {
              attackable.add(`${enemy.posX},${enemy.posY}`);
            }
          }
        });

        // Também incluir obstáculos adjacentes como atacáveis
        OBSTACLES.forEach((obs) => {
          if (!obs.destroyed) {
            const dx = Math.abs(obs.posX - selectedUnit.posX);
            const dy = Math.abs(obs.posY - selectedUnit.posY);
            if (Math.max(dx, dy) === 1) {
              attackable.add(`${obs.posX},${obs.posY}`);
            }
          }
        });

        return attackable;
      }, [
        isMyTurn,
        selectedUnit,
        units,
        currentUserId,
        OBSTACLES,
        pendingAction,
      ]);

      // Função para desenhar unidade usando sprite
      const drawUnit = useCallback(
        (
          ctx: CanvasRenderingContext2D,
          x: number,
          y: number,
          size: number,
          unit: ArenaUnit,
          isOwned: boolean
        ) => {
          // Unidade morta - desenha X simples
          if (!unit.isAlive) {
            ctx.fillStyle = UI_COLORS.deadUnit;
            const cx = x + size / 2;
            const cy = y + size / 2;
            ctx.fillRect(cx - 6, cy - 2, 4, 4);
            ctx.fillRect(cx + 2, cy - 2, 4, 4);
            ctx.fillRect(cx - 2, cy + 2, 4, 4);
            return;
          }

          // Obter sprite baseado no avatar da unidade
          // Prioridade: avatar > classCode > fallback baseado em ownership
          const spriteType =
            unit.avatar || unit.classCode || (isOwned ? "swordman" : "mage");
          const loadedSprite = getSprite(spriteType);

          // Se o sprite está carregado, usa ele
          if (loadedSprite && spritesLoaded) {
            const { image: sprite, config } = loadedSprite;
            const { frameWidth, frameHeight, idleFrames, idleRow } = config;
            // Usa ref diretamente para evitar re-renders
            const currentFrame = frameIndexRef.current % idleFrames;

            // Calcular posição no sprite sheet
            const srcX = currentFrame * frameWidth;
            const srcY = idleRow * frameHeight;

            // Sprite maior, centralizado verticalmente
            const destSize = size * UNIT_RENDER_CONFIG.spriteScale;
            const offsetX = (size - destSize) / 2;
            const offsetY = size * UNIT_RENDER_CONFIG.verticalOffset;

            // Obter direção da unidade (default: right para aliado, left para inimigo)
            const direction =
              unitDirectionsRef.current.get(unit.id) ||
              (isOwned ? "right" : "left");
            const shouldFlip = direction === "left";

            ctx.save();

            // Aplicar flip se necessário
            if (shouldFlip) {
              ctx.translate(x + size, y);
              ctx.scale(-1, 1);
              ctx.drawImage(
                sprite,
                srcX,
                srcY,
                frameWidth,
                frameHeight,
                offsetX,
                offsetY,
                destSize,
                destSize
              );
            } else {
              ctx.drawImage(
                sprite,
                srcX,
                srcY,
                frameWidth,
                frameHeight,
                x + offsetX,
                y + offsetY,
                destSize,
                destSize
              );
            }

            ctx.restore();
          } else {
            // Fallback: desenho procedural caso sprite não carregue
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

            const px = Math.max(2, size / 16);
            const offsetX = x + size * 0.15;
            const offsetY = y + size * 0.1;

            // Coroa
            ctx.fillStyle = colors.highlight;
            ctx.fillRect(offsetX + size * 0.35, offsetY, px * 2, px);

            // Cabeça
            ctx.fillStyle = colors.primary;
            ctx.fillRect(
              offsetX + size * 0.2,
              offsetY + px,
              size * 0.5,
              px * 3
            );

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
            ctx.fillRect(
              offsetX + size * 0.3,
              offsetY + px * 4,
              size * 0.2,
              px
            );

            // Pernas
            ctx.fillStyle = colors.secondary;
            ctx.fillRect(
              offsetX + size * 0.2,
              offsetY + px * 7,
              px * 2,
              px * 2
            );
            ctx.fillRect(
              offsetX + size * 0.45,
              offsetY + px * 7,
              px * 2,
              px * 2
            );

            // Espada
            ctx.fillStyle = "#c0c0c0";
            ctx.fillRect(offsetX + size * 0.7, offsetY + px * 3, px, px * 4);
            ctx.fillStyle = "#8b4513";
            ctx.fillRect(offsetX + size * 0.7, offsetY + px * 7, px, px * 2);
          }

          // Seleção manual - quadrado vermelho com gap de 2px
          if (unit.id === selectedUnitId) {
            ctx.strokeStyle = "#ef4444"; // Vermelho
            ctx.lineWidth = 2;
            const gap = 2;
            ctx.strokeRect(x + gap, y + gap, size - gap * 2, size - gap * 2);
          }
        },
        [selectedUnitId, GRID_COLORS, spritesLoaded, getSprite, frameIndexRef]
      );

      // Função para barras de HP/Proteção (não usada atualmente, mas mantida para referência)
      // const drawUnitBars = useCallback(
      //   (
      //     ctx: CanvasRenderingContext2D,
      //     x: number,
      //     y: number,
      //     size: number,
      //     unit: ArenaUnit
      //   ) => {
      //     const barWidth = size - 8;
      //     const barHeight = Math.max(2, size / 16);
      //     const barX = x + 4;
      //     const barY = y + size - barHeight * 3;

      //     // HP
      //     const hpPercent = unit.currentHp / unit.maxHp;
      //     const hpColor =
      //       hpPercent > 0.6
      //         ? UI_COLORS.hpFull
      //         : hpPercent > 0.3
      //         ? UI_COLORS.hpMedium
      //         : UI_COLORS.hpLow;

      //     ctx.fillStyle = "#1a1a1a";
      //     ctx.fillRect(barX, barY, barWidth, barHeight);
      //     ctx.fillStyle = hpColor;
      //     ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

      //     // Proteção
      //     if (unit.protection > 0 || unit.protectionBroken) {
      //       const protY = barY - barHeight - 1;
      //       const maxProt = unit.armor * 2;
      //       const protPercent = unit.protection / maxProt;

      //       ctx.fillStyle = "#1a1a1a";
      //       ctx.fillRect(barX, protY, barWidth, barHeight - 1);
      //       ctx.fillStyle = unit.protectionBroken
      //         ? UI_COLORS.protectionBroken
      //         : UI_COLORS.protection;
      //       ctx.fillRect(barX, protY, barWidth * protPercent, barHeight - 1);
      //     }
      //   },
      //   []
      // );

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

      // === DESENHAR GRID ESTÁTICO (cache offscreen) ===
      const drawStaticGrid = useCallback(() => {
        // Criar/redimensionar canvas de cache se necessário
        if (!gridCacheRef.current) {
          gridCacheRef.current = document.createElement("canvas");
        }

        const cache = gridCacheRef.current;
        if (cache.width !== canvasWidth || cache.height !== canvasHeight) {
          cache.width = canvasWidth;
          cache.height = canvasHeight;
          gridCacheValidRef.current = false;
        }

        // Se cache já está válido, não redesenha
        if (gridCacheValidRef.current) return;

        const ctx = cache.getContext("2d");
        if (!ctx) return;

        ctx.imageSmoothingEnabled = false;

        // Fundo
        ctx.fillStyle = GRID_COLORS.gridBackground;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Desenhar grid (só células base, sem highlights)
        for (let y = 0; y < GRID_HEIGHT; y++) {
          for (let x = 0; x < GRID_WIDTH; x++) {
            const cellX = x * cellSize;
            const cellY = y * cellSize;

            // Padrão xadrez
            const isLight = (x + y) % 2 === 0;
            ctx.fillStyle = isLight
              ? GRID_COLORS.cellLight
              : GRID_COLORS.cellDark;
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

        gridCacheValidRef.current = true;
      }, [
        canvasWidth,
        canvasHeight,
        cellSize,
        GRID_COLORS,
        GRID_WIDTH,
        GRID_HEIGHT,
      ]);

      // Invalidar cache quando grid muda
      useEffect(() => {
        gridCacheValidRef.current = false;
      }, [canvasWidth, canvasHeight, GRID_COLORS]);

      // === FUNÇÃO DE DESENHO OTIMIZADA ===
      const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.imageSmoothingEnabled = false;

        // Atualizar cache do grid estático se necessário
        drawStaticGrid();

        // Desenhar cache do grid
        if (gridCacheRef.current) {
          ctx.drawImage(gridCacheRef.current, 0, 0);
        }

        // === DESENHAR HIGHLIGHTS (células especiais) ===
        // Só itera pelas células destacadas, não todo o grid
        movableCells.forEach((cellKey) => {
          const [x, y] = cellKey.split(",").map(Number);
          const cellX = x * cellSize;
          const cellY = y * cellSize;
          ctx.fillStyle = GRID_COLORS.cellMovable;
          ctx.fillRect(cellX, cellY, cellSize, cellSize);
          ctx.strokeStyle = GRID_COLORS.gridLine;
          ctx.lineWidth = 1;
          ctx.strokeRect(cellX, cellY, cellSize, cellSize);
        });

        attackableCells.forEach((cellKey) => {
          const [x, y] = cellKey.split(",").map(Number);
          const cellX = x * cellSize;
          const cellY = y * cellSize;
          ctx.fillStyle = GRID_COLORS.cellAttackable;
          ctx.fillRect(cellX, cellY, cellSize, cellSize);
          ctx.strokeStyle = GRID_COLORS.gridLine;
          ctx.lineWidth = 1;
          ctx.strokeRect(cellX, cellY, cellSize, cellSize);
        });

        // Hover
        if (hoveredCell) {
          const cellX = hoveredCell.x * cellSize;
          const cellY = hoveredCell.y * cellSize;
          ctx.fillStyle = GRID_COLORS.cellHover;
          ctx.fillRect(cellX, cellY, cellSize, cellSize);
          ctx.strokeStyle = GRID_COLORS.gridLine;
          ctx.lineWidth = 1;
          ctx.strokeRect(cellX, cellY, cellSize, cellSize);
        }

        // === DESENHAR OBSTÁCULOS (não destruídos e visíveis) ===
        OBSTACLES.forEach((obstacle) => {
          if (obstacle.destroyed) return;

          // Fog of War: só desenha se célula é visível
          const obsKey = `${obstacle.posX},${obstacle.posY}`;
          if (!visibleCells.has(obsKey)) return;

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
          // Fog of War: unidades aliadas sempre visíveis, inimigas só se em célula visível
          const isOwned = unit.ownerId === currentUserId;
          const unitKey = `${unit.posX},${unit.posY}`;

          // Inimigos só aparecem se estiverem em célula visível
          if (!isOwned && !visibleCells.has(unitKey)) return;

          // Usar posição visual interpolada (para animação suave)
          const visualPos = getVisualPosition(unit.id, unit.posX, unit.posY);
          const cellX = visualPos.x * cellSize;
          const cellY = visualPos.y * cellSize;

          drawUnit(ctx, cellX, cellY, cellSize, unit, isOwned);

          if (unit.isAlive) {
            drawConditions(ctx, cellX, cellY, unit.conditions);
          }
        });

        // === FOG OF WAR - Desenhar névoa sobre células não visíveis ===
        // Desenha uma camada semi-transparente escura sobre células fora da visão
        for (let x = 0; x < GRID_WIDTH; x++) {
          for (let y = 0; y < GRID_HEIGHT; y++) {
            const cellKey = `${x},${y}`;
            if (!visibleCells.has(cellKey)) {
              const cellX = x * cellSize;
              const cellY = y * cellSize;

              // Névoa escura semi-transparente
              ctx.fillStyle = "rgba(10, 10, 20, 0.75)";
              ctx.fillRect(cellX, cellY, cellSize, cellSize);

              // Padrão de nuvem sutil (efeito visual)
              const animTime = animationTimeRef.current;
              const cloudOffset =
                Math.sin((x + y) * 0.5 + animTime / 2000) * 0.1;
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

        // Indicador de turno - Quadrado ao redor da unidade do turno atual (sem gap)
        // APENAS visível para o jogador que está no turno (não mostra turno do adversário)
        const currentTurnUnit = units.find(
          (u) => u.ownerId === battle.currentPlayerId && u.isAlive
        );
        const isMyTurn = battle.currentPlayerId === currentUserId;

        if (currentTurnUnit && isMyTurn) {
          // Usar posição visual interpolada para o indicador também
          const turnVisualPos = getVisualPosition(
            currentTurnUnit.id,
            currentTurnUnit.posX,
            currentTurnUnit.posY
          );
          const cellX = turnVisualPos.x * cellSize;
          const cellY = turnVisualPos.y * cellSize;

          // Cor: emerald (sempre minha unidade, já que só mostra no meu turno)
          const turnColor = "#10b981";

          // Efeito pulsante usando timestamp do animation frame (não Date.now())
          const animTime = animationTimeRef.current;
          const pulse = Math.sin(animTime / 150) * 0.3 + 0.7;

          // Desenhar quadrado ao redor (sem gap - borda externa)
          ctx.strokeStyle = turnColor;
          ctx.lineWidth = 3;
          ctx.globalAlpha = pulse;
          ctx.strokeRect(cellX, cellY, cellSize, cellSize);
          ctx.globalAlpha = 1;

          // Pequeno indicador de diamante acima
          const diamondY = cellY - 8 + Math.sin(animTime / 200) * 2;
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
        visibleCells,
        cellSize,
        GRID_WIDTH,
        GRID_HEIGHT,
        drawUnit,
        drawConditions,
        GRID_COLORS,
        OBSTACLES,
        getVisualPosition,
        drawStaticGrid,
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
        visibleCells,
        spritesLoaded,
        // frameIndex removido - agora controlado pelo loop de animação
      ]);

      // === LOOP DE ANIMAÇÃO OTIMIZADO ===
      useEffect(() => {
        let running = true;
        // Controle de FPS para o grid estático (não os sprites)
        let lastGridDrawTime = 0;
        const GRID_MIN_INTERVAL = 16; // ~60 FPS máximo para o grid
        // Intervalo para atualização do indicador pulsante (mais lento)
        const PULSE_INTERVAL = 50; // ~20 FPS para animação pulsante
        let lastPulseUpdate = 0;

        const animate = (currentTime: number) => {
          if (!running) return;

          // Atualizar timestamp de animação para uso no draw()
          animationTimeRef.current = currentTime;

          // Atualizar animações de movimento
          const hasMovementAnimations = updateAnimations();

          // Atualizar frame dos sprites (retorna true se mudou)
          const spriteFrameChanged = updateSpriteFrame(
            frameIndexRef,
            lastFrameChangeRef,
            currentTime
          );

          // Verificar se indicador pulsante precisa atualizar (throttled)
          const needsPulseUpdate =
            currentTime - lastPulseUpdate >= PULSE_INTERVAL;
          const hasCurrentTurnUnit = units.some(
            (u) => u.ownerId === battle.currentPlayerId && u.isAlive
          );

          // Redesenha se:
          // 1. Necessário (mudança de estado)
          // 2. Animações de movimento ativas
          // 3. Frame de sprite mudou (animação idle)
          // 4. Indicador pulsante precisa atualizar (throttled separadamente)
          const shouldRedraw =
            needsRedrawRef.current ||
            hasMovementAnimations ||
            hasActiveAnimations() ||
            spriteFrameChanged ||
            (hasCurrentTurnUnit && needsPulseUpdate);

          // Throttle: só redesenha se passou tempo suficiente
          if (
            shouldRedraw &&
            currentTime - lastGridDrawTime >= GRID_MIN_INTERVAL
          ) {
            draw();
            needsRedrawRef.current = false;
            lastGridDrawTime = currentTime;
            if (needsPulseUpdate) {
              lastPulseUpdate = currentTime;
            }
          }

          animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
          running = false;
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
        };
      }, [
        draw,
        units,
        battle.currentPlayerId,
        frameIndexRef,
        lastFrameChangeRef,
        updateAnimations,
        hasActiveAnimations,
      ]);

      // === HANDLERS DE MOUSE ===
      const handleMouseMove = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
          const canvas = canvasRef.current;
          if (!canvas) return;

          const rect = canvas.getBoundingClientRect();
          // Calcular posição considerando o zoom/scale do canvas
          const scaleX = canvasWidth / rect.width;
          const scaleY = canvasHeight / rect.height;
          const x = Math.floor(((e.clientX - rect.left) * scaleX) / cellSize);
          const y = Math.floor(((e.clientY - rect.top) * scaleY) / cellSize);

          if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
            setHoveredCell((prev) => {
              if (prev?.x === x && prev?.y === y) return prev;
              return { x, y };
            });
          } else {
            setHoveredCell(null);
          }
        },
        [GRID_WIDTH, GRID_HEIGHT, canvasWidth, canvasHeight, cellSize]
      );

      const handleMouseLeave = useCallback(() => {
        setHoveredCell(null);
      }, []);

      const handleClick = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
          const canvas = canvasRef.current;
          if (!canvas) return;

          const rect = canvas.getBoundingClientRect();
          // Calcular posição considerando o zoom/scale do canvas
          const scaleX = canvasWidth / rect.width;
          const scaleY = canvasHeight / rect.height;
          const x = Math.floor(((e.clientX - rect.left) * scaleX) / cellSize);
          const y = Math.floor(((e.clientY - rect.top) * scaleY) / cellSize);

          if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
            const clickedUnit = unitPositionMap.get(`${x},${y}`);
            const clickedObstacle = obstaclePositionMap.get(`${x},${y}`);
            if (clickedUnit) {
              onUnitClick?.(clickedUnit);
            } else if (clickedObstacle) {
              onObstacleClick?.(clickedObstacle);
            } else {
              onCellClick?.(x, y);
            }
          }
        },
        [
          unitPositionMap,
          obstaclePositionMap,
          onCellClick,
          onUnitClick,
          onObstacleClick,
          GRID_WIDTH,
          GRID_HEIGHT,
          canvasWidth,
          canvasHeight,
          cellSize,
        ]
      );

      // Centralizar câmera em uma unidade
      const centerOnUnit = useCallback(
        (unitId: string) => {
          const unit = units.find((u) => u.id === unitId);
          if (!unit || !cameraRef.current) return;

          // Converter posição do grid para pixels do canvas
          const pixelX = (unit.posX + 0.5) * cellSize;
          const pixelY = (unit.posY + 0.5) * cellSize;

          cameraRef.current.centerOn(pixelX, pixelY);
        },
        [units, cellSize]
      );

      // Expor métodos via ref
      useImperativeHandle(
        ref,
        () => ({
          centerOnUnit,
        }),
        [centerOnUnit]
      );

      return (
        <CameraController
          ref={cameraRef}
          contentWidth={canvasWidth}
          contentHeight={canvasHeight}
          minZoom={0.5}
          maxZoom={2}
          initialZoom={1}
          className="w-full h-full"
          showZoomControls={true}
          showResetButton={true}
        >
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            style={{
              imageRendering: "pixelated",
              cursor: (() => {
                if (!hoveredCell) return "default";
                const cellKey = `${hoveredCell.x},${hoveredCell.y}`;
                // Unidade clicável (viva)
                if (unitPositionMap.has(cellKey)) return "pointer";
                // Célula de movimento
                if (movableCells.has(cellKey)) return "pointer";
                // Célula de ataque
                if (attackableCells.has(cellKey)) return "crosshair";
                // Default
                return "default";
              })(),
              filter: WEATHER_CSS_FILTER || undefined,
              transition: "filter 0.5s ease-in-out, cursor 0.1s ease",
            }}
            className="border-4 border-metal-iron rounded-lg shadow-2xl arena"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
          />
        </CameraController>
      );
    }
  )
);

ArenaBattleCanvas.displayName = "ArenaBattleCanvas";
