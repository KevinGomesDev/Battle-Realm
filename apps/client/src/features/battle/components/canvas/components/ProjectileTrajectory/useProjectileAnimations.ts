/**
 * Hook para gerenciar animações de projéteis
 *
 * Controla o ciclo de vida dos projéteis ativos e fornece
 * métodos para iniciar novas animações.
 */

import { useRef, useCallback } from "react";
import type {
  ActiveProjectile,
  ProjectileType,
  TrailParticle,
} from "./projectile.types";
import {
  getProjectileType,
  getProjectileConfig,
  calculateProjectileDuration,
} from "./projectile.config";

/** Gerador de IDs únicos */
let projectileIdCounter = 0;
function generateProjectileId(): string {
  return `proj_${Date.now()}_${++projectileIdCounter}`;
}

export interface UseProjectileAnimationsReturn {
  /** Projéteis ativos no momento */
  getActiveProjectiles: () => ActiveProjectile[];
  /** Partículas de rastro ativas */
  getTrailParticles: () => TrailParticle[];
  /** Inicia uma nova animação de projétil */
  fireProjectile: (params: {
    type?: ProjectileType;
    abilityCode?: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    casterId?: string;
    targetId?: string;
    isAreaProjectile?: boolean;
    explosionSize?: number;
    onComplete?: () => void;
  }) => string;
  /** Remove um projétil pelo ID */
  removeProjectile: (id: string) => void;
  /** Atualiza as animações (chamar no loop de render) */
  updateProjectiles: () => boolean;
  /** Limpa todos os projéteis */
  clearAll: () => void;
  /** Verifica se há projéteis ativos */
  hasActiveProjectiles: () => boolean;
}

/**
 * Hook para gerenciar animações de projéteis
 */
export function useProjectileAnimations(): UseProjectileAnimationsReturn {
  const projectilesRef = useRef<Map<string, ActiveProjectile>>(new Map());
  const trailParticlesRef = useRef<TrailParticle[]>([]);

  /** Obtém projéteis ativos */
  const getActiveProjectiles = useCallback((): ActiveProjectile[] => {
    return Array.from(projectilesRef.current.values());
  }, []);

  /** Obtém partículas de rastro */
  const getTrailParticles = useCallback((): TrailParticle[] => {
    return trailParticlesRef.current;
  }, []);

  /** Inicia uma nova animação de projétil */
  const fireProjectile = useCallback(
    (params: {
      type?: ProjectileType;
      abilityCode?: string;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      casterId?: string;
      targetId?: string;
      isAreaProjectile?: boolean;
      explosionSize?: number;
      onComplete?: () => void;
    }): string => {
      // Determinar tipo de projétil
      const type =
        params.type ||
        (params.abilityCode
          ? getProjectileType(params.abilityCode)
          : "PROJECTILE");

      const config = getProjectileConfig(type);

      // Calcular duração baseada na distância
      const duration = calculateProjectileDuration(
        params.startX,
        params.startY,
        params.endX,
        params.endY,
        config.speed
      );

      const id = generateProjectileId();

      const projectile: ActiveProjectile = {
        id,
        type,
        startPos: { x: params.startX, y: params.startY },
        endPos: { x: params.endX, y: params.endY },
        startTime: performance.now(),
        duration,
        casterId: params.casterId,
        targetId: params.targetId,
        onComplete: params.onComplete,
        isAreaProjectile: params.isAreaProjectile,
        explosionSize: params.explosionSize,
      };

      projectilesRef.current.set(id, projectile);

      console.log(
        `🚀 Projétil disparado: ${type} de (${params.startX}, ${params.startY}) para (${params.endX}, ${params.endY})`
      );

      return id;
    },
    []
  );

  /** Remove um projétil */
  const removeProjectile = useCallback((id: string): void => {
    projectilesRef.current.delete(id);
  }, []);

  /** Atualiza as animações e retorna se há projéteis ativos */
  const updateProjectiles = useCallback((): boolean => {
    const now = performance.now();
    const toRemove: string[] = [];

    // Atualizar projéteis
    projectilesRef.current.forEach((projectile, id) => {
      const elapsed = now - projectile.startTime;

      if (elapsed >= projectile.duration) {
        // Animação terminou
        toRemove.push(id);

        // Chamar callback de conclusão
        if (projectile.onComplete) {
          projectile.onComplete();
        }
      } else {
        // Adicionar partículas de rastro
        const config = getProjectileConfig(projectile.type);
        if (config.hasParticles) {
          const progress = elapsed / projectile.duration;
          const currentX =
            projectile.startPos.x +
            (projectile.endPos.x - projectile.startPos.x) * progress;
          const currentY =
            projectile.startPos.y +
            (projectile.endPos.y - projectile.startPos.y) * progress;

          // Adicionar partícula ocasionalmente
          if (Math.random() < 0.3) {
            trailParticlesRef.current.push({
              x: currentX + (Math.random() - 0.5) * 0.3,
              y: currentY + (Math.random() - 0.5) * 0.3,
              alpha: 1,
              size: config.size * 0.3 * Math.random(),
              createdAt: now,
            });
          }
        }
      }
    });

    // Remover projéteis finalizados
    toRemove.forEach((id) => projectilesRef.current.delete(id));

    // Atualizar partículas de rastro (fade out)
    const PARTICLE_LIFETIME = 500; // 500ms de vida
    trailParticlesRef.current = trailParticlesRef.current.filter((p) => {
      const age = now - p.createdAt;
      if (age >= PARTICLE_LIFETIME) return false;
      p.alpha = 1 - age / PARTICLE_LIFETIME;
      return true;
    });

    return (
      projectilesRef.current.size > 0 || trailParticlesRef.current.length > 0
    );
  }, []);

  /** Limpa todos os projéteis */
  const clearAll = useCallback((): void => {
    projectilesRef.current.clear();
    trailParticlesRef.current = [];
  }, []);

  /** Verifica se há projéteis ativos */
  const hasActiveProjectiles = useCallback((): boolean => {
    return projectilesRef.current.size > 0;
  }, []);

  return {
    getActiveProjectiles,
    getTrailParticles,
    fireProjectile,
    removeProjectile,
    updateProjectiles,
    clearAll,
    hasActiveProjectiles,
  };
}
