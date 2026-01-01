import { useRef, useCallback } from "react";

interface Position {
  x: number;
  y: number;
}

interface UnitAnimation {
  unitId: string;
  startPos: Position;
  endPos: Position;
  startTime: number;
  duration: number;
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
  /** Verifica se há animações em andamento */
  hasActiveAnimations: () => boolean;
  /** Atualiza as animações (chamar no loop de render) */
  updateAnimations: () => boolean;
}

// Duração da animação de movimento em ms
const MOVE_ANIMATION_DURATION = 150;

// Função de easing (ease-out cubic)
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Hook para gerenciar animações de movimento suave das unidades
 */
export function useUnitAnimations(): UseUnitAnimationsReturn {
  const animationsRef = useRef<Map<string, UnitAnimation>>(new Map());
  const lastPositionsRef = useRef<Map<string, Position>>(new Map());

  // Atualizar animações e retornar se ainda há animações ativas
  const updateAnimations = useCallback((): boolean => {
    const now = performance.now();
    let hasActive = false;

    animationsRef.current.forEach((anim, unitId) => {
      const elapsed = now - anim.startTime;
      const progress = Math.min(elapsed / anim.duration, 1);

      if (progress >= 1) {
        // Animação completa - guardar posição final e remover
        lastPositionsRef.current.set(unitId, { ...anim.endPos });
        animationsRef.current.delete(unitId);
      } else {
        hasActive = true;
      }
    });

    return hasActive;
  }, []);

  // Obter posição visual interpolada de uma unidade
  const getVisualPosition = useCallback(
    (unitId: string, logicalX: number, logicalY: number): Position => {
      const anim = animationsRef.current.get(unitId);

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

      const anim: UnitAnimation = {
        unitId,
        startPos: { x: fromX, y: fromY },
        endPos: { x: toX, y: toY },
        startTime: performance.now(),
        duration: MOVE_ANIMATION_DURATION,
      };

      animationsRef.current.set(unitId, anim);
    },
    []
  );

  // Verificar se há animações ativas
  const hasActiveAnimations = useCallback((): boolean => {
    return animationsRef.current.size > 0;
  }, []);

  return {
    getVisualPosition,
    startMoveAnimation,
    hasActiveAnimations,
    updateAnimations,
  };
}
