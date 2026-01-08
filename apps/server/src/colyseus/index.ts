// server/src/colyseus/index.ts
// Configuração principal do Colyseus

import { Server, matchMaker, RoomListingData } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import express from "express";
import http from "http";

import { BattleRoom, GlobalRoom, MatchRoom } from "./rooms";

export interface ColyseusConfig {
  port?: number;
  enableMonitor?: boolean;
  enablePlayground?: boolean;
}

/**
 * Cria e configura o servidor Colyseus
 */
export function createColyseusServer(config: ColyseusConfig = {}) {
  const {
    port = 2567,
    enableMonitor = process.env.NODE_ENV !== "production",
    enablePlayground = process.env.NODE_ENV !== "production",
  } = config;

  const app = express();
  const server = http.createServer(app);

  // Criar servidor Colyseus
  const gameServer = new Server({
    transport: new WebSocketTransport({
      server,
      pingInterval: 5000,
      pingMaxRetries: 3,
    }),
  });

  // Registrar rooms
  gameServer.define("global", GlobalRoom);
  gameServer.define("battle", BattleRoom);
  gameServer.define("match", MatchRoom);

  // Endpoints de desenvolvimento
  if (enableMonitor) {
    app.use("/monitor", monitor());
    console.log(`[Colyseus] Monitor habilitado em /monitor`);
  }

  // Health check
  app.get("/", (_req, res) => {
    res.json({
      status: "online",
      server: "Battle Realm - Colyseus",
      version: "1.0.0",
      rooms: ["global", "battle", "match"],
    });
  });

  // Endpoint de status
  app.get("/status", async (_req, res) => {
    try {
      const rooms = await matchMaker.query({});
      res.json({
        status: "online",
        rooms: rooms.map((r: RoomListingData) => ({
          roomId: r.roomId,
          name: r.name,
          clients: r.clients,
          maxClients: r.maxClients,
          metadata: r.metadata,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Erro ao obter status" });
    }
  });

  return {
    app,
    server,
    gameServer,
    port,

    /**
     * Inicia o servidor Colyseus
     */
    async start() {
      await gameServer.listen(port);
      console.log(`[Colyseus] Servidor rodando na porta ${port}`);
      console.log(`[Colyseus] Rooms disponíveis: global, battle, match`);
      return { app, server, gameServer };
    },

    /**
     * Para o servidor Colyseus
     */
    async stop() {
      await gameServer.gracefullyShutdown();
      console.log("[Colyseus] Servidor encerrado");
    },
  };
}

// Export types
export * from "./schemas";
export * from "./rooms";
