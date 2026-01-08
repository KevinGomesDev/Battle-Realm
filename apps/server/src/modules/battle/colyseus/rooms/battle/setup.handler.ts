// setup.handler.ts - Inicialização e geração de mapa/obstáculos
import type { Room } from "@colyseus/core";
import type { BattleSessionState, BattlePlayerSchema } from "../../schemas";
import { BattleObstacleSchema } from "../../schemas";
import {
  TURN_CONFIG,
  getGridDimensions,
  getRandomTerrain,
  getRandomBattleSize,
  getObstacleCount,
  getRandomObstacleType,
} from "@boundless/shared/config";
import { serializeConfig } from "./utils";

/**
 * Inicia a batalha
 */
export async function startBattle(
  state: BattleSessionState,
  roomId: string,
  metadata: Record<string, any>,
  broadcast: Room<BattleSessionState>["broadcast"],
  setMetadata: Room<BattleSessionState>["setMetadata"],
  setLobbyPhase: (value: boolean) => void,
  createBattleUnitsFn: () => Promise<void>,
  initQTEFn: () => void,
  calculateActionOrderFn: () => void,
  startTurnTimerFn: () => void
): Promise<void> {
  console.log(`[BattleRoom] ========== START BATTLE ==========`);
  console.log(`[BattleRoom] Room: ${roomId}`);
  console.log(`[BattleRoom] Players: ${state.players.length}`);

  setLobbyPhase(false);
  state.status = "ACTIVE";
  console.log(`[BattleRoom] Status setado para: ${state.status}`);

  // Gerar configuração do mapa
  const terrainType = getRandomTerrain();
  const territorySize = getRandomBattleSize();
  const { width, height } = getGridDimensions(territorySize);

  state.gridWidth = width;
  state.gridHeight = height;

  // Configurar mapa
  state.config.map.terrainType = terrainType;
  state.config.map.territorySize = territorySize;
  state.config.weather = "CLEAR";
  state.config.timeOfDay = 12;

  // Gerar obstáculos
  const obstacleCount = getObstacleCount(territorySize);
  generateObstacles(state, obstacleCount);

  // Criar unidades para cada jogador
  await createBattleUnitsFn();

  // Inicializar QTE Manager
  initQTEFn();

  // Definir ordem de ação
  calculateActionOrderFn();

  // Iniciar timer de turno
  state.turnTimer = TURN_CONFIG.timerSeconds;
  startTurnTimerFn();

  // Atualizar metadata
  setMetadata({
    ...metadata,
    status: "BATTLING",
  });

  // Broadcast início da batalha
  broadcast("battle:started", {
    battleId: state.battleId,
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
    config: serializeConfig(state),
  });
}

/**
 * Gera obstáculos no mapa
 */
export function generateObstacles(
  state: BattleSessionState,
  count: number
): void {
  const usedPositions = new Set<string>();

  // Reservar posições de spawn
  state.players.forEach((_, idx) => {
    const spawnX = idx === 0 ? 1 : state.gridWidth - 2;
    for (let y = 0; y < Math.min(3, state.gridHeight); y++) {
      usedPositions.add(`${spawnX},${y}`);
      usedPositions.add(`${spawnX + 1},${y}`);
    }
  });

  const terrainType = (state.config?.map?.terrainType ||
    "PLAINS") as Parameters<typeof getRandomObstacleType>[0];

  for (let i = 0; i < count; i++) {
    let attempts = 0;
    while (attempts < 50) {
      const x = Math.floor(Math.random() * state.gridWidth);
      const y = Math.floor(Math.random() * state.gridHeight);
      const key = `${x},${y}`;

      if (!usedPositions.has(key)) {
        usedPositions.add(key);

        const obstacle = new BattleObstacleSchema();
        obstacle.id = `obs_${i}`;
        obstacle.posX = x;
        obstacle.posY = y;
        obstacle.type = getRandomObstacleType(terrainType);
        obstacle.hp = 5;
        obstacle.maxHp = 5;
        obstacle.destroyed = false;

        state.obstacles.push(obstacle);
        break;
      }
      attempts++;
    }
  }
}
