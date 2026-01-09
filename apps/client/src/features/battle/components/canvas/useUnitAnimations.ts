import { useRef, useCallback } from "react";
import type { SpriteAnimation } from "./sprite.config";
import { ANIMATION_CONFIGS } from "./sprite.config";

interface Position {
  x: number;
  y: number;
}

interface UnitMoveAnimation {
  unitId: string;
  startPos: Position;
  endPos: Position;
  startTime: number;
  duration: number;
}

/** Animação de sprite (ataque, dano, etc) */
interface UnitSpriteAnimation {
  unitId: string;
  animation: SpriteAnimation;
  startTime: number;
  duration: number;
  frameIndex: number;
  lastFrameTime: number;
}

interface UseUnitAnimationsReturn {
  /** Posições visuais atuais das unidades (interpoladas) */
  getVisualPosition: (
    unitId: string,
    logicalX: number,
    logicalY: number
  ) => Position;
  /** Inicia uma animação de movimento para uma unidade */
  startMoveAnimation: (
    unitId: string,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ) => void;
  /** Inicia uma animação de sprite (ataque, dano, etc) */
  startSpriteAnimation: (unitId: string, animation: SpriteAnimation) => void;
  /** Obtém a animação de sprite ativa para uma unidade */
  getSpriteAnimation: (unitId: string) => SpriteAnimation | null;
  /** Obtém o frame atual da animação de sprite */
  getSpriteFrame: (unitId: string) => number;
  /** Obtém o tempo de início da animação de sprite ativa */
  getSpriteAnimationStartTime: (unitId: string) => number;
  /** Verifica se uma unidade está se movendo */
  isMoving: (unitId: string) => boolean;
  /** Verifica se há animações em andamento */
  hasActiveAnimations: () => boolean;
  /** Atualiza as animações (chamar no loop de render) */
  updateAnimations: () => boolean;
}

// Duração da animação de movimento em ms (mais lenta para ser visível)
const MOVE_ANIMATION_DURATION = 500;

// Função de easing (ease-out cubic)
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Hook para gerenciar animações de movimento suave e animações de sprite das unidades
 */
export function useUnitAnimations(): UseUnitAnimationsReturn {
  const moveAnimationsRef = useRef<Map<string, UnitMoveAnimation>>(new Map());
  const spriteAnimationsRef = useRef<Map<string, UnitSpriteAnimation>>(
    new Map()
  );
  const lastPositionsRef = useRef<Map<string, Position>>(new Map());

  // Atualizar animações e retornar se ainda há animações ativas
  const updateAnimations = useCallback((): boolean => {
    const now = performance.now();
    let hasActive = false;

    // Atualizar animações de movimento
    moveAnimationsRef.current.forEach((anim, unitId) => {
      const elapsed = now - anim.startTime;
      const progress = Math.min(elapsed / anim.duration, 1);

      if (progress >= 1) {
        // Animação completa - guardar posição final e remover
        lastPositionsRef.current.set(unitId, { ...anim.endPos });
        moveAnimationsRef.current.delete(unitId);
      } else {
        hasActive = true;
      }
    });

    // Atualizar animações de sprite
    spriteAnimationsRef.current.forEach((anim, unitId) => {
      const config = ANIMATION_CONFIGS[anim.animation];
      const elapsed = now - anim.startTime;

      if (elapsed >= anim.duration) {
        // Animação terminou - remover
        spriteAnimationsRef.current.delete(unitId);
      } else {
        hasActive = true;
        // Atualizar frame
        const frameElapsed = now - anim.lastFrameTime;
        if (frameElapsed >= config.frameDuration) {
          anim.frameIndex = (anim.frameIndex + 1) % config.frameCount;
          anim.lastFrameTime = now;
        }
      }
    });

    return hasActive;
  }, []);

  // Obter posição visual interpolada de uma unidade
  const getVisualPosition = useCallback(
    (unitId: string, logicalX: number, logicalY: number): Position => {
      const anim = moveAnimationsRef.current.get(unitId);

      if (anim) {
        const now = performance.now();
        const elapsed = now - anim.startTime;
        const progress = Math.min(elapsed / anim.duration, 1);
        const easedProgress = easeOutCubic(progress);

        return {
          x:
            anim.startPos.x + (anim.endPos.x - anim.startPos.x) * easedProgress,
          y:
            anim.startPos.y + (anim.endPos.y - anim.startPos.y) * easedProgress,
        };
      }

      // Sem animação ativa - usar posição lógica
      return { x: logicalX, y: logicalY };
    },
    []
  );

  // Iniciar animação de movimento
  const startMoveAnimation = useCallback(
    (
      unitId: string,
      fromX: number,
      fromY: number,
      toX: number,
      toY: number
    ) => {
      // Só animar se realmente houver movimento
      if (fromX === toX && fromY === toY) return;

      const anim: UnitMoveAnimation = {
        unitId,
        startPos: { x: fromX, y: fromY },
        endPos: { x: toX, y: toY },
        startTime: performance.now(),
        duration: MOVE_ANIMATION_DURATION,
      };

      moveAnimationsRef.current.set(unitId, anim);
    },
    []
  );

  // Iniciar animação de sprite (ataque, dano, etc)
  const startSpriteAnimation = useCallback(
    (unitId: string, animation: SpriteAnimation) => {
      const config = ANIMATION_CONFIGS[animation];
      const now = performance.now();

      const anim: UnitSpriteAnimation = {
        unitId,
        animation,
        startTime: now,
        duration: config.frameCount * config.frameDuration,
        frameIndex: 0,
        lastFrameTime: now,
      };

      spriteAnimationsRef.current.set(unitId, anim);
    },
    []
  );

  // Obter animação de sprite ativa
  const getSpriteAnimation = useCallback(
    (unitId: string): SpriteAnimation | null => {
      const anim = spriteAnimationsRef.current.get(unitId);
      return anim?.animation ?? null;
    },
    []
  );

  // Obter frame atual da animação de sprite
  const getSpriteFrame = useCallback((unitId: string): number => {
    const anim = spriteAnimationsRef.current.get(unitId);
    return anim?.frameIndex ?? 0;
  }, []);

  // Obter tempo de início da animação de sprite ativa
  const getSpriteAnimationStartTime = useCallback((unitId: string): number => {
    const anim = spriteAnimationsRef.current.get(unitId);
    return anim?.startTime ?? 0;
  }, []);

  // Verificar se unidade está se movendo
  const isMoving = useCallback((unitId: string): boolean => {
    return moveAnimationsRef.current.has(unitId);
  }, []);

  // Verificar se há animações ativas
  const hasActiveAnimations = useCallback((): boolean => {
    return (
      moveAnimationsRef.current.size > 0 || spriteAnimationsRef.current.size > 0
    );
  }, []);

  return {
    getVisualPosition,
    startMoveAnimation,
    startSpriteAnimation,
    getSpriteAnimation,
    getSpriteFrame,
    getSpriteAnimationStartTime,
    isMoving,
    hasActiveAnimations,
    updateAnimations,
  };
}
