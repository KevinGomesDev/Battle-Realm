// src/handlers/summon.handler.ts
import { Server, Socket } from "socket.io";
import { prisma } from "../lib/prisma";
import { createSummonedCreature } from "../utils/army/summon.utils";

export const registerSummonHandlers = (io: Server, socket: Socket) => {
  // Create a summoned creature (linked to summoner or regent by default)
  socket.on(
    "summon:create_creature",
    async ({
      matchId,
      ownerId,
      kingdomId,
      summonerUnitId,
      level = 1,
      name,
    }) => {
      try {
        if (!matchId)
          return socket.emit("error", { message: "matchId requerido" });
        const result = await createSummonedCreature({
          matchId,
          ownerId,
          kingdomId,
          summonerUnitId,
          level,
          name,
        });
        if (!result.success)
          return socket.emit("error", { message: result.message });

        io.to(matchId).emit("summon:creature_created", { unit: result.unit });
      } catch (err: any) {
        socket.emit("error", {
          message: err?.message || "Erro ao invocar criatura",
        });
      }
    }
  );

  // List summons of a given unit (summoner)
  socket.on("summon:list_by_summoner", async ({ summonerUnitId }) => {
    try {
      if (!summonerUnitId)
        return socket.emit("error", { message: "summonerUnitId requerido" });
      const summons = await prisma.unit.findMany({
        where: { summonerId: summonerUnitId, category: "SUMMON" },
      });
      socket.emit("summon:summons", { summonerUnitId, summons });
    } catch (err: any) {
      socket.emit("error", {
        message: err?.message || "Erro ao listar invocações",
      });
    }
  });
};
