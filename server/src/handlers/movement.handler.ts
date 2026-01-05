// src/handlers/movement.handler.ts
import { Socket, Server } from "socket.io";
import { prisma } from "../lib/prisma";
import { TurnType } from "../types";
import {
  moveUnit,
  validateMovement,
  getUnitMovementInfo,
  getAdjacentTerritories,
  getUnitsInTerritory,
} from "../utils/movement.utils";

interface MovementPayload {
  matchId: string;
  playerId: string;
  unitId: string;
  sourceTerritory: number;
  destinationTerritory: number;
}

export const registerMovementHandlers = (io: Server, socket: Socket) => {
  // --- MOVER UNIDADE ---
  socket.on(
    "movement:move_unit",
    async ({
      matchId,
      playerId,
      unitId,
      sourceTerritory,
      destinationTerritory,
    }: MovementPayload) => {
      try {
        const match = await prisma.match.findUnique({
          where: { id: matchId },
        });

        if (!match) {
          socket.emit("error", { message: "Partida não encontrada" });
          return;
        }

        // Verifica se está no turno de movimentação
        if (match.currentTurn !== TurnType.MOVIMENTACAO) {
          socket.emit("error", {
            message: "Movimento só pode ser feito no Turno de Movimentação",
          });
          return;
        }

        const result = await moveUnit(
          unitId,
          sourceTerritory,
          destinationTerritory,
          playerId,
          matchId
        );

        if (result.success) {
          const player = await prisma.matchKingdom.findUnique({
            where: { id: playerId },
          });
          const resources = JSON.parse(player!.resources);

          socket.emit("movement:unit_moved", {
            message: result.message,
            unit: result.unit,
            resources,
          });

          // Notifica todos na partida sobre o movimento
          io.to(matchId).emit("unit:moved", {
            unitId: result.unit!.id,
            playerId,
            sourceTerritory,
            destinationTerritory,
            unit: result.unit,
          });
        } else {
          socket.emit("error", { message: result.message });
        }
      } catch (error) {
        console.error("[MOVEMENT] Erro ao mover unidade:", error);
        socket.emit("error", { message: "Erro ao mover unidade" });
      }
    }
  );

  // --- VALIDAR MOVIMENTO (sem cobrar custo) ---
  socket.on(
    "movement:validate",
    async ({
      matchId,
      playerId,
      unitId,
      sourceTerritory,
      destinationTerritory,
    }: MovementPayload) => {
      try {
        const validation = await validateMovement(
          unitId,
          sourceTerritory,
          destinationTerritory,
          playerId
        );

        socket.emit("movement:validation_result", {
          valid: validation.valid,
          reason: validation.reason,
          cost: validation.cost,
        });
      } catch (error) {
        console.error("[MOVEMENT] Erro ao validar movimento:", error);
        socket.emit("error", { message: "Erro ao validar movimento" });
      }
    }
  );

  // --- OBTER INFO DE MOVIMENTO DE UMA UNIDADE ---
  socket.on("movement:get_unit_info", async ({ playerId, unitId }) => {
    try {
      const info = await getUnitMovementInfo(unitId, playerId);

      if (info.canMove) {
        socket.emit("movement:unit_info", {
          currentTerritory: info.currentTerritory,
          adjacentTerritories: info.adjacentTerritories,
        });
      } else {
        socket.emit("error", { message: info.reason });
      }
    } catch (error) {
      console.error("[MOVEMENT] Erro ao obter info:", error);
      socket.emit("error", { message: "Erro ao obter informações" });
    }
  });

  // --- LISTAR UNIDADES EM UM TERRITÓRIO ---
  socket.on(
    "movement:list_units_in_territory",
    async ({ matchId, playerId, territoryIndex }) => {
      try {
        const units = await getUnitsInTerritory(
          matchId,
          playerId,
          territoryIndex
        );

        socket.emit("movement:units_in_territory", {
          territoryIndex,
          units,
          count: units.length,
        });
      } catch (error) {
        console.error("[MOVEMENT] Erro ao listar unidades:", error);
        socket.emit("error", { message: "Erro ao listar unidades" });
      }
    }
  );

  // --- OBTER TERRITÓRIOS ADJACENTES ---
  socket.on(
    "movement:get_adjacent_territories",
    async ({ matchId, territoryIndex }) => {
      try {
        const territories = await getAdjacentTerritories(
          matchId,
          territoryIndex
        );

        socket.emit("movement:adjacent_territories", {
          territoryIndex,
          adjacentTerritories: territories,
        });
      } catch (error) {
        console.error("[MOVEMENT] Erro ao obter adjacentes:", error);
        socket.emit("error", {
          message: "Erro ao obter territórios adjacentes",
        });
      }
    }
  );
};
