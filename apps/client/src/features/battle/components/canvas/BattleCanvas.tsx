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
import { createPortal } from "react-dom";
import type { BattleComputed } from "../../../../stores/battleStore";
import type {
  BattleUnitState,
  BattleObstacleState,
} from "@/services/colyseus.service";
import type { ObstacleType } from "../../../../../../shared/types/battle.types";
import { getObstacleVisualConfig } from "../../../../../../shared/config";
import {
  getFullMovementInfo,
  type MovementCellInfo,
} from "../../../../../../shared/utils/engagement.utils";
import {
  hasLineOfSight,
  obstaclesToBlockers,
  unitsToBlockers,
} from "../../../../../../shared/utils/line-of-sight.utils";
import { useSprites, updateSpriteFrame } from "./useSprites";
import { useUnitAnimations } from "./useUnitAnimations";
import { UI_COLORS, UNIT_RENDER_CONFIG } from "./canvas.constants";
import type { SpriteAnimation, SpriteDirection } from "./sprite.config";
import {
  CameraController,
  type CameraControllerRef,
} from "../../../../components/CameraController";
import { isPlayerControllable } from "../../utils/unit-control";
import type { TargetingPreview } from "../../../../../../shared/utils/targeting.utils";

// Re-export SpriteDirection for external use
export type { SpriteDirection };

/** Métodos expostos via ref */
export interface BattleCanvasRef {
  /** Centralizar câmera em uma unidade pelo ID */
  centerOnUnit: (unitId: string) => void;
  /** Centralizar câmera em uma unidade APENAS se estiver na visão do jogador */
  centerOnUnitIfVisible: (unitId: string) => void;
  /** Centralizar câmera em uma posição do grid APENAS se estiver na visão do jogador */
  centerOnPositionIfVisible: (x: number, y: number) => void;
  /** Verificar se uma unidade está na visão do jogador */
  isUnitVisible: (unitId: string) => boolean;
  /** Verificar se uma posição do grid está na visão do jogador */
  isPositionVisible: (x: number, y: number) => boolean;
  /** Iniciar animação de sprite em uma unidade */
  playAnimation: (unitId: string, animation: SpriteAnimation) => void;
  /** Sacudir a câmera (feedback de dano) */
  shake: (intensity?: number, duration?: number) => void;
}

interface ActiveBubble {
  message: string;
  expiresAt: number;
}

interface BattleCanvasProps {
  battle: BattleComputed;
  units: BattleUnitState[];
  currentUserId: string;
  selectedUnitId: string | null;
  /** ID da unidade ativa no turno atual */
  activeUnitId?: string | null;
  onCellClick?: (x: number, y: number) => void;
  onUnitClick?: (unit: BattleUnitState) => void;
  onObstacleClick?: (obstacle: BattleObstacleState) => void;
  /** Handler para clique com botão direito (cancela ação pendente) */
  onRightClick?: () => void;
  /** Direção para virar a unidade selecionada (baseado no movimento/clique) */
  unitDirection?: { unitId: string; direction: SpriteDirection } | null;
  /** Ação pendente - quando "attack", mostra células atacáveis */
  pendingAction?: string | null;
  /** Balões de fala ativos (unitId -> mensagem) */
  activeBubbles?: Map<string, ActiveBubble>;
  /** Preview de área de spell/skill (tamanho e cor) */
  spellAreaPreview?: {
    size: number; // Ex: 3 = 3x3
    color: string; // Cor base do preview (usada no centro)
    centerOnSelf?: boolean; // Se true, centra na unidade selecionada (para range SELF)
    rangeDistance?: number; // Distância máxima do caster (bloqueio de área)
    casterPos?: { x: number; y: number }; // Posição do caster para calcular distância
  } | null;
  /** Handler para quando o mouse passa sobre uma célula */
  onCellHover?: (cell: { x: number; y: number } | null) => void;
  /** Preview de targeting calculado pelo sistema unificado */
  targetingPreview?: TargetingPreview | null;
}

/**
 * BattleCanvas - Grid de batalha otimizado
 * Usa configuração recebida do servidor (battle.config)
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
        spellAreaPreview,
        targetingPreview,
      },
      ref
    ) => {
      // Extrair configuração do servidor (grid/mapa)
      const { config, kingdoms } = battle;
      const GRID_WIDTH = config.grid.width;
      const GRID_HEIGHT = config.grid.height;
      const GRID_COLORS = config.colors;
      const CONDITION_COLORS = config.conditionColors;
      const MAP_CONFIG = config.map;
      const OBSTACLES = MAP_CONFIG?.obstacles || [];
      // Cores do terreno para o grid (usa cores do terreno, não cores padrão)
      const TERRAIN_COLORS = MAP_CONFIG?.terrainColors;

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

      // Posição do mouse na tela para tooltip
      const [mousePosition, setMousePosition] = useState<{
        clientX: number;
        clientY: number;
      } | null>(null);

      // Ref para detectar drag vs click (posição do mousedown)
      const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
      const DRAG_THRESHOLD = 5; // pixels de tolerância para considerar click

      // Hook de sprites (usa refs para evitar re-renders)
      const {
        getSprite,
        allLoaded: spritesLoaded,
        frameIndexRef,
        lastFrameChangeRef,
      } = useSprites();

      // Hook de animações de movimento e sprite
      const {
        getVisualPosition,
        startMoveAnimation,
        startSpriteAnimation,
        getSpriteAnimation,
        getSpriteFrame,
        isMoving,
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
        const map = new Map<string, BattleUnitState>();
        units.forEach((unit) => {
          if (unit.isAlive) {
            map.set(`${unit.posX},${unit.posY}`, unit);
          }
        });
        return map;
      }, [units]);

      // Map de cadáveres para lookup O(1) (unidades mortas que não foram removidas)
      const corpsePositionMap = useMemo(() => {
        const map = new Map<string, BattleUnitState>();
        units.forEach((unit) => {
          if (!unit.isAlive && !unit.conditions?.includes("CORPSE_REMOVED")) {
            map.set(`${unit.posX},${unit.posY}`, unit);
          }
        });
        return map;
      }, [units]);

      // === FOG OF WAR - Células visíveis pelo jogador atual ===
      // Calcula quais células são visíveis baseado no visionRange de cada unidade aliada
      // Considera Line of Sight (obstáculos e unidades bloqueiam visão)
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

        // Preparar bloqueadores para cálculo de Line of Sight
        // Obstáculos não destruídos
        const obstacleBlockers = obstaclesToBlockers(
          OBSTACLES.map((obs) => ({
            posX: obs.posX,
            posY: obs.posY,
            destroyed: obs.destroyed,
          }))
        );

        // Unidades vivas (excluindo as do próprio jogador para não bloquear a própria visão)
        const enemyUnits = units.filter(
          (u) => u.ownerId !== currentUserId && u.isAlive
        );
        const unitBlockers = unitsToBlockers(
          enemyUnits.map((u) => ({
            id: u.id,
            posX: u.posX,
            posY: u.posY,
            isAlive: u.isAlive,
            size: u.size,
          })),
          [] // Não excluir nenhum
        );

        // Combinar todos os bloqueadores
        const allBlockers = [...obstacleBlockers, ...unitBlockers];

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
                      const cellKey = `${targetX},${targetY}`;
                      // Se já está visível, não precisa verificar novamente
                      if (visible.has(cellKey)) continue;

                      // Verificar Line of Sight (obstáculos e unidades bloqueiam)
                      if (
                        hasLineOfSight(
                          unitCellX,
                          unitCellY,
                          targetX,
                          targetY,
                          allBlockers
                        )
                      ) {
                        visible.add(cellKey);
                      }
                    }
                  }
                }
              }
            }
          }
        });

        return visible;
      }, [units, currentUserId, GRID_WIDTH, GRID_HEIGHT, OBSTACLES]);

      // Map de obstáculos para lookup O(1) (apenas não destruídos)
      const obstaclePositionMap = useMemo(() => {
        const map = new Map<string, BattleObstacleState>();
        OBSTACLES.forEach((obs) => {
          if (!obs.destroyed) {
            map.set(`${obs.posX},${obs.posY}`, obs);
          }
        });
        return map;
      }, [OBSTACLES]);

      // Verificar se é o turno do jogador atual
      const isMyTurn = battle.currentPlayerId === currentUserId;

      // Células movíveis como Map com informação completa de movimento
      // Inclui: custo, tipo (normal/engagement/blocked), etc.
      const movableCellsMap = useMemo((): Map<string, MovementCellInfo> => {
        if (!isMyTurn) return new Map();
        if (!selectedUnit || selectedUnit.movesLeft <= 0) return new Map();
        // Verificar se é a unidade ativa OU se activeUnitId está indefinido e é minha unidade controlável
        const isActiveOrPending = activeUnitId
          ? selectedUnit.id === activeUnitId
          : isPlayerControllable(selectedUnit, currentUserId);
        if (!isActiveOrPending) return new Map();

        const movable = new Map<string, MovementCellInfo>();
        const range = selectedUnit.movesLeft;

        // Expandir range para considerar potenciais penalidades de engajamento
        // (células que normalmente estariam no range podem ficar inacessíveis)
        const maxRange = range + 10; // buffer para penalidades grandes

        for (let dx = -maxRange; dx <= maxRange; dx++) {
          for (let dy = -maxRange; dy <= maxRange; dy++) {
            if (dx === 0 && dy === 0) continue;

            const nx = selectedUnit.posX + dx;
            const ny = selectedUnit.posY + dy;

            if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT)
              continue;

            const key = `${nx},${ny}`;

            // Verificar se não tem unidade viva, cadáver NEM obstáculo na célula de destino
            if (
              unitPositionMap.has(key) ||
              corpsePositionMap.has(key) ||
              obstaclePositionMap.has(key)
            )
              continue;

            // Calcular informações completas de movimento (incluindo verificação de caminho)
            const moveInfo = getFullMovementInfo(
              selectedUnit,
              nx,
              ny,
              units,
              OBSTACLES,
              GRID_WIDTH,
              GRID_HEIGHT
            );

            // Adicionar apenas se:
            // 1. O custo total estiver dentro do range (movimento válido)
            // 2. E o caminho NÃO estiver bloqueado
            // (Células bloqueadas não são mais mostradas)
            const inMoveRange = moveInfo.totalCost <= selectedUnit.movesLeft;

            if (inMoveRange && !moveInfo.isBlocked) {
              movable.set(key, moveInfo);
            }
          }
        }
        return movable;
      }, [
        isMyTurn,
        selectedUnit,
        activeUnitId,
        unitPositionMap,
        corpsePositionMap,
        obstaclePositionMap,
        units,
        OBSTACLES,
        GRID_WIDTH,
        GRID_HEIGHT,
      ]);

      // Manter compatibilidade com código que usa Set (apenas células NÃO bloqueadas)
      const movableCells = useMemo((): Set<string> => {
        const cells = new Set<string>();
        movableCellsMap.forEach((info, key) => {
          if (!info.isBlocked) {
            cells.add(key);
          }
        });
        return cells;
      }, [movableCellsMap]);

      // Células atacáveis como Set (8 direções - omnidirecional)
      // NOTA: Esta lógica é mantida para compatibilidade, mas o novo targetingPreview
      // deve ser usado preferencialmente quando disponível
      const attackableCells = useMemo((): Set<string> => {
        // Se há targetingPreview, usar o novo sistema ao invés do legado
        if (targetingPreview) return new Set();
        // Só mostrar quando for meu turno
        if (!isMyTurn) return new Set();
        // Só mostrar células atacáveis quando ação de ataque estiver selecionada
        // Aceita tanto "attack" quanto "ATTACK" para compatibilidade
        const isAttackAction =
          pendingAction === "attack" || pendingAction === "ATTACK";
        if (!isAttackAction) return new Set();
        if (!selectedUnit) return new Set();
        // Verificar se é a unidade ativa OU se activeUnitId está indefinido e é minha unidade controlável
        const isActiveOrPending = activeUnitId
          ? selectedUnit.id === activeUnitId
          : isPlayerControllable(selectedUnit, currentUserId);
        if (!isActiveOrPending) return new Set();
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
        targetingPreview,
      ]);

      // =========================================
      // RENDERIZAÇÃO DE OBSTÁCULOS 2.5D
      // =========================================

      /**
       * Desenha uma face do bloco 3D
       */
      const drawFace = useCallback(
        (
          ctx: CanvasRenderingContext2D,
          points: { x: number; y: number }[],
          fillColor: string,
          strokeColor: string = "#000"
        ) => {
          ctx.fillStyle = fillColor;
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        },
        []
      );

      /**
       * Desenha um obstáculo com efeito 2.5D baseado na posição do mouse/câmera
       */
      const drawObstacle3D = useCallback(
        (
          ctx: CanvasRenderingContext2D,
          obstacle: BattleObstacleState,
          cellSize: number,
          cameraPos: { x: number; y: number }
        ) => {
          const config = getObstacleVisualConfig(
            (obstacle.type as ObstacleType) || "ROCK"
          );

          const baseX = obstacle.posX * cellSize;
          const baseY = obstacle.posY * cellSize;

          // Centro do obstáculo
          const centerX = baseX + cellSize / 2;
          const centerY = baseY + cellSize / 2;

          // Vetor do centro para a câmera (determina perspectiva)
          const vecX = centerX - cameraPos.x;
          const vecY = centerY - cameraPos.y;

          // Força da perspectiva baseada na altura do obstáculo
          const perspectiveStrength = 0.15;
          const shiftX = vecX * perspectiveStrength * config.heightScale;
          const shiftY = vecY * perspectiveStrength * config.heightScale;

          // Tamanho do bloco (ligeiramente menor que a célula para dar espaço)
          const blockSize = cellSize * 0.85;
          const offset = (cellSize - blockSize) / 2;

          // Cantos da base
          const bTL = { x: baseX + offset, y: baseY + offset };
          const bTR = { x: baseX + offset + blockSize, y: baseY + offset };
          const bBR = {
            x: baseX + offset + blockSize,
            y: baseY + offset + blockSize,
          };
          const bBL = { x: baseX + offset, y: baseY + offset + blockSize };

          // Cantos do topo (deslocados pela perspectiva)
          const tTL = { x: bTL.x + shiftX, y: bTL.y + shiftY };
          const tTR = { x: bTR.x + shiftX, y: bTR.y + shiftY };
          const tBR = { x: bBR.x + shiftX, y: bBR.y + shiftY };
          const tBL = { x: bBL.x + shiftX, y: bBL.y + shiftY };

          // Renderizar faces baseado na direção da câmera

          // Face Y (Norte ou Sul)
          if (vecY > 0) {
            // Vendo o lado Norte
            drawFace(ctx, [bTL, bTR, tTR, tTL], config.sideYColor);
          } else {
            // Vendo o lado Sul
            drawFace(ctx, [bBL, bBR, tBR, tBL], config.sideYColor);
          }

          // Face X (Oeste ou Leste)
          if (vecX > 0) {
            // Vendo o lado Oeste
            drawFace(ctx, [bTL, bBL, tBL, tTL], config.sideXColor);
          } else {
            // Vendo o lado Leste
            drawFace(ctx, [bTR, bBR, tBR, tTR], config.sideXColor);
          }

          // Topo
          ctx.fillStyle = config.topColor;
          ctx.beginPath();
          ctx.moveTo(tTL.x, tTL.y);
          ctx.lineTo(tTR.x, tTR.y);
          ctx.lineTo(tBR.x, tBR.y);
          ctx.lineTo(tBL.x, tBL.y);
          ctx.closePath();
          ctx.fill();

          // Borda do topo (highlight)
          if (config.highlightColor) {
            ctx.strokeStyle = config.highlightColor;
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          // HP bar se o obstáculo foi danificado
          if (
            obstacle.hp !== undefined &&
            obstacle.maxHp !== undefined &&
            obstacle.hp < obstacle.maxHp
          ) {
            const hpPercent = obstacle.hp / obstacle.maxHp;
            const barWidth = blockSize * 0.8;
            const barHeight = 4;
            const barX = tTL.x + (blockSize - barWidth) / 2;
            const barY = tTL.y - 8;

            // Background
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillRect(barX, barY, barWidth, barHeight);

            // HP
            ctx.fillStyle =
              hpPercent > 0.5
                ? "#2ecc71"
                : hpPercent > 0.25
                ? "#f39c12"
                : "#e74c3c";
            ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
          }
        },
        [drawFace]
      );

      // Função para desenhar unidade usando sprite
      const drawUnit = useCallback(
        (
          ctx: CanvasRenderingContext2D,
          x: number,
          y: number,
          size: number,
          unit: BattleUnitState,
          isOwned: boolean
        ) => {
          // Determinar animação baseada no estado da unidade
          // Prioridade: animação de sprite ativa > movimento > estado (morto/vivo)
          let animation: SpriteAnimation;
          let useCustomFrame = false;
          let customFrame = 0;

          const activeSpriteAnim = getSpriteAnimation(unit.id);
          const unitIsMoving = isMoving(unit.id);

          if (!unit.isAlive) {
            animation = "Dead";
          } else if (activeSpriteAnim) {
            // Animação de combate ativa (ataque, dano)
            animation = activeSpriteAnim;
            useCustomFrame = true;
            customFrame = getSpriteFrame(unit.id);
          } else if (unitIsMoving) {
            // Animação de movimento
            animation = "Walk";
          } else {
            animation = "Idle";
          }

          // Obter sprite baseado no avatar da unidade
          // Prioridade: avatar > classCode > fallback baseado em ownership
          const spriteType =
            unit.avatar || unit.classCode || (isOwned ? "swordman" : "mage");
          const loadedSprite = getSprite(spriteType, animation);

          // Se o sprite está carregado, usa ele
          if (loadedSprite && spritesLoaded) {
            const { image: sprite, config } = loadedSprite;
            const { frameWidth, frameHeight, frameCount, row, loop } = config;

            // Determinar frame atual
            let currentFrame: number;
            if (useCustomFrame) {
              // Usar frame da animação de combate
              currentFrame = customFrame % frameCount;
            } else if (!loop) {
              // Animações não-loop (como Dead): mostrar último frame (pose final)
              currentFrame = frameCount - 1;
            } else {
              // Animações em loop (Idle, Walk): usar frame global
              currentFrame = frameIndexRef.current % frameCount;
            }

            // Calcular posição no sprite sheet
            const srcX = currentFrame * frameWidth;
            const srcY = row * frameHeight;

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
            const colors = getPlayerColors(unit.ownerId);

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
        [
          selectedUnitId,
          GRID_COLORS,
          spritesLoaded,
          getSprite,
          frameIndexRef,
          getSpriteAnimation,
          getSpriteFrame,
          isMoving,
          getPlayerColors,
        ]
      );

      // Função para barras de HP/Proteção (não usada atualmente, mas mantida para referência)
      // const drawUnitBars = useCallback(
      //   (
      //     ctx: CanvasRenderingContext2D,
      //     x: number,
      //     y: number,
      //     size: number,
      //     unit: BattleUnit
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
      //     if (unit.protection > 0) {
      //       const protY = barY - barHeight - 1;
      //       const maxProt = unit.resistance * 2;
      //       const protPercent = unit.protection / maxProt;

      //       ctx.fillStyle = "#1a1a1a";
      //       ctx.fillRect(barX, protY, barWidth, barHeight - 1);
      //       ctx.fillStyle = UI_COLORS.protection;
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
            ctx.fillStyle =
              (CONDITION_COLORS as Record<string, string>)[cond] || "#ffffff";
            ctx.fillRect(x + 4 + i * 6, y + 2, 4, 4);
          });
        },
        [CONDITION_COLORS]
      );

      // Função para desenhar balão de fala sobre a unidade
      const drawSpeechBubble = useCallback(
        (
          ctx: CanvasRenderingContext2D,
          x: number,
          y: number,
          size: number,
          message: string,
          isOwned: boolean
        ) => {
          const bubbleHeight = 20;
          const bubbleY = y - bubbleHeight - 8; // Acima da unidade
          const maxWidth = size * 3; // Máximo 3 células de largura

          // Medir texto e calcular largura
          ctx.font = "10px 'MedievalSharp', serif";
          const textWidth = Math.min(
            ctx.measureText(message).width + 12,
            maxWidth
          );
          const bubbleWidth = textWidth;
          const bubbleX = x + (size - bubbleWidth) / 2; // Centralizado

          // Truncar texto se muito longo
          let displayText = message;
          if (ctx.measureText(message).width + 12 > maxWidth) {
            while (
              ctx.measureText(displayText + "...").width + 12 > maxWidth &&
              displayText.length > 0
            ) {
              displayText = displayText.slice(0, -1);
            }
            displayText += "...";
          }

          // Fundo do balão
          const bgColor = isOwned ? "#d4af37" : "#dc2626";
          const textColor = isOwned ? "#1a1a1a" : "#ffffff";

          ctx.fillStyle = bgColor;
          ctx.beginPath();
          ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 4);
          ctx.fill();

          // Triângulo apontando para baixo
          ctx.beginPath();
          ctx.moveTo(x + size / 2 - 4, bubbleY + bubbleHeight);
          ctx.lineTo(x + size / 2, bubbleY + bubbleHeight + 6);
          ctx.lineTo(x + size / 2 + 4, bubbleY + bubbleHeight);
          ctx.closePath();
          ctx.fill();

          // Texto
          ctx.fillStyle = textColor;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            displayText,
            bubbleX + bubbleWidth / 2,
            bubbleY + bubbleHeight / 2
          );
        },
        []
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

        // Cores do terreno (com fallback para cores padrão)
        const primaryColor =
          TERRAIN_COLORS?.primary?.hex || GRID_COLORS.cellLight;
        const secondaryColor =
          TERRAIN_COLORS?.secondary?.hex || GRID_COLORS.cellDark;
        const accentColor = TERRAIN_COLORS?.accent?.hex || GRID_COLORS.gridDot;

        // Gerar variações de cor para criar efeito de terreno natural
        const terrainColors = [primaryColor, secondaryColor, accentColor];

        // Função hash determinística para posição (sempre mesmo resultado para mesma célula)
        const hashPosition = (x: number, y: number): number => {
          // Simple hash based on position - creates consistent "random" pattern
          const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          return hash - Math.floor(hash);
        };

        // Fundo base
        ctx.fillStyle = secondaryColor;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Desenhar grid com variação natural por célula
        for (let y = 0; y < GRID_HEIGHT; y++) {
          for (let x = 0; x < GRID_WIDTH; x++) {
            const cellX = x * cellSize;
            const cellY = y * cellSize;

            // Selecionar cor baseada em hash da posição (determinístico)
            const hash = hashPosition(x, y);
            const colorIndex = Math.floor(hash * terrainColors.length);
            const baseColor = terrainColors[colorIndex];

            // Desenhar célula base
            ctx.fillStyle = baseColor;
            ctx.fillRect(cellX, cellY, cellSize, cellSize);

            // Adicionar "textura" com pequenos detalhes aleatórios
            const detailHash = hashPosition(x * 3, y * 7);
            if (detailHash > 0.7) {
              // 30% das células têm detalhes decorativos
              const detailColor =
                terrainColors[(colorIndex + 1) % terrainColors.length];
              ctx.fillStyle = detailColor + "40"; // 25% opacity
              const detailX = cellX + detailHash * cellSize * 0.6;
              const detailY =
                cellY + hashPosition(x * 5, y * 3) * cellSize * 0.6;
              const detailSize = 2 + Math.floor(detailHash * 3);
              ctx.fillRect(detailX, detailY, detailSize, detailSize);
            }

            // Borda sutil
            ctx.strokeStyle = accentColor + "30"; // 19% opacity
            ctx.lineWidth = 1;
            ctx.strokeRect(
              cellX + 0.5,
              cellY + 0.5,
              cellSize - 1,
              cellSize - 1
            );
          }
        }

        gridCacheValidRef.current = true;
      }, [
        canvasWidth,
        canvasHeight,
        cellSize,
        GRID_COLORS,
        TERRAIN_COLORS,
        GRID_WIDTH,
        GRID_HEIGHT,
      ]);

      // Invalidar cache quando grid muda
      useEffect(() => {
        gridCacheValidRef.current = false;
      }, [canvasWidth, canvasHeight, GRID_COLORS, TERRAIN_COLORS]);

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
        // (Células bloqueadas não são mais incluídas no mapa)
        movableCellsMap.forEach((cellInfo, cellKey) => {
          const [x, y] = cellKey.split(",").map(Number);
          const cellX = x * cellSize;
          const cellY = y * cellSize;

          // Cores baseadas no tipo de célula
          if (cellInfo.hasEngagementPenalty) {
            // Laranja - movimento com custo de engajamento
            ctx.fillStyle = GRID_COLORS.cellMovableEngagement;
            ctx.fillRect(cellX, cellY, cellSize, cellSize);
            ctx.strokeStyle = GRID_COLORS.cellMovableEngagementBorder;
            ctx.lineWidth = 1;
            ctx.strokeRect(cellX, cellY, cellSize, cellSize);
          } else {
            // Verde - movimento normal
            ctx.fillStyle = GRID_COLORS.cellMovableNormal;
            ctx.fillRect(cellX, cellY, cellSize, cellSize);
            ctx.strokeStyle = GRID_COLORS.cellMovableNormalBorder;
            ctx.lineWidth = 1;
            ctx.strokeRect(cellX, cellY, cellSize, cellSize);
          }
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

        // === TARGETING PREVIEW (Sistema de Mira Direcional) ===
        // Renderiza apenas as células afetadas (impact) na direção do mouse
        if (targetingPreview && targetingPreview.affectedCells.length > 0) {
          // Desenhar células que serão afetadas (impact) - Vermelho
          targetingPreview.affectedCells.forEach((cell, index) => {
            const cellX = cell.x * cellSize;
            const cellY = cell.y * cellSize;

            // Verificar se há unidade ou obstáculo nesta célula
            const unitInCell = units.find(
              (u) => u.isAlive && u.posX === cell.x && u.posY === cell.y
            );
            const obstacleInCell = OBSTACLES.find(
              (o) => !o.destroyed && o.posX === cell.x && o.posY === cell.y
            );
            const hasTarget = !!unitInCell || !!obstacleInCell;

            // Pulsação sutil para indicar mira ativa
            const pulse =
              Math.sin(animationTimeRef.current / 150 + index * 0.5) * 0.15 +
              0.85;

            if (hasTarget) {
              // Com alvo - vermelho intenso com glow
              ctx.fillStyle = `rgba(239, 68, 68, ${0.5 * pulse})`; // Vermelho
              ctx.strokeStyle = `rgba(239, 68, 68, ${0.9 * pulse})`;
              ctx.lineWidth = 3;
            } else {
              // Sem alvo - vermelho mais suave (ainda indica área de impacto)
              ctx.fillStyle = `rgba(239, 68, 68, ${0.3 * pulse})`; // Vermelho suave
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

        // === INDICADOR DE RANGE PARA SPELL/SKILL ===
        // Desenha todos os blocos FORA do rangeDistance em vermelho translúcido
        if (
          spellAreaPreview &&
          spellAreaPreview.rangeDistance !== undefined &&
          spellAreaPreview.casterPos &&
          !spellAreaPreview.centerOnSelf
        ) {
          const casterX = spellAreaPreview.casterPos.x;
          const casterY = spellAreaPreview.casterPos.y;
          const maxRange = spellAreaPreview.rangeDistance;

          for (let gx = 0; gx < GRID_WIDTH; gx++) {
            for (let gy = 0; gy < GRID_HEIGHT; gy++) {
              // Usar Chebyshev distance (8 direções)
              const distance = Math.max(
                Math.abs(gx - casterX),
                Math.abs(gy - casterY)
              );

              if (distance > maxRange) {
                const cellX = gx * cellSize;
                const cellY = gy * cellSize;
                ctx.fillStyle = GRID_COLORS.areaPreviewOutOfRange;
                ctx.fillRect(cellX, cellY, cellSize, cellSize);
              }
            }
          }
        }

        // === PREVIEW DE ÁREA DE SPELL/SKILL ===
        // Para skills SELF com área, sempre mostra centrado na unidade selecionada
        // Para outras, mostra onde o mouse está (limitado por rangeDistance)
        const selectedUnit = units.find((u) => u.id === selectedUnitId);

        // Calcular centro do preview (clamped ao rangeDistance)
        const areaPreviewCenter = (() => {
          if (!spellAreaPreview) return null;

          // SELF: sempre centrado na unidade selecionada
          if (spellAreaPreview.centerOnSelf) {
            return selectedUnit
              ? { x: selectedUnit.posX, y: selectedUnit.posY }
              : null;
          }

          // Sem hover, não mostra preview
          if (!hoveredCell) return null;

          // Se não tem rangeDistance definido, usa posição do mouse diretamente
          if (
            spellAreaPreview.rangeDistance === undefined ||
            !spellAreaPreview.casterPos
          ) {
            return hoveredCell;
          }

          // Calcular distância do caster até o hover
          const casterX = spellAreaPreview.casterPos.x;
          const casterY = spellAreaPreview.casterPos.y;
          const maxRange = spellAreaPreview.rangeDistance;

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
        })();

        if (spellAreaPreview && areaPreviewCenter) {
          const radius = Math.floor(spellAreaPreview.size / 2);
          const centerX = areaPreviewCenter.x;
          const centerY = areaPreviewCenter.y;

          // Verificar se a posição central está fora do alcance (para feedback visual)
          let isCenterOutOfRange = false;
          if (
            spellAreaPreview.rangeDistance !== undefined &&
            spellAreaPreview.casterPos &&
            hoveredCell
          ) {
            const casterX = spellAreaPreview.casterPos.x;
            const casterY = spellAreaPreview.casterPos.y;
            const distanceToHover = Math.max(
              Math.abs(hoveredCell.x - casterX),
              Math.abs(hoveredCell.y - casterY)
            );
            isCenterOutOfRange =
              distanceToHover > spellAreaPreview.rangeDistance;
          }

          // Desenhar área de efeito (células que serão afetadas)
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
              const areaX = centerX + dx;
              const areaY = centerY + dy;

              // Verificar limites do grid
              if (
                areaX < 0 ||
                areaX >= GRID_WIDTH ||
                areaY < 0 ||
                areaY >= GRID_HEIGHT
              ) {
                continue;
              }

              const cellX = areaX * cellSize;
              const cellY = areaY * cellSize;

              // Verificar se há unidade ou obstáculo nesta célula
              const unitInCell = units.find(
                (u) => u.isAlive && u.posX === areaX && u.posY === areaY
              );
              const obstacleInCell = OBSTACLES.find(
                (o) => !o.destroyed && o.posX === areaX && o.posY === areaY
              );
              const hasTarget = unitInCell || obstacleInCell;

              // Determinar cor baseada no contexto
              if (isCenterOutOfRange) {
                // Fora do alcance: vermelho
                ctx.fillStyle = GRID_COLORS.areaPreviewOutOfRange;
                ctx.strokeStyle = GRID_COLORS.areaPreviewOutOfRangeBorder;
                ctx.lineWidth = 1;
              } else if (hasTarget) {
                // Com alvo: verde
                ctx.fillStyle = GRID_COLORS.areaPreviewTarget;
                ctx.strokeStyle = GRID_COLORS.areaPreviewTargetBorder;
                ctx.lineWidth = 2;
              } else {
                // Sem alvo: branco
                ctx.fillStyle = GRID_COLORS.areaPreviewEmpty;
                ctx.strokeStyle = GRID_COLORS.areaPreviewEmptyBorder;
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
            ? GRID_COLORS.areaPreviewOutOfRangeBorder
            : GRID_COLORS.areaPreviewCenter;
          ctx.lineWidth = 3;
          ctx.strokeRect(
            centerCellX + 2,
            centerCellY + 2,
            cellSize - 4,
            cellSize - 4
          );
        }

        // Hover (apenas se não há preview de área)
        if (hoveredCell && !spellAreaPreview) {
          const cellX = hoveredCell.x * cellSize;
          const cellY = hoveredCell.y * cellSize;
          ctx.fillStyle = GRID_COLORS.cellHover;
          ctx.fillRect(cellX, cellY, cellSize, cellSize);
          ctx.strokeStyle = GRID_COLORS.gridLine;
          ctx.lineWidth = 1;
          ctx.strokeRect(cellX, cellY, cellSize, cellSize);
        }

        // === DESENHAR OBSTÁCULOS (não destruídos e visíveis) - 2.5D ===
        // Calcular posição da perspectiva baseada nas unidades do jogador
        // Prioridade: 1) Unidade selecionada, 2) Unidade do jogador mais próxima do centro
        const gridCenterX = (GRID_WIDTH * cellSize) / 2;
        const gridCenterY = (GRID_HEIGHT * cellSize) / 2;
        let perspectivePos = { x: gridCenterX, y: gridCenterY };

        // Primeiro, tentar usar a unidade selecionada
        const perspectiveUnit = selectedUnitId
          ? units.find((u) => u.id === selectedUnitId)
          : null;

        if (perspectiveUnit && perspectiveUnit.isAlive) {
          // Usar posição da unidade selecionada
          perspectivePos = {
            x: perspectiveUnit.posX * cellSize + cellSize / 2,
            y: perspectiveUnit.posY * cellSize + cellSize / 2,
          };
        } else {
          // Fallback: usar a unidade do jogador mais próxima do centro do grid
          const myAliveUnits = units.filter(
            (u) => u.ownerId === currentUserId && u.isAlive
          );

          if (myAliveUnits.length > 0) {
            // Encontrar a unidade mais próxima do centro do grid
            let closestUnit = myAliveUnits[0];
            let closestDistSq = Infinity;

            for (const unit of myAliveUnits) {
              const unitCenterX = unit.posX * cellSize + cellSize / 2;
              const unitCenterY = unit.posY * cellSize + cellSize / 2;
              const distSq =
                (unitCenterX - gridCenterX) ** 2 +
                (unitCenterY - gridCenterY) ** 2;

              if (distSq < closestDistSq) {
                closestDistSq = distSq;
                closestUnit = unit;
              }
            }

            perspectivePos = {
              x: closestUnit.posX * cellSize + cellSize / 2,
              y: closestUnit.posY * cellSize + cellSize / 2,
            };
          }
        }

        // Ordenar obstáculos por distância à perspectiva (mais distantes primeiro)
        const sortedObstacles = [...OBSTACLES]
          .filter(
            (obs) =>
              !obs.destroyed && visibleCells.has(`${obs.posX},${obs.posY}`)
          )
          .sort((a, b) => {
            const aCenterX = a.posX * cellSize + cellSize / 2;
            const aCenterY = a.posY * cellSize + cellSize / 2;
            const bCenterX = b.posX * cellSize + cellSize / 2;
            const bCenterY = b.posY * cellSize + cellSize / 2;
            const aDistSq =
              (aCenterX - perspectivePos.x) ** 2 +
              (aCenterY - perspectivePos.y) ** 2;
            const bDistSq =
              (bCenterX - perspectivePos.x) ** 2 +
              (bCenterY - perspectivePos.y) ** 2;
            return bDistSq - aDistSq; // Mais distante primeiro
          });

        // Renderizar obstáculos ordenados
        sortedObstacles.forEach((obstacle) => {
          drawObstacle3D(ctx, obstacle, cellSize, perspectivePos);
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

          // === DESENHAR BALÃO DE FALA (se houver) ===
          if (activeBubbles && unit.isAlive) {
            const bubble = activeBubbles.get(unit.id);
            if (bubble && bubble.expiresAt > Date.now()) {
              drawSpeechBubble(
                ctx,
                cellX,
                cellY,
                cellSize,
                bubble.message,
                isOwned
              );
            }
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
        movableCellsMap,
        attackableCells,
        visibleCells,
        cellSize,
        GRID_WIDTH,
        GRID_HEIGHT,
        drawUnit,
        drawConditions,
        drawSpeechBubble,
        activeBubbles,
        GRID_COLORS,
        OBSTACLES,
        getVisualPosition,
        drawStaticGrid,
        drawObstacle3D,
        mousePosition,
        canvasWidth,
        canvasHeight,
        targetingPreview,
        spellAreaPreview,
      ]);

      // === MARCAR PARA REDESENHO ===
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

          // Armazenar posição do mouse para tooltip
          setMousePosition({ clientX: e.clientX, clientY: e.clientY });

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

      // Notificar parent sobre mudança de hoveredCell (fora do setState para evitar warning)
      useEffect(() => {
        onCellHover?.(hoveredCell);
      }, [hoveredCell, onCellHover]);

      const handleMouseLeave = useCallback(() => {
        setHoveredCell(null);
        setMousePosition(null);
        mouseDownPosRef.current = null;
      }, []);

      const handleMouseDown = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
          mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
        },
        []
      );

      const handleClick = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
          // Verificar se foi um drag (não um click direto)
          if (mouseDownPosRef.current) {
            const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
            const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
            if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
              // Foi um drag, ignorar click
              mouseDownPosRef.current = null;
              return;
            }
          }
          mouseDownPosRef.current = null;

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

      // Verificar se uma unidade está na visão do jogador
      const isUnitVisible = useCallback(
        (unitId: string): boolean => {
          const unit = units.find((u) => u.id === unitId);
          if (!unit) return false;

          // Unidades aliadas são sempre visíveis
          if (unit.ownerId === currentUserId) return true;

          // Para unidades inimigas, verificar se a posição está em uma célula visível
          return visibleCells.has(`${unit.posX},${unit.posY}`);
        },
        [units, currentUserId, visibleCells]
      );

      // Verificar se uma posição do grid está na visão do jogador
      const isPositionVisible = useCallback(
        (x: number, y: number): boolean => {
          return visibleCells.has(`${x},${y}`);
        },
        [visibleCells]
      );

      // Centralizar câmera em uma unidade APENAS se estiver na visão
      const centerOnUnitIfVisible = useCallback(
        (unitId: string) => {
          if (isUnitVisible(unitId)) {
            centerOnUnit(unitId);
          }
        },
        [isUnitVisible, centerOnUnit]
      );

      // Centralizar câmera em uma posição do grid APENAS se estiver na visão
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

      // Expor métodos via ref
      useImperativeHandle(
        ref,
        () => ({
          centerOnUnit,
          centerOnUnitIfVisible,
          centerOnPositionIfVisible,
          isUnitVisible,
          isPositionVisible,
          playAnimation: (unitId: string, animation: SpriteAnimation) => {
            startSpriteAnimation(unitId, animation);
            needsRedrawRef.current = true;
          },
          shake: (intensity?: number, duration?: number) => {
            cameraRef.current?.shake(intensity, duration);
          },
        }),
        [
          centerOnUnit,
          centerOnUnitIfVisible,
          centerOnPositionIfVisible,
          isUnitVisible,
          isPositionVisible,
          startSpriteAnimation,
        ]
      );

      // Calcular info do tooltip para a célula hovered
      const tooltipInfo = useMemo(() => {
        if (!hoveredCell || !mousePosition) return null;
        const cellKey = `${hoveredCell.x},${hoveredCell.y}`;
        const cellInfo = movableCellsMap.get(cellKey);
        if (!cellInfo) return null;

        return {
          totalCost: cellInfo.totalCost,
          hasEngagementPenalty: cellInfo.hasEngagementPenalty,
          type: cellInfo.type,
        };
      }, [hoveredCell, mousePosition, movableCellsMap]);

      // Tooltip simples de hover para unidades/corpos/obstáculos
      const hoverTooltip = useMemo(() => {
        if (!hoveredCell || !mousePosition) return null;
        const cellKey = `${hoveredCell.x},${hoveredCell.y}`;

        // Verificar unidade
        const unit = unitPositionMap.get(cellKey);
        if (unit) {
          const isAlly = unit.ownerId === currentUserId;
          return {
            name: unit.name,
            relation: isAlly ? "Aliado" : "Inimigo",
            status: unit.isAlive ? "Vivo" : "Morto",
            color: isAlly ? "blue" : "red",
          };
        }

        // Verificar obstáculo
        const obstacle = obstaclePositionMap.get(cellKey);
        if (obstacle) {
          return {
            name: obstacle.emoji,
            relation: "—",
            status: obstacle.destroyed ? "Destruído" : "Obstáculo",
            color: "gray",
          };
        }

        return null;
      }, [
        hoveredCell,
        mousePosition,
        unitPositionMap,
        obstaclePositionMap,
        currentUserId,
      ]);

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
                transition: "filter 0.5s ease-in-out, cursor 0.1s ease",
              }}
              className="border-4 border-surface-500 rounded-lg shadow-2xl battle"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onClick={handleClick}
              onContextMenu={(e) => {
                e.preventDefault();
                onRightClick?.();
              }}
            />
          </CameraController>
          {/* Tooltip de custo de movimento - usando Portal para renderizar fora do CameraController */}
          {tooltipInfo &&
            mousePosition &&
            createPortal(
              <div
                className="fixed z-[9999] pointer-events-none"
                style={{
                  left: mousePosition.clientX + 12,
                  top: mousePosition.clientY - 8,
                }}
              >
                <div
                  className={`px-2 py-1 rounded text-xs font-bold shadow-lg border ${
                    tooltipInfo.hasEngagementPenalty
                      ? "bg-orange-900/95 text-orange-200 border-orange-500"
                      : "bg-green-900/95 text-green-200 border-green-500"
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span>👟</span>
                    <span>Custo: {tooltipInfo.totalCost}</span>
                  </div>
                  {tooltipInfo.hasEngagementPenalty && (
                    <div className="text-orange-300 text-[10px] mt-0.5">
                      ⚠️ Penalidade de engajamento
                    </div>
                  )}
                </div>
              </div>,
              document.body
            )}
          {/* Tooltip simples de hover para unidades/corpos/obstáculos */}
          {hoverTooltip &&
            mousePosition &&
            !tooltipInfo &&
            createPortal(
              <div
                className="fixed z-[9998] pointer-events-none"
                style={{
                  left: mousePosition.clientX + 12,
                  top: mousePosition.clientY - 8,
                }}
              >
                <div
                  className={`px-2 py-1 rounded text-[10px] shadow-lg border backdrop-blur-sm ${
                    hoverTooltip.color === "blue"
                      ? "bg-blue-900/90 text-blue-100 border-blue-500/50"
                      : hoverTooltip.color === "red"
                      ? "bg-red-900/90 text-red-100 border-red-500/50"
                      : "bg-gray-800/90 text-gray-200 border-gray-500/50"
                  }`}
                >
                  <span className="font-semibold">{hoverTooltip.name}</span>
                  <span className="mx-1 opacity-50">•</span>
                  <span className="opacity-75">{hoverTooltip.relation}</span>
                  <span className="mx-1 opacity-50">•</span>
                  <span
                    className={
                      hoverTooltip.status === "Vivo"
                        ? "text-green-300"
                        : hoverTooltip.status === "Morto"
                        ? "text-red-300"
                        : "text-gray-400"
                    }
                  >
                    {hoverTooltip.status}
                  </span>
                </div>
              </div>,
              document.body
            )}
        </>
      );
    }
  )
);

BattleCanvas.displayName = "BattleCanvas";
