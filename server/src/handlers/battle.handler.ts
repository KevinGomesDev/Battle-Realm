// src/handlers/battle.handler.ts
// Orquestrador enxuto: delega para módulos battle/* já componentizados
import { Server, Socket } from "socket.io";
import {
  activeBattles,
  battleLobbies,
  disconnectedPlayers,
  setBattleIo,
  socketToUser,
  userToLobby,
} from "./battle/battle-state";
import { registerBattleLobbyHandlers } from "./battle/battle-handlers-lobby";
import { registerBattleActionHandlers } from "./battle/battle-handlers-actions";
import { registerBattleRematchHandlers } from "./battle/battle-handlers-rematch";
import { registerBattleDisconnectHandler } from "./battle/battle-handlers-disconnect";
import { bootstrapArenaPersistence } from "./battle/battle-persistence";
import {
  pauseBattleTimerIfNoPlayers,
  resumeBattleTimer,
} from "./battle/battle-timer";

// Flag para garantir que o bootstrap foi executado
let isBootstrapped = false;

/**
 * Inicializa o estado da arena (lobbies e batalhas) do banco de dados.
 * DEVE ser chamado e aguardado ANTES de aceitar conexões!
 */
export async function initializeArenaState(): Promise<void> {
  if (isBootstrapped) return;

  try {
    await bootstrapArenaPersistence();
    isBootstrapped = true;
    console.log("[ARENA] ✅ Estado da arena inicializado com sucesso");
  } catch (err) {
    console.error("[ARENA] ❌ Erro ao inicializar estado da arena:", err);
    throw err; // Re-throw para impedir o servidor de iniciar em estado inconsistente
  }
}

export {
  battleLobbies,
  activeBattles,
  battleLobbies as arenaLobbies,
  activeBattles as arenaBattles,
  userToLobby,
  disconnectedPlayers,
  socketToUser,
  pauseBattleTimerIfNoPlayers,
  resumeBattleTimer,
};

export const registerBattleHandlers = (io: Server, socket: Socket): void => {
  setBattleIo(io);
  registerBattleLobbyHandlers(io, socket);
  registerBattleActionHandlers(io, socket);
  registerBattleRematchHandlers(io, socket);
  registerBattleDisconnectHandler(io, socket);
};
