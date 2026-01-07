// server/src/logic/battle-map.ts
// Lógica para geração de mapas de batalha (terreno, obstáculos)

import type {
  TerrainType,
  TerritorySize,
  BattleObstacle,
  BattleMapConfig,
  ObstacleType,
} from "../../../shared/types/battle.types";
import {
  getRandomTerrain,
  getRandomTerritorySize,
  getObstacleCount,
  TERRAIN_DEFINITIONS,
  getRandomObstacleType,
} from "../../../shared/types/battle.types";
import type { ArenaMapConfig } from "../../../shared/types/arena.types";
import { OBSTACLE_CONFIG } from "../../../shared/config/global.config";

// Função simples para gerar ID único
function generateObstacleId(): string {
  return `obs_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// =============================================================================
// GERAÇÃO DE OBSTÁCULOS
// =============================================================================

interface GenerateObstaclesParams {
  gridWidth: number;
  gridHeight: number;
  terrainType: TerrainType;
  territorySize: TerritorySize;
  excludePositions?: { x: number; y: number }[]; // Posições onde NÃO colocar obstáculos
}

/**
 * Gera obstáculos para o mapa de batalha
 */
export function generateObstacles(
  params: GenerateObstaclesParams
): BattleObstacle[] {
  const {
    gridWidth,
    gridHeight,
    terrainType,
    territorySize,
    excludePositions = [],
  } = params;

  const obstacleCount = getObstacleCount(territorySize);
  const terrain = TERRAIN_DEFINITIONS[terrainType];
  const obstacles: BattleObstacle[] = [];

  // Criar set de posições excluídas para lookup rápido
  const excludedSet = new Set(excludePositions.map((p) => `${p.x},${p.y}`));

  // Criar set de posições já usadas
  const usedPositions = new Set<string>();

  // Margens: não colocar obstáculos nas bordas onde unidades spawnam
  const marginX = Math.floor(gridWidth * 0.15); // 15% de margem
  const marginY = 2; // 2 tiles de margem vertical

  let attempts = 0;
  const maxAttempts = obstacleCount * 10;

  while (obstacles.length < obstacleCount && attempts < maxAttempts) {
    attempts++;

    // Gerar posição aleatória dentro da área válida
    const x = marginX + Math.floor(Math.random() * (gridWidth - marginX * 2));
    const y = marginY + Math.floor(Math.random() * (gridHeight - marginY * 2));

    const posKey = `${x},${y}`;

    // Verificar se posição é válida
    if (excludedSet.has(posKey) || usedPositions.has(posKey)) {
      continue;
    }

    // Verificar se não está muito próximo de outro obstáculo (mínimo 1 tile)
    let tooClose = false;
    for (const obs of obstacles) {
      const dist = Math.abs(obs.posX - x) + Math.abs(obs.posY - y);
      if (dist < 2) {
        tooClose = true;
        break;
      }
    }

    if (tooClose) continue;

    // Gerar tipo de obstáculo baseado no terreno
    const obstacleType: ObstacleType = getRandomObstacleType(terrainType);

    obstacles.push({
      id: generateObstacleId(),
      posX: x,
      posY: y,
      type: obstacleType,
      hp: OBSTACLE_CONFIG.defaultHp,
      maxHp: OBSTACLE_CONFIG.defaultHp,
      destroyed: false,
    });

    usedPositions.add(posKey);
  }

  return obstacles;
}

// =============================================================================
// GERAÇÃO COMPLETA DO MAPA
// =============================================================================

interface GenerateBattleMapParams {
  gridWidth: number;
  gridHeight: number;
  terrainType?: TerrainType;
  territorySize?: TerritorySize;
  unitPositions?: { x: number; y: number }[]; // Posições das unidades
}

/**
 * Gera configuração completa do mapa de batalha
 * @overload Para chamada com parâmetros nomeados
 */
export function generateBattleMap(
  params: GenerateBattleMapParams
): ArenaMapConfig;
/**
 * @overload Para chamada simplificada (gridWidth, gridHeight, unitPositions)
 */
export function generateBattleMap(
  gridWidth: number,
  gridHeight: number,
  unitPositions?: { x: number; y: number }[]
): ArenaMapConfig;
export function generateBattleMap(
  paramsOrWidth: GenerateBattleMapParams | number,
  gridHeight?: number,
  unitPositions?: { x: number; y: number }[]
): ArenaMapConfig {
  // Normalizar parâmetros
  let params: GenerateBattleMapParams;
  if (typeof paramsOrWidth === "number") {
    params = {
      gridWidth: paramsOrWidth,
      gridHeight: gridHeight!,
      unitPositions: unitPositions || [],
    };
  } else {
    params = paramsOrWidth;
  }

  const {
    gridWidth: gw,
    gridHeight: gh,
    terrainType = getRandomTerrain(),
    territorySize = getRandomTerritorySize(),
    unitPositions: positions = [],
  } = params;

  // Obter definição de terreno
  const terrainDef = TERRAIN_DEFINITIONS[terrainType];

  // Gerar obstáculos
  const obstacles = generateObstacles({
    gridWidth: gw,
    gridHeight: gh,
    terrainType,
    territorySize,
    excludePositions: positions,
  });

  return {
    terrainType,
    terrainName: terrainDef.name,
    terrainEmoji: terrainDef.emoji,
    terrainColors: terrainDef.colors,
    territorySize,
    obstacles,
  };
}

// =============================================================================
// VALIDAÇÃO DE POSIÇÃO
// =============================================================================

/**
 * Verifica se uma posição está ocupada por obstáculo
 */
export function isPositionBlocked(
  x: number,
  y: number,
  obstacles: BattleObstacle[]
): boolean {
  return obstacles.some((obs) => obs.posX === x && obs.posY === y);
}

/**
 * Encontra posição livre aleatória (para efeito de Folhas Caindo)
 */
export function findRandomFreePosition(
  gridWidth: number,
  gridHeight: number,
  obstacles: BattleObstacle[],
  occupiedPositions: { x: number; y: number }[],
  excludePosition?: { x: number; y: number }
): { x: number; y: number } | null {
  const allBlocked = new Set<string>();

  // Marcar obstáculos
  for (const obs of obstacles) {
    allBlocked.add(`${obs.posX},${obs.posY}`);
  }

  // Marcar posições ocupadas por unidades
  for (const pos of occupiedPositions) {
    allBlocked.add(`${pos.x},${pos.y}`);
  }

  // Marcar posição a excluir (posição atual da unidade)
  if (excludePosition) {
    allBlocked.add(`${excludePosition.x},${excludePosition.y}`);
  }

  // Coletar todas as posições livres
  const freePositions: { x: number; y: number }[] = [];
  for (let x = 0; x < gridWidth; x++) {
    for (let y = 0; y < gridHeight; y++) {
      if (!allBlocked.has(`${x},${y}`)) {
        freePositions.push({ x, y });
      }
    }
  }

  if (freePositions.length === 0) return null;

  // Sortear posição aleatória
  const index = Math.floor(Math.random() * freePositions.length);
  return freePositions[index];
}
