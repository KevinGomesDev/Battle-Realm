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
  /** Função para atualizar HitStop (opcional) */
  updateHitStop?: (deltaTime: number) => boolean;
  /** Função para verificar se há efeitos HitStop ativos (opcional) */
  hasActiveHitStop?: () => boolean;
  /** Função para verificar freeze frame (opcional) */
  isHitStopFrozen?: () => boolean;
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
  updateHitStop,
  hasActiveHitStop,
  isHitStopFrozen,
}: UseAnimationLoopParams): void {
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    let running = true;
    let lastGridDrawTime = 0;
    let lastPulseUpdate = 0;
    let lastFrameTime = performance.now();

    const animate = (currentTime: number) => {
      if (!running) return;

      // Calcular deltaTime
      const deltaTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;

      // Atualizar timestamp de animação
      animationTimeRef.current = currentTime;

      // Atualizar HitStop (sempre, mesmo durante freeze)
      const hasHitStopAnimations = updateHitStop?.(deltaTime) ?? false;

      // Verificar se está em freeze frame
      const isFrozen = isHitStopFrozen?.() ?? false;

      // Se congelado, ainda desenha mas não atualiza outras animações
      if (isFrozen) {
        if (currentTime - lastGridDrawTime >= GRID_MIN_INTERVAL) {
          draw();
          lastGridDrawTime = currentTime;
        }
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

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
        hasHitStopAnimations ||
        hasActiveAnimations() ||
        (hasActiveProjectiles?.() ?? false) ||
        (hasActiveHitStop?.() ?? false) ||
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
    updateHitStop,
    hasActiveHitStop,
    isHitStopFrozen,
  ]);
}
