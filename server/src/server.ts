// src/server.ts
import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import { registerAuthHandlers } from "./lib/auth";
import { registerKingdomHandlers } from "./handlers/kingdom.handler";
import { registerMatchHandlers } from "./handlers/match.handler";
import { registerWorldMapHandlers } from "./worldmap/handlers/worldmap.handler";
import { registerTurnHandlers } from "./handlers/turn.handler";
import { registerRegentHandlers } from "./handlers/regent.handler";
import { registerHeroHandlers } from "./handlers/hero.handler";
import { registerTroopHandlers } from "./handlers/troop.handler";
import {
  registerBattleHandlers,
  arenaLobbies,
  arenaBattles,
  userToLobby,
  disconnectedPlayers,
  socketToUser,
  initializeArenaState,
} from "./handlers/battle.handler";
import { registerItemsHandlers } from "./handlers/items.handler";
import { registerSummonHandlers } from "./handlers/summon.handler";
import { registerMovementHandlers } from "./handlers/movement.handler";
import { registerCrisisHandlers } from "./handlers/crisis.handler";
import { registerSkillsHandlers } from "./handlers/skills.handler";
import { registerActionHandlers } from "./handlers/action.handler";
import { registerRankingHandlers } from "./handlers/ranking.handler";
import { registerEventHandlers } from "./handlers/event.handler";
import { registerChatHandlers } from "./handlers/chat.handler";
import { initEventService } from "./services/event.service";
import {
  registerSessionHandlers,
  injectArenaRefs,
} from "./handlers/session.handler";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// Inicializar serviço de eventos com instância do Socket.IO
initEventService(io);

app.get("/", (req, res) => {
  res.send("Backend Battle Realm (Modular) Online!");
});

// Função principal de inicialização
async function bootstrap() {
  // 1. Inicializar estado da arena do banco ANTES de aceitar conexões
  await initializeArenaState();

  // 2. Injetar referências da arena no session handler (após inicialização)
  injectArenaRefs(
    arenaLobbies,
    arenaBattles,
    userToLobby,
    disconnectedPlayers,
    socketToUser
  );

  // 3. Configurar handlers de conexão
  let connectionCount = 0;

  io.on("connection", (socket: Socket) => {
    connectionCount++;
    console.log(
      `[SOCKET] Nova conexão (${connectionCount} ativos): ${socket.id}`
    );

    // Handler de ping/pong para manter conexão ativa
    socket.on("ping", () => {
      socket.emit("pong");
    });

    registerAuthHandlers(io, socket);
    registerSessionHandlers(io, socket); // Deve vir logo após auth
    registerKingdomHandlers(io, socket);
    registerMatchHandlers(io, socket);
    registerWorldMapHandlers(io, socket);
    registerTurnHandlers(io, socket);
    registerRegentHandlers(io, socket);
    registerHeroHandlers(io, socket);
    registerTroopHandlers(io, socket);
    registerBattleHandlers(io, socket);
    registerItemsHandlers(io, socket);
    registerSummonHandlers(io, socket);
    registerMovementHandlers(io, socket);
    registerCrisisHandlers(io, socket);
    registerSkillsHandlers(io, socket);
    registerActionHandlers(io, socket);
    registerRankingHandlers(io, socket);
    registerEventHandlers(io, socket);
    registerChatHandlers(io, socket);

    socket.on("disconnect", () => {
      connectionCount--;
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[SOCKET] Desconectou (${connectionCount} ativos): ${socket.id}`
        );
      }
    });
  });

  // 4. Iniciar servidor
  const PORT = 3000;
  server.listen(PORT, () => {
    console.log(`Servidor Modular rodando na porta ${PORT}`);
  });
}

// Iniciar aplicação
bootstrap().catch((err) => {
  console.error("❌ Falha ao iniciar servidor:", err);
  process.exit(1);
});
