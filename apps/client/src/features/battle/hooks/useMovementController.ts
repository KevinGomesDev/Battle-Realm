/**
 * useMovementController.ts
 *
 * Sistema de movimento fluido para batalha.
 * Permite movimento contínuo segurando WASD/Arrows,
 * validando células e parando sempre em posições válidas.
 */

import { useEffect, useRef, useCallback } from "react";
import type {
  BattleUnit,
  BattleObstacle,
} from "@boundless/shared/types/battle.types";
import { getFullMovementInfo } from "@boundless/shared/utils/engagement.utils";
import { getUnitSizeDefinition, type UnitSize } from "@boundless/shared/config";

// ============================================================================
// TIPOS
// ============================================================================

export type MovementDirection = "up" | "down" | "left" | "right";

export interface MovementControllerConfig {
  /** Unidade selecionada que será movida */
  selectedUnit: BattleUnit | null | undefined;
  /** Se é o turno do jogador atual */
  isMyTurn: boolean;
  /** ID do usuário atual */
  currentUserId: string | null;
  /** Se o movimento está habilitado */
  enabled: boolean;
  /** Todas as unidades na batalha */
  units: BattleUnit[];
  /** Obstáculos do mapa */
  obstacles: BattleObstacle[];
  /** Largura do grid */
  gridWidth: number;
  /** Altura do grid */
  gridHeight: number;
  /** Células visíveis (fog of war) */
  visibleCells: Set<string>;
  /** Callback para atualizar direção do sprite */
  onDirectionChange?: (unitId: string, direction: "left" | "right") => void;
  /** Callback para executar movimento (envia ao servidor) */
  onMove: (unitId: string, toX: number, toY: number) => void;
  /**
   * Callback para iniciar animação visual IMEDIATAMENTE (client-side prediction).
   * Isso faz o movimento parecer instantâneo, sem esperar o servidor.
   */
  onAnimateMove?: (
    unitId: string,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ) => void;
}

interface MovementState {
  /** Teclas atualmente pressionadas */
  keysPressed: Set<MovementDirection>;
  /** Se está em cooldown de movimento (aguardando animação) */
  isMoving: boolean;
  /** Timestamp do último movimento */
  lastMoveTime: number;
}

// ============================================================================
// CONSTANTES
// ============================================================================

/**
 * Tempo entre movimentos em ms.
 * Deve ser ligeiramente menor que MOVE_ANIMATION_DURATION (250ms)
 * para que a animação do próximo movimento comece antes da atual terminar,
 * criando um fluxo contínuo e suave.
 */
const MOVEMENT_COOLDOWN_MS = 220;

/** Mapeamento de teclas para direções */
const KEY_TO_DIRECTION: Record<string, MovementDirection> = {
  w: "up",
  W: "up",
  ArrowUp: "up",
  s: "down",
  S: "down",
  ArrowDown: "down",
  a: "left",
  A: "left",
  ArrowLeft: "left",
  d: "right",
  D: "right",
  ArrowRight: "right",
};

/** Delta de posição por direção */
const DIRECTION_DELTA: Record<MovementDirection, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Verifica se uma célula está ocupada por outra unidade
 */
function isCellOccupied(
  x: number,
  y: number,
  units: BattleUnit[],
  excludeUnitId?: string
): boolean {
  for (const unit of units) {
    if (!unit.isAlive || unit.id === excludeUnitId) continue;

    const sizeDef = getUnitSizeDefinition(unit.size as UnitSize);
    const dimension = sizeDef.dimension;

    for (let dx = 0; dx < dimension; dx++) {
      for (let dy = 0; dy < dimension; dy++) {
        if (unit.posX + dx === x && unit.posY + dy === y) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Verifica se o jogador controla a unidade
 */
function isPlayerControllable(
  unit: BattleUnit,
  userId: string | null
): boolean {
  if (!userId) return false;
  return unit.ownerId === userId && unit.isAlive;
}

/**
 * Calcula a direção prioritária baseado nas teclas pressionadas
 * Prioriza a tecla mais recente no eixo horizontal para sprite direction
 */
function getPrimaryDirection(
  keysPressed: Set<MovementDirection>
): MovementDirection | null {
  if (keysPressed.size === 0) return null;

  // Prioridade: última tecla pressionada (por simplicidade, pegar qualquer uma)
  // Para movimento mais responsivo, retornamos a primeira encontrada
  const directions = Array.from(keysPressed);
  return directions[directions.length - 1] ?? null;
}

/**
 * Calcula direção do sprite baseado no movimento horizontal
 */
function getSpriteDirection(direction: MovementDirection): "left" | "right" {
  return direction === "left" ? "left" : "right";
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

/**
 * Hook para controle de movimento fluido na batalha.
 *
 * Permite que o jogador segure WASD/Arrows para mover continuamente,
 * validando cada célula e parando sempre em posições válidas.
 *
 * @example
 * ```tsx
 * useMovementController({
 *   selectedUnit,
 *   isMyTurn,
 *   currentUserId: user?.id ?? null,
 *   enabled: !isPaused && !hasActiveAbility,
 *   units,
 *   obstacles: battle.config.map.obstacles ?? [],
 *   gridWidth: battle.config.grid.width,
 *   gridHeight: battle.config.grid.height,
 *   visibleCells,
 *   onDirectionChange: (unitId, dir) => setUnitDirection({ unitId, direction: dir }),
 *   onMove: moveUnit,
 * });
 * ```
 */
export function useMovementController(config: MovementControllerConfig): void {
  // Estado interno via refs para evitar re-renders
  const stateRef = useRef<MovementState>({
    keysPressed: new Set(),
    isMoving: false,
    lastMoveTime: 0,
  });

  // Ref para config atualizado (evita stale closures)
  const configRef = useRef(config);
  configRef.current = config;

  // RAF ID para cancelamento
  const rafIdRef = useRef<number | null>(null);

  // ========================================
  // LÓGICA DE MOVIMENTO
  // ========================================

  /**
   * Tenta executar um movimento na direção especificada
   */
  const tryMove = useCallback((direction: MovementDirection): boolean => {
    const cfg = configRef.current;
    const state = stateRef.current;
    const unit = cfg.selectedUnit;

    // Validações básicas
    if (!unit) return false;
    if (!cfg.isMyTurn) return false;
    if (!isPlayerControllable(unit, cfg.currentUserId)) return false;
    if (unit.movesLeft <= 0) return false;
    if (state.isMoving) return false;

    // Calcular nova posição
    const delta = DIRECTION_DELTA[direction];
    const newX = unit.posX + delta.dx;
    const newY = unit.posY + delta.dy;

    // Verificar limites do grid
    if (newX < 0 || newX >= cfg.gridWidth) return false;
    if (newY < 0 || newY >= cfg.gridHeight) return false;

    // Verificar fog of war
    const cellKey = `${newX},${newY}`;
    if (!cfg.visibleCells.has(cellKey)) return false;

    // Verificar ocupação
    if (isCellOccupied(newX, newY, cfg.units, unit.id)) return false;

    // Calcular custo e validar caminho
    const moveInfo = getFullMovementInfo(
      unit,
      newX,
      newY,
      cfg.units,
      cfg.obstacles,
      cfg.gridWidth,
      cfg.gridHeight
    );

    if (moveInfo.isBlocked) return false;
    if (moveInfo.totalCost > unit.movesLeft) return false;

    // Atualizar direção do sprite (apenas horizontal)
    if (direction === "left" || direction === "right") {
      cfg.onDirectionChange?.(unit.id, getSpriteDirection(direction));
    }

    // Marcar como em movimento
    state.isMoving = true;
    state.lastMoveTime = performance.now();

    // IMPORTANTE: Iniciar animação visual IMEDIATAMENTE (client-side prediction)
    // Isso faz o movimento parecer instantâneo, sem esperar o servidor confirmar
    cfg.onAnimateMove?.(unit.id, unit.posX, unit.posY, newX, newY);

    // Enviar movimento ao servidor (confirmação virá depois)
    cfg.onMove(unit.id, newX, newY);

    // Aguardar cooldown antes de permitir próximo movimento
    setTimeout(() => {
      state.isMoving = false;
    }, MOVEMENT_COOLDOWN_MS);

    return true;
  }, []);

  /**
   * Loop de movimento contínuo
   */
  const movementLoop = useCallback(() => {
    const state = stateRef.current;
    const cfg = configRef.current;

    if (!cfg.enabled) {
      rafIdRef.current = requestAnimationFrame(movementLoop);
      return;
    }

    // Se tem teclas pressionadas e não está em cooldown
    if (state.keysPressed.size > 0 && !state.isMoving) {
      const direction = getPrimaryDirection(state.keysPressed);
      if (direction) {
        tryMove(direction);
      }
    }

    rafIdRef.current = requestAnimationFrame(movementLoop);
  }, [tryMove]);

  // ========================================
  // EVENT HANDLERS
  // ========================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar se em input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const direction = KEY_TO_DIRECTION[e.key];
      if (!direction) return;

      // Prevenir scroll da página
      e.preventDefault();

      const state = stateRef.current;
      const wasEmpty = state.keysPressed.size === 0;

      state.keysPressed.add(direction);

      // Se é a primeira tecla e está habilitado, tentar mover imediatamente
      if (wasEmpty && configRef.current.enabled) {
        tryMove(direction);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const direction = KEY_TO_DIRECTION[e.key];
      if (!direction) return;

      stateRef.current.keysPressed.delete(direction);
    };

    // Limpar teclas quando a janela perde foco
    const handleBlur = () => {
      stateRef.current.keysPressed.clear();
    };

    // Registrar event listeners
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    // Iniciar loop de movimento
    rafIdRef.current = requestAnimationFrame(movementLoop);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [movementLoop, tryMove]);

  // Limpar estado quando unidade muda ou turno muda
  useEffect(() => {
    stateRef.current.keysPressed.clear();
    stateRef.current.isMoving = false;
  }, [config.selectedUnit?.id, config.isMyTurn]);
}

// ============================================================================
// EXPORT DE TIPOS
// ============================================================================

export type { MovementState };
