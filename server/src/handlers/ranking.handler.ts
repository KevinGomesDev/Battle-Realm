// src/handlers/ranking.handler.ts
import { Server, Socket } from "socket.io";
import { PrismaClient } from "@prisma/client";
import type {
  RankingEntry,
  RankingData,
} from "../../../shared/types/ranking.types";

const prisma = new PrismaClient();

export function registerRankingHandlers(io: Server, socket: Socket) {
  // Buscar ranking geral
  socket.on("ranking:get", async () => {
    try {
      // Ranking de Arena - buscar usuários com mais vitórias de arena
      const arenaUsers = await prisma.user.findMany({
        where: { arenaWins: { gt: 0 } },
        orderBy: { arenaWins: "desc" },
        take: 10,
        select: { username: true, arenaWins: true },
      });

      const arenaRanking: RankingEntry[] = arenaUsers.map((user, index) => ({
        rank: index + 1,
        username: user.username,
        victories: user.arenaWins,
      }));

      // Ranking de Partidas - buscar usuários com mais vitórias de partidas
      const matchUsers = await prisma.user.findMany({
        where: { matchWins: { gt: 0 } },
        orderBy: { matchWins: "desc" },
        take: 10,
        select: { username: true, matchWins: true },
      });

      const matchRanking: RankingEntry[] = matchUsers.map((user, index) => ({
        rank: index + 1,
        username: user.username,
        victories: user.matchWins,
      }));

      const ranking: RankingData = {
        arena: arenaRanking,
        match: matchRanking,
      };

      socket.emit("ranking:data", ranking);
    } catch (error) {
      console.error("[RANKING] Erro ao buscar ranking:", error);
      socket.emit("ranking:error", { message: "Erro ao buscar ranking" });
    }
  });
}
