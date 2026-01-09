/**
 * Hook para criar maps de posição para lookup O(1)
 * Melhora performance em grids grandes
 */

import { useMemo } from "react";
import type {
  BattleUnitState,
  BattleObstacleState,
} from "@/services/colyseus.service";
import { getObstacleDimension } from "@boundless/shared/config";
import type { ObstacleSize } from "@boundless/shared/config";

interface UsePositionMapsParams {
  units: BattleUnitState[];
  obstacles: BattleObstacleState[];
}

interface UsePositionMapsResult {
  /** Map de posições de unidades vivas */
  unitPositionMap: Map<string, BattleUnitState>;
  /** Map de cadáveres (unidades mortas não removidas) */
  corpsePositionMap: Map<string, BattleUnitState>;
  /** Map de obstáculos não destruídos (todas as células ocupadas) */
  obstaclePositionMap: Map<string, BattleObstacleState>;
}

/**
 * Cria maps de posição otimizados para lookup rápido
 * Considera o tamanho dos obstáculos para mapear todas as células ocupadas
 */
export function usePositionMaps({
  units,
  obstacles,
}: UsePositionMapsParams): UsePositionMapsResult {
  // Map de unidades vivas
  const unitPositionMap = useMemo(() => {
    const map = new Map<string, BattleUnitState>();
    units.forEach((unit) => {
      if (unit.isAlive) {
        map.set(`${unit.posX},${unit.posY}`, unit);
      }
    });
    return map;
  }, [units]);

  // Map de cadáveres
  const corpsePositionMap = useMemo(() => {
    const map = new Map<string, BattleUnitState>();
    units.forEach((unit) => {
      if (!unit.isAlive && !unit.conditions?.includes("CORPSE_REMOVED")) {
        map.set(`${unit.posX},${unit.posY}`, unit);
      }
    });
    return map;
  }, [units]);

  // Map de obstáculos (todas as células ocupadas, considerando tamanho)
  const obstaclePositionMap = useMemo(() => {
    const map = new Map<string, BattleObstacleState>();
    obstacles.forEach((obs) => {
      if (!obs.destroyed) {
        const dimension = getObstacleDimension(
          (obs.size as ObstacleSize) || "SMALL"
        );
        // Mapear todas as células ocupadas pelo obstáculo
        for (let dx = 0; dx < dimension; dx++) {
          for (let dy = 0; dy < dimension; dy++) {
            map.set(`${obs.posX + dx},${obs.posY + dy}`, obs);
          }
        }
      }
    });
    return map;
  }, [obstacles]);

  return { unitPositionMap, corpsePositionMap, obstaclePositionMap };
}
