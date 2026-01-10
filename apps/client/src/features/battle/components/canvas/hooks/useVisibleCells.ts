/**
 * Hook para calcular células visíveis (Fog of War)
 * Baseado no visionRange de cada unidade aliada com Line of Sight
 */

import { useMemo } from "react";
import type {
  BattleUnitState,
  BattleObstacleState,
} from "@/services/colyseus.service";
import {
  hasLineOfSight,
  obstaclesToBlockers,
  unitsToBlockers,
} from "@boundless/shared/utils/line-of-sight.utils";

interface UseVisibleCellsParams {
  units: BattleUnitState[];
  obstacles: BattleObstacleState[];
  currentUserId: string;
  gridWidth: number;
  gridHeight: number;
}

/**
 * Calcula quais células são visíveis para o jogador atual
 * Considera Line of Sight através de obstáculos e unidades inimigas
 */
export function useVisibleCells({
  units,
  obstacles,
  currentUserId,
  gridWidth,
  gridHeight,
}: UseVisibleCellsParams): Set<string> {
  return useMemo(() => {
    const visible = new Set<string>();

    // Obter todas as unidades aliadas vivas
    const myUnits = units.filter(
      (u) => u.ownerId === currentUserId && u.isAlive
    );

    // Se não tem unidades, mostra tudo (fallback para debug)
    if (myUnits.length === 0) {
      for (let x = 0; x < gridWidth; x++) {
        for (let y = 0; y < gridHeight; y++) {
          visible.add(`${x},${y}`);
        }
      }
      return visible;
    }

    // Preparar bloqueadores para cálculo de Line of Sight
    const obstacleBlockers = obstaclesToBlockers(
      obstacles.map((obs) => ({
        posX: obs.posX,
        posY: obs.posY,
        destroyed: obs.destroyed,
        size: obs.size,
      }))
    );

    // Unidades inimigas bloqueiam visão
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
      []
    );

    const allBlockers = [...obstacleBlockers, ...unitBlockers];

    // Para cada unidade aliada, adicionar células visíveis
    myUnits.forEach((unit) => {
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
          : 8;

      // Para cada célula ocupada pela unidade, calcular visão
      for (let dx = 0; dx < dimension; dx++) {
        for (let dy = 0; dy < dimension; dy++) {
          const unitCellX = unit.posX + dx;
          const unitCellY = unit.posY + dy;

          // Adicionar células dentro do alcance de visão
          for (let vx = -visionRange; vx <= visionRange; vx++) {
            for (let vy = -visionRange; vy <= visionRange; vy++) {
              // Usar distância de Manhattan
              if (Math.abs(vx) + Math.abs(vy) <= visionRange) {
                const targetX = unitCellX + vx;
                const targetY = unitCellY + vy;

                // Verificar limites do grid
                if (
                  targetX >= 0 &&
                  targetX < gridWidth &&
                  targetY >= 0 &&
                  targetY < gridHeight
                ) {
                  const cellKey = `${targetX},${targetY}`;
                  if (visible.has(cellKey)) continue;

                  // Verificar Line of Sight
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
  }, [units, obstacles, currentUserId, gridWidth, gridHeight]);
}
