/**
 * Hook para gerenciar o loop de animação do canvas
 * Controla redesenho, atualização de sprites e animações
 */

import { useEffect, useRef } from "react";
import type { BattleUnitState } from "@/services/colyseus.service";
import { updateSpriteFrame } from "../useSprites";

interface UseAnimationLoopParams {
  draw: () => void;
  units: BattleUnitState[];
  currentPlayerId: string;
  frameIndexRef: React.MutableRefObject<number>;
  lastFrameChangeRef: React.MutableRefObject<number>;
  updateAnimations: () => boolean;
  hasActiveAnimations: () => boolean;
  needsRedrawRef: React.MutableRefObject<boolean>;
  animationTimeRef: React.MutableRefObject<number>;
  /** Função para atualizar projéteis (opcional) */
  updateProjectiles?: () => boolean;
  /** Função para verificar se há projéteis ativos (opcional) */
  hasActiveProjectiles?: () => boolean;
}

// Configurações de timing do loop
const GRID_MIN_INTERVAL = 16; // ~60 FPS máximo para o grid
const PULSE_INTERVAL = 50; // ~20 FPS para animação pulsante

/**
 * Gerencia o loop de animação otimizado do canvas
 */
export function useAnimationLoop({
  draw,
  units,
  currentPlayerId,
  frameIndexRef,
  lastFrameChangeRef,
  updateAnimations,
  hasActiveAnimations,
  needsRedrawRef,
  animationTimeRef,
  updateProjectiles,
  hasActiveProjectiles,
}: UseAnimationLoopParams): void {
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    let running = true;
    let lastGridDrawTime = 0;
    let lastPulseUpdate = 0;

    const animate = (currentTime: number) => {
      if (!running) return;

      // Atualizar timestamp de animação
      animationTimeRef.current = currentTime;

      // Atualizar animações de movimento
      const hasMovementAnimations = updateAnimations();

      // Atualizar projéteis
      const hasProjectileAnimations = updateProjectiles?.() ?? false;

      // Atualizar frame dos sprites
      const spriteFrameChanged = updateSpriteFrame(
        frameIndexRef,
        lastFrameChangeRef,
        currentTime
      );

      // Verificar se indicador pulsante precisa atualizar
      const needsPulseUpdate = currentTime - lastPulseUpdate >= PULSE_INTERVAL;
      const hasCurrentTurnUnit = units.some(
        (u) => u.ownerId === currentPlayerId && u.isAlive
      );

      // Condições para redesenho
      const shouldRedraw =
        needsRedrawRef.current ||
        hasMovementAnimations ||
        hasProjectileAnimations ||
        hasActiveAnimations() ||
        (hasActiveProjectiles?.() ?? false) ||
        spriteFrameChanged ||
        (hasCurrentTurnUnit && needsPulseUpdate);

      // Throttle de redesenho
      if (shouldRedraw && currentTime - lastGridDrawTime >= GRID_MIN_INTERVAL) {
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
    currentPlayerId,
    frameIndexRef,
    lastFrameChangeRef,
    updateAnimations,
    hasActiveAnimations,
    needsRedrawRef,
    animationTimeRef,
    updateProjectiles,
    hasActiveProjectiles,
  ]);
}
