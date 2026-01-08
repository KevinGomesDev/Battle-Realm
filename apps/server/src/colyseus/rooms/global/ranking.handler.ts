// server/src/colyseus/rooms/global/ranking.handler.ts
// Handler de Ranking: busca rankings de jogadores

import { Client } from "@colyseus/core";
import { prisma } from "../../../lib/prisma";

/**
 * Busca ranking de jogadores
 */
export async function handleGetRanking(
  client: Client,
  type: string = "wins",
  limit: number = 10
): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      orderBy:
        type === "wins" ? { battleWins: "desc" } : { battleWins: "desc" },
      take: limit,
      select: {
        id: true,
        username: true,
        battleWins: true,
        battleLosses: true,
        matchWins: true,
        matchLosses: true,
      },
    });

    client.send("ranking:data", {
      type,
      entries: users.map((u, idx) => ({
        rank: idx + 1,
        userId: u.id,
        username: u.username,
        wins: u.battleWins + u.matchWins,
        losses: u.battleLosses + u.matchLosses,
        level: 1, // Level não existe mais, usar valor padrão
      })),
    });
  } catch (error) {
    client.send("error", { message: "Erro ao buscar ranking" });
  }
}
