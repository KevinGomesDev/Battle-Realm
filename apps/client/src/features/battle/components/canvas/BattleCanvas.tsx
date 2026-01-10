/**
 * BattleCanvas - Grid de batalha otimizado
 *
 * Componente principal do canvas de batalha que orquestra:
 * - Renderização do grid e terreno
 * - Visualização de unidades e sprites
 * - Fog of War e visibilidade
 * - Sistema de targeting e previews
 * - Interações do mouse e tooltips
 *
 * Usa configuração recebida do servidor (battle.config)
 */

import {
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  CameraController,
  type CameraControllerRef,
} from "../../../../components/CameraController";
import { useSprites } from "./useSprites";
import { useUnitAnimations } from "./useUnitAnimations";
import { UI_COLORS } from "./canvas.constants";
import type { SpriteAnimation, SpriteDirection } from "./sprite.config";

// Hooks
import {
  useVisibleCells,
  useMovableCells,
  useAttackableCells,
  usePositionMaps,
  useCanvasMouse,
  useTooltipInfo,
  useAnimationLoop,
  useGridCache,
} from "./hooks";

// Renderers
import {
  drawCellHighlights,
  drawAllObstacles,
  calculatePerspectivePosition,
  drawUnit,
  drawConditions,
  drawSpeechBubble,
  drawTurnIndicator,
  drawFogOfWar,
  drawTargetingPreview,
  drawAbilityAreaPreview,
  calculateAreaPreviewCenter,
  drawSingleTargetLine,
  type UnitCombatState,
} from "./renderers";

// Components
import { MovementTooltip, HoverTooltip } from "./components";
import {
  useProjectileAnimations,
  ProjectileTrajectory,
} from "./components/ProjectileTrajectory";

// Systems
import { HitStopSystem } from "./systems";

// Types
import type { BattleCanvasProps, BattleCanvasRef, GridColors } from "./types";

// Re-export types for external use
export type { SpriteDirection, BattleCanvasRef };

// Tamanho fixo da célula
const BASE_CELL_SIZE = 40;

/**
 * BattleCanvas - Componente principal do grid de batalha
 */
export const BattleCanvas = memo(
  forwardRef<BattleCanvasRef, BattleCanvasProps>(
    (
      {
        battle,
        units,
        currentUserId,
        selectedUnitId,
        activeUnitId,
        onCellClick,
        onUnitClick,
        onObstacleClick,
        onRightClick,
        onCellHover,
        unitDirection,
        pendingAction,
        activeBubbles,
        abilityAreaPreview,
        targetingPreview,
        singleTargetLinePreview,
      },
      ref
    ) => {
      // === CONFIGURAÇÃO DO SERVIDOR ===
      const { config, kingdoms } = battle;
      const GRID_WIDTH = config.grid.width;
      const GRID_HEIGHT = config.grid.height;
      const GRID_COLORS = config.colors as unknown as GridColors;
      const CONDITION_COLORS = config.conditionColors;
      const MAP_CONFIG = config.map;
      const OBSTACLES = useMemo(
        () => MAP_CONFIG?.obstacles || [],
        [MAP_CONFIG?.obstacles]
      );
      const TERRAIN_COLORS = MAP_CONFIG?.terrainColors;

      // === DIMENSÕES DO CANVAS ===
      const cellSize = BASE_CELL_SIZE;
      const canvasWidth = GRID_WIDTH * cellSize;
      const canvasHeight = GRID_HEIGHT * cellSize;

      // === REFS ===
      const canvasRef = useRef<HTMLCanvasElement>(null);
      const cameraRef = useRef<CameraControllerRef>(null);
      const needsRedrawRef = useRef(true);
      const animationTimeRef = useRef(0);
      const unitDirectionsRef = useRef<Map<string, SpriteDirection>>(new Map());
      const prevPositionsRef = useRef<Map<string, { x: number; y: number }>>(
        new Map()
      );
      const hitStopRef = useRef<HitStopSystem>(new HitStopSystem());

      // === HOOKS DE SPRITES E ANIMAÇÕES ===
      const {
        getSprite,
        allLoaded: spritesLoaded,
        frameIndexRef,
        lastFrameChangeRef,
      } = useSprites();

      const {
        getVisualPosition,
        startMoveAnimation,
        startSpriteAnimation,
        getSpriteAnimation,
        getSpriteFrame,
        getSpriteAnimationStartTime,
        isMoving,
        hasActiveAnimations,
        updateAnimations,
      } = useUnitAnimations();

      // === HOOK DE PROJÉTEIS ===
      const {
        getActiveProjectiles,
        getTrailParticles,
        fireProjectile,
        updateProjectiles,
        hasActiveProjectiles,
      } = useProjectileAnimations();

      // === HELPER FUNCTIONS ===
      const getPlayerColors = useCallback(
        (ownerId: string) => {
          const kingdom = kingdoms.find((k) => k.ownerId === ownerId);
          const playerIndex = kingdom?.playerIndex ?? 0;
          const playerColor =
            GRID_COLORS.playerColors[playerIndex] ||
            GRID_COLORS.playerColors[0];
          return {
            primary: playerColor?.primary || "#4a90d9",
            secondary: playerColor?.secondary || "#2563eb",
            highlight:
              playerIndex === 0
                ? UI_COLORS.hostHighlight
                : UI_COLORS.guestHighlight,
          };
        },
        [kingdoms, GRID_COLORS.playerColors]
      );

      // === MEMOIZAÇÃO ===
      const selectedUnit = useMemo(
        () => units.find((u) => u.id === selectedUnitId),
        [units, selectedUnitId]
      );

      const isMyTurn = battle.currentPlayerId === currentUserId;

      // === HOOKS DE POSIÇÃO ===
      const { unitPositionMap, corpsePositionMap, obstaclePositionMap } =
        usePositionMaps({ units, obstacles: OBSTACLES });

      // === HOOKS DE VISIBILIDADE ===
      const visibleCells = useVisibleCells({
        units,
        obstacles: OBSTACLES,
        currentUserId,
        gridWidth: GRID_WIDTH,
        gridHeight: GRID_HEIGHT,
      });

      // === HOOKS DE CÉLULAS ===
      const { movableCellsMap, movableCells, dashableCellsMap, dashableCells } =
        useMovableCells({
          selectedUnit,
          activeUnitId,
          units,
          obstacles: OBSTACLES,
          visibleCells,
          unitPositionMap,
          corpsePositionMap,
          obstaclePositionMap,
          currentUserId,
          isMyTurn,
          gridWidth: GRID_WIDTH,
          gridHeight: GRID_HEIGHT,
        });

      const attackableCells = useAttackableCells({
        selectedUnit,
        activeUnitId,
        units,
        obstacles: OBSTACLES,
        currentUserId,
        isMyTurn,
        pendingAction,
        targetingPreview,
      });

      // === GRID CACHE ===
      const { gridCacheRef, updateGridCache } = useGridCache({
        canvasWidth,
        canvasHeight,
        cellSize,
        gridWidth: GRID_WIDTH,
        gridHeight: GRID_HEIGHT,
        gridColors: GRID_COLORS,
        terrainColors: TERRAIN_COLORS,
      });

      // === MOUSE HANDLERS ===
      const {
        hoveredCell,
        mousePosition,
        handleMouseMove,
        handleMouseLeave,
        handleMouseDown,
        handleClick,
        handleContextMenu,
      } = useCanvasMouse({
        canvasRef,
        canvasWidth,
        canvasHeight,
        cellSize,
        gridWidth: GRID_WIDTH,
        gridHeight: GRID_HEIGHT,
        unitPositionMap,
        obstaclePositionMap,
        onCellClick,
        onUnitClick,
        onObstacleClick,
        onRightClick,
        onCellHover,
      });

      // === TOOLTIPS ===
      const { tooltipInfo, hoverTooltip } = useTooltipInfo({
        hoveredCell,
        mousePosition,
        movableCellsMap,
        unitPositionMap,
        obstaclePositionMap,
        currentUserId,
      });

      // === EFFECTS ===
      // Configurar HitStop
      useEffect(() => {
        hitStopRef.current.setCellSize(cellSize);
        hitStopRef.current.setShakeCallback((intensity, duration) => {
          cameraRef.current?.shake(intensity, duration);
        });
      }, [cellSize]);

      // Detectar mudanças de posição e iniciar animações
      useEffect(() => {
        units.forEach((unit) => {
          const prevPos = prevPositionsRef.current.get(unit.id);
          if (prevPos && (prevPos.x !== unit.posX || prevPos.y !== unit.posY)) {
            startMoveAnimation(
              unit.id,
              prevPos.x,
              prevPos.y,
              unit.posX,
              unit.posY
            );
          }
          prevPositionsRef.current.set(unit.id, { x: unit.posX, y: unit.posY });
        });
      }, [units, startMoveAnimation]);

      // Atualizar direção da unidade
      useEffect(() => {
        if (unitDirection) {
          unitDirectionsRef.current.set(
            unitDirection.unitId,
            unitDirection.direction
          );
          needsRedrawRef.current = true;
        }
      }, [unitDirection]);

      // Marcar para redesenho
      useEffect(() => {
        needsRedrawRef.current = true;
      }, [
        units,
        hoveredCell,
        selectedUnitId,
        battle.currentPlayerId,
        movableCellsMap,
        attackableCells,
        visibleCells,
        spritesLoaded,
        activeBubbles,
      ]);

      // === FUNÇÃO DE DESENHO PRINCIPAL ===
      const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.imageSmoothingEnabled = false;

        // Desenhar cache do grid
        updateGridCache();
        if (gridCacheRef.current) {
          ctx.drawImage(gridCacheRef.current, 0, 0);
        }

        // Highlights de células (desabilitado quando em modo de preview de ability)
        const isInAbilityPreviewMode =
          !!abilityAreaPreview || !!targetingPreview;
        drawCellHighlights({
          ctx,
          cellSize,
          movableCellsMap,
          dashableCellsMap,
          attackableCells,
          hoveredCell,
          gridColors: GRID_COLORS,
          hasAbilityAreaPreview: isInAbilityPreviewMode,
        });

        // Targeting Preview
        if (targetingPreview && targetingPreview.affectedCells.length > 0) {
          drawTargetingPreview({
            ctx,
            targetingPreview,
            units,
            obstacles: OBSTACLES,
            cellSize,
            animationTime: animationTimeRef.current,
          });
        }

        // Ability Range Indicator desabilitado - não mostra área vermelha fora do alcance
        // if (abilityAreaPreview) {
        //   drawAbilityRangeIndicator({
        //     ctx,
        //     abilityAreaPreview,
        //     gridWidth: GRID_WIDTH,
        //     gridHeight: GRID_HEIGHT,
        //     cellSize,
        //     gridColors: GRID_COLORS,
        //   });
        // }

        // Ability Area Preview
        const areaPreviewCenter = calculateAreaPreviewCenter(
          abilityAreaPreview ?? null,
          selectedUnit,
          hoveredCell
        );

        if (abilityAreaPreview && areaPreviewCenter) {
          drawAbilityAreaPreview({
            ctx,
            abilityAreaPreview,
            centerPos: areaPreviewCenter,
            units,
            obstacles: OBSTACLES,
            hoveredCell,
            gridWidth: GRID_WIDTH,
            gridHeight: GRID_HEIGHT,
            cellSize,
            gridColors: GRID_COLORS,
          });
        }

        // Single Target Line Preview (Teleport, etc)
        if (singleTargetLinePreview) {
          drawSingleTargetLine({
            ctx,
            singleTargetPreview: singleTargetLinePreview,
            hoveredCell,
            cellSize,
            animationTime: animationTimeRef.current,
            gridWidth: GRID_WIDTH,
            gridHeight: GRID_HEIGHT,
          });
        }

        // Obstáculos 3D - usa posição visual interpolada para perspectiva suave
        const perspectivePos = calculatePerspectivePosition(
          selectedUnitId,
          units,
          currentUserId,
          cellSize,
          GRID_WIDTH,
          GRID_HEIGHT,
          getVisualPosition
        );

        drawAllObstacles({
          ctx,
          obstacles: OBSTACLES,
          visibleCells,
          cellSize,
          perspectivePos,
        });

        // Unidades
        units.forEach((unit) => {
          const isOwned = unit.ownerId === currentUserId;
          const unitKey = `${unit.posX},${unit.posY}`;

          // Fog of War: inimigos só aparecem se visíveis
          if (!isOwned && !visibleCells.has(unitKey)) return;

          // Posição visual interpolada
          const visualPos = getVisualPosition(unit.id, unit.posX, unit.posY);
          const cellX = visualPos.x * cellSize;
          const cellY = visualPos.y * cellSize;

          // Determinar animação
          let animation: SpriteAnimation;
          let useCustomFrame = false;
          let customFrame = 0;

          const activeSpriteAnim = getSpriteAnimation(unit.id);
          const unitIsMoving = isMoving(unit.id);

          if (!unit.isAlive) {
            animation = "Dead";
          } else if (activeSpriteAnim) {
            animation = activeSpriteAnim;
            useCustomFrame = true;
            customFrame = getSpriteFrame(unit.id);
          } else if (unitIsMoving) {
            animation = "Walk";
          } else {
            animation = "Idle";
          }

          // Obter sprite
          const spriteType =
            unit.avatar || unit.classCode || (isOwned ? "swordman" : "mage");
          const loadedSprite = getSprite(spriteType, animation);

          // Calcular frame
          let currentFrame = 0;
          if (loadedSprite) {
            const { config } = loadedSprite;
            if (useCustomFrame) {
              currentFrame = customFrame % config.frameCount;
            } else if (!config.loop) {
              currentFrame = config.frameCount - 1;
            } else {
              currentFrame = frameIndexRef.current % config.frameCount;
            }
          }

          // Direção
          const direction =
            unitDirectionsRef.current.get(unit.id) ||
            (isOwned ? "right" : "left");

          // Calcular estado de combate baseado na animação de sprite ativa
          let combatState: UnitCombatState = "idle";
          if (!unit.isAlive) {
            combatState = "dead";
          } else if (
            activeSpriteAnim === "Sword_1" ||
            activeSpriteAnim === "Sword_2" ||
            activeSpriteAnim === "Bow" ||
            activeSpriteAnim === "Staff"
          ) {
            combatState = "attacking";
          } else if (activeSpriteAnim === "Damage") {
            combatState = "damaged";
          }

          // Calcular HP percent
          const hpPercent = unit.maxHp > 0 ? unit.currentHp / unit.maxHp : 1;

          // Desenhar unidade
          drawUnit({
            ctx,
            x: cellX,
            y: cellY,
            size: cellSize,
            unit,
            isOwned,
            isSelected: unit.id === selectedUnitId,
            direction,
            sprite: loadedSprite,
            spritesLoaded,
            currentFrame,
            playerColors: getPlayerColors(unit.ownerId),
            hpPercent,
            animationState: {
              combatState,
              stateStartTime: getSpriteAnimationStartTime(unit.id),
              offsetX: 0,
              offsetY: 0,
              scale: 1,
              flashIntensity: 0,
            },
            animationTime: animationTimeRef.current,
          });

          // Condições
          if (unit.isAlive) {
            drawConditions({
              ctx,
              x: cellX,
              y: cellY,
              conditions: unit.conditions || [],
              conditionColors: CONDITION_COLORS as Record<string, string>,
            });
          }

          // Balão de fala
          if (activeBubbles && unit.isAlive) {
            const bubble = activeBubbles.get(unit.id);
            if (bubble && bubble.expiresAt > Date.now()) {
              drawSpeechBubble({
                ctx,
                x: cellX,
                y: cellY,
                size: cellSize,
                message: bubble.message,
                isOwned,
              });
            }
          }
        });

        // Projéteis em movimento
        const activeProjectiles = getActiveProjectiles();
        const trailParticles = getTrailParticles();
        if (activeProjectiles.length > 0 || trailParticles.length > 0) {
          ProjectileTrajectory.render({
            ctx,
            cellSize,
            projectiles: activeProjectiles,
            trailParticles,
            animationTime: animationTimeRef.current,
          });
        }

        // Fog of War
        drawFogOfWar({
          ctx,
          visibleCells,
          gridWidth: GRID_WIDTH,
          gridHeight: GRID_HEIGHT,
          cellSize,
          animationTime: animationTimeRef.current,
        });

        // Hit Stop - Partículas de impacto
        hitStopRef.current.render(ctx);

        // Hit Stop - Flash overlay
        hitStopRef.current.renderFlashOverlay(ctx, canvasWidth, canvasHeight);

        // Indicador de turno
        const currentTurnUnit = units.find(
          (u) => u.ownerId === battle.currentPlayerId && u.isAlive
        );

        if (currentTurnUnit && isMyTurn) {
          const turnVisualPos = getVisualPosition(
            currentTurnUnit.id,
            currentTurnUnit.posX,
            currentTurnUnit.posY
          );

          drawTurnIndicator({
            ctx,
            x: turnVisualPos.x * cellSize,
            y: turnVisualPos.y * cellSize,
            size: cellSize,
            animationTime: animationTimeRef.current,
          });
        }
      }, [
        units,
        hoveredCell,
        battle.currentPlayerId,
        currentUserId,
        movableCellsMap,
        attackableCells,
        visibleCells,
        cellSize,
        GRID_WIDTH,
        GRID_HEIGHT,
        GRID_COLORS,
        CONDITION_COLORS,
        OBSTACLES,
        activeBubbles,
        targetingPreview,
        abilityAreaPreview,
        selectedUnit,
        selectedUnitId,
        isMyTurn,
        getVisualPosition,
        getSpriteAnimation,
        getSpriteFrame,
        isMoving,
        getSprite,
        spritesLoaded,
        frameIndexRef,
        getPlayerColors,
        updateGridCache,
        gridCacheRef,
        getActiveProjectiles,
        getTrailParticles,
      ]);

      // === ANIMATION LOOP ===
      useAnimationLoop({
        draw,
        units,
        currentPlayerId: battle.currentPlayerId ?? "",
        frameIndexRef,
        lastFrameChangeRef,
        updateAnimations,
        hasActiveAnimations,
        needsRedrawRef,
        animationTimeRef,
        updateProjectiles,
        hasActiveProjectiles,
        updateHitStop: (deltaTime) => hitStopRef.current.update(deltaTime),
        hasActiveHitStop: () => hitStopRef.current.hasActiveEffects(),
        isHitStopFrozen: () => hitStopRef.current.isFrozen(),
      });

      // === REF API ===
      const centerOnUnit = useCallback(
        (unitId: string) => {
          const unit = units.find((u) => u.id === unitId);
          if (!unit || !cameraRef.current) return;
          const pixelX = (unit.posX + 0.5) * cellSize;
          const pixelY = (unit.posY + 0.5) * cellSize;
          cameraRef.current.centerOn(pixelX, pixelY);
        },
        [units, cellSize]
      );

      const isUnitVisible = useCallback(
        (unitId: string): boolean => {
          const unit = units.find((u) => u.id === unitId);
          if (!unit) return false;
          if (unit.ownerId === currentUserId) return true;
          return visibleCells.has(`${unit.posX},${unit.posY}`);
        },
        [units, currentUserId, visibleCells]
      );

      const isPositionVisible = useCallback(
        (x: number, y: number): boolean => {
          return visibleCells.has(`${x},${y}`);
        },
        [visibleCells]
      );

      const centerOnUnitIfVisible = useCallback(
        (unitId: string) => {
          if (isUnitVisible(unitId)) {
            centerOnUnit(unitId);
          }
        },
        [isUnitVisible, centerOnUnit]
      );

      const centerOnPositionIfVisible = useCallback(
        (x: number, y: number) => {
          if (isPositionVisible(x, y) && cameraRef.current) {
            const pixelX = (x + 0.5) * cellSize;
            const pixelY = (y + 0.5) * cellSize;
            cameraRef.current.centerOn(pixelX, pixelY);
          }
        },
        [isPositionVisible, cellSize]
      );

      // Calcular posição na tela de uma unidade (para QTE inline)
      const getUnitScreenPosition = useCallback(
        (unitId: string): { x: number; y: number } | null => {
          const unit = units.find((u) => u.id === unitId);
          if (!unit) return null;

          // Obter estado da câmera
          const camera = cameraRef.current?.getCamera();
          if (!camera) return null;

          // Calcular posição no canvas (centro da célula)
          const canvasX = (unit.posX + 0.5) * cellSize;
          const canvasY = (unit.posY + 0.5) * cellSize;

          // Aplicar transformação da câmera (zoom e offset)
          const screenX = canvasX * camera.zoom + camera.offsetX;
          const screenY = canvasY * camera.zoom + camera.offsetY;

          return { x: screenX, y: screenY };
        },
        [units, cellSize]
      );

      useImperativeHandle(
        ref,
        () => ({
          centerOnUnit,
          centerOnUnitIfVisible,
          centerOnPositionIfVisible,
          isUnitVisible,
          isPositionVisible,
          getUnitScreenPosition,
          playAnimation: (unitId: string, animation: SpriteAnimation) => {
            startSpriteAnimation(unitId, animation);
            needsRedrawRef.current = true;
          },
          shake: (intensity?: number, duration?: number) => {
            cameraRef.current?.shake(intensity, duration);
          },
          animateMovement: (
            unitId: string,
            fromX: number,
            fromY: number,
            toX: number,
            toY: number
          ) => {
            startMoveAnimation(unitId, fromX, fromY, toX, toY);
          },
          fireProjectile: (params) => {
            fireProjectile(params);
            needsRedrawRef.current = true;
          },
          triggerHitStop: (
            cellX: number,
            cellY: number,
            damage: number,
            maxHp: number,
            isCritical?: boolean
          ) => {
            hitStopRef.current.trigger(cellX, cellY, damage, maxHp, isCritical);
            needsRedrawRef.current = true;
          },
        }),
        [
          centerOnUnit,
          centerOnUnitIfVisible,
          centerOnPositionIfVisible,
          isUnitVisible,
          isPositionVisible,
          getUnitScreenPosition,
          startSpriteAnimation,
          startMoveAnimation,
          fireProjectile,
        ]
      );

      // === CURSOR STYLE ===
      const cursorStyle = useMemo(() => {
        if (!hoveredCell) return "default";
        const cellKey = `${hoveredCell.x},${hoveredCell.y}`;
        if (unitPositionMap.has(cellKey)) return "pointer";
        if (movableCells.has(cellKey)) return "pointer";
        if (dashableCells.has(cellKey)) return "pointer"; // Células de disparada também são clicáveis
        if (attackableCells.has(cellKey)) return "crosshair";
        return "default";
      }, [
        hoveredCell,
        unitPositionMap,
        movableCells,
        dashableCells,
        attackableCells,
      ]);

      // === RENDER ===
      return (
        <>
          <CameraController
            ref={cameraRef}
            contentWidth={canvasWidth}
            contentHeight={canvasHeight}
            minZoom={0.5}
            maxZoom={2}
            initialZoom={1}
            className="w-full h-full"
            showZoomControls={false}
            showResetButton={false}
          >
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              style={{
                imageRendering: "pixelated",
                cursor: cursorStyle,
                transition: "filter 0.5s ease-in-out, cursor 0.1s ease",
              }}
              className="border-4 border-surface-500 rounded-lg shadow-2xl battle"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onClick={handleClick}
              onContextMenu={handleContextMenu}
            />
          </CameraController>

          {/* Tooltips - não exibe tooltip de movimento quando em modo de preview de ability */}
          {tooltipInfo &&
            mousePosition &&
            !abilityAreaPreview &&
            !targetingPreview && (
              <MovementTooltip
                info={tooltipInfo}
                mousePosition={mousePosition}
              />
            )}

          {hoverTooltip && mousePosition && !tooltipInfo && (
            <HoverTooltip info={hoverTooltip} mousePosition={mousePosition} />
          )}
        </>
      );
    }
  )
);

BattleCanvas.displayName = "BattleCanvas";
