// src/server.ts
// Battle Realm Server - Colyseus.io
import express from "express";
import http from "http";
import cors from "cors";
import {
  Server as ColyseusServer,
  matchMaker,
  RoomListingData,
} from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";

// Colyseus Rooms
import { ArenaRoom, GlobalRoom, MatchRoom } from "./colyseus/rooms";

// Database
import { prisma } from "./lib/prisma";

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// ============================================
// COLYSEUS SERVER
// ============================================

const gameServer = new ColyseusServer({
  transport: new WebSocketTransport({
    server,
    pingInterval: 5000,
    pingMaxRetries: 3,
  }),
});

// Registrar rooms do Colyseus
gameServer.define("global", GlobalRoom);
gameServer.define("arena", ArenaRoom);
gameServer.define("match", MatchRoom);

// ============================================
// ENDPOINTS HTTP
// ============================================

app.get("/", (_req, res) => {
  res.json({
    status: "online",
    server: "Battle Realm",
    version: "2.0.0",
    transport: "Colyseus",
    rooms: ["global", "arena", "match"],
  });
});

// Status endpoint
app.get("/status", async (_req, res) => {
  try {
    const rooms = await matchMaker.query({});
    res.json({
      status: "online",
      connectedRooms: rooms.length,
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

// Monitor (apenas dev)
if (process.env.NODE_ENV !== "production") {
  app.use("/monitor", monitor());
  console.log("[Server] Monitor disponível em /monitor");
}

// ============================================
// BOOTSTRAP
// ============================================

async function bootstrap() {
  try {
    // Verificar conexão com banco de dados
    await prisma.$connect();
    console.log("[Database] ✅ Conectado ao banco de dados");

    // Iniciar servidor
    const PORT = parseInt(process.env.PORT || "3000", 10);

    await gameServer.listen(PORT);

    console.log(`[Server] ✅ Servidor rodando na porta ${PORT}`);
    console.log(`[Colyseus] Rooms disponíveis: global, arena, match`);
    console.log(`[Server] Endpoint de status: http://localhost:${PORT}/status`);

    if (process.env.NODE_ENV !== "production") {
      console.log(`[Server] Monitor: http://localhost:${PORT}/monitor`);
    }
  } catch (error) {
    console.error("[Server] ❌ Falha ao iniciar servidor:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[Server] Recebido SIGTERM, encerrando...");
  await gameServer.gracefullyShutdown();
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[Server] Recebido SIGINT, encerrando...");
  await gameServer.gracefullyShutdown();
  await prisma.$disconnect();
  process.exit(0);
});

// Iniciar aplicação
bootstrap().catch((err) => {
  console.error("❌ Falha ao iniciar servidor:", err);
  process.exit(1);
});
