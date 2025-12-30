// src/handlers/action.handler.ts
import { Socket, Server } from "socket.io";
import { prisma } from "../lib/prisma";
import { TurnType, UnitCategory } from "../types";
import {
  calculateConquestCost,
  validateConquestRequirements,
  processConquestEvent,
  ConquestAttribute,
} from "../utils/conquest.utils";

export const registerActionHandlers = (io: Server, socket: Socket) => {
  // --- CONQUISTA TERRITORIAL ---
  // Ação do 5º Turno (Turno de Ação) para conquistar territórios selvagens
  socket.on(
    "action:conquest_territory",
    async ({ matchId, playerId, territoryId }) => {
      try {
        // 1. Verificar se a partida existe e está no turno de ação
        const match = await prisma.match.findUnique({
          where: { id: matchId },
        });

        if (!match) {
          socket.emit("error", { message: "Partida não encontrada." });
          return;
        }

        if (match.currentTurn !== TurnType.ACAO) {
          socket.emit("error", {
            message:
              "Conquista territorial só pode ser realizada no Turno de Ação.",
          });
          return;
        }

        // 2. Buscar território
        const territory = await prisma.territory.findUnique({
          where: { id: territoryId },
        });

        if (!territory) {
          socket.emit("error", { message: "Território não encontrado." });
          return;
        }

        if (territory.matchId !== matchId) {
          socket.emit("error", {
            message: "Território não pertence a esta partida.",
          });
          return;
        }

        // 3. Verificar se é território selvagem (não dominado)
        if (territory.ownerId !== null) {
          socket.emit("error", {
            message: "Este território já está dominado.",
          });
          return;
        }

        // 4. Buscar jogador
        const player = await prisma.matchPlayer.findUnique({
          where: { id: playerId },
        });

        if (!player) {
          socket.emit("error", { message: "Jogador não encontrado." });
          return;
        }

        // 5. Buscar unidades do jogador no território
        const unitsInTerritory = await prisma.unit.findMany({
          where: {
            matchId,
            ownerId: playerId,
            locationIndex: territory.mapIndex,
          },
        });

        const unitCount = unitsInTerritory.length;
        const hasHeroOrRegent = unitsInTerritory.some(
          (u) =>
            u.category === UnitCategory.HERO ||
            u.category === UnitCategory.REGENT
        );

        // 6. Calcular custo (quantidade de territórios já dominados)
        const ownedTerritories = await prisma.territory.count({
          where: {
            matchId,
            ownerId: playerId,
          },
        });

        const cost = calculateConquestCost(ownedTerritories);

        // 7. Parse recursos do jogador
        let resources: {
          ore: number;
          supplies: number;
          arcane: number;
          experience: number;
          devotion: number;
        };
        try {
          resources = JSON.parse(player.resources);
        } catch {
          resources = {
            ore: 0,
            supplies: 0,
            arcane: 0,
            experience: 0,
            devotion: 0,
          };
        }

        // 8. Validar requisitos
        const validation = validateConquestRequirements(
          unitCount,
          hasHeroOrRegent,
          resources,
          cost
        );

        if (!validation.valid) {
          socket.emit("error", { message: validation.reason });
          return;
        }

        // 9. Deduzir custo em minério
        resources.ore -= cost;

        await prisma.matchPlayer.update({
          where: { id: playerId },
          data: { resources: JSON.stringify(resources) },
        });

        // 10. Encontrar líder (Herói ou Regente) para os testes
        const leader = unitsInTerritory.find(
          (u) =>
            u.category === UnitCategory.HERO ||
            u.category === UnitCategory.REGENT
        );

        // Pegar atributos do líder para os testes
        const leaderAttributes: Record<ConquestAttribute, number> = {
          combat: leader?.combat ?? 1,
          acuity: leader?.acuity ?? 1,
          focus: leader?.focus ?? 1,
          armor: leader?.armor ?? 1,
          vitality: leader?.vitality ?? 1,
        };

        // 11. Processar evento de conquista
        const conquestResult = processConquestEvent(leaderAttributes);

        // 12. Atualizar medidor de crise se houve falhas
        if (conquestResult.crisisIncrease > 0) {
          await prisma.match.update({
            where: { id: matchId },
            data: {
              crisisMeter: { increment: conquestResult.crisisIncrease },
            },
          });
        }

        // 13. Conquistar território (sempre ocorre, independente do evento)
        const updatedTerritory = await prisma.territory.update({
          where: { id: territoryId },
          data: {
            ownerId: playerId,
          },
        });

        // 14. Montar resposta detalhada
        const response = {
          success: true,
          territory: {
            id: updatedTerritory.id,
            mapIndex: updatedTerritory.mapIndex,
            type: updatedTerritory.type,
            terrainType: updatedTerritory.terrainType,
            ownerId: updatedTerritory.ownerId,
          },
          conquest: {
            cost,
            unitCount,
            leaderId: leader?.id,
            leaderName: leader?.name ?? `${leader?.category}`,
          },
          event: conquestResult.eventTriggered
            ? {
                triggered: true,
                triggerRoll: conquestResult.eventTriggerRoll,
                eventId: conquestResult.event?.id,
                eventName: conquestResult.event?.name,
                eventEffect: conquestResult.overallSuccess
                  ? conquestResult.event?.successEffect
                  : null,
                tests: conquestResult.attributeTests.map((t) => ({
                  attribute: t.attribute,
                  roll: t.roll,
                  attributeValue: t.attributeValue,
                  total: t.total,
                  cd: t.cd,
                  success: t.success,
                })),
                overallSuccess: conquestResult.overallSuccess,
                crisisIncrease: conquestResult.crisisIncrease,
              }
            : {
                triggered: false,
                triggerRoll: conquestResult.eventTriggerRoll,
              },
          message: conquestResult.eventTriggered
            ? conquestResult.overallSuccess
              ? `Território conquistado! Evento "${conquestResult.event?.name}" concluído com sucesso!`
              : `Território conquistado, mas o evento "${conquestResult.event?.name}" falhou. Medidor de Crise +${conquestResult.crisisIncrease}.`
            : "Território conquistado sem encontrar eventos!",
        };

        // Emitir para o jogador
        socket.emit("action:conquest_result", response);

        // Notificar todos os jogadores da partida
        io.to(matchId).emit("territory:conquered", {
          territoryId: updatedTerritory.id,
          mapIndex: updatedTerritory.mapIndex,
          newOwnerId: playerId,
          crisisMeter: match.crisisMeter + conquestResult.crisisIncrease,
        });

        console.log(
          `[ACTION] Jogador ${playerId} conquistou território ${
            territory.mapIndex
          } por ${cost} minério${
            conquestResult.eventTriggered
              ? ` (Evento: ${conquestResult.event?.name})`
              : ""
          }`
        );
      } catch (error) {
        console.error("[ACTION] Erro na conquista territorial:", error);
        socket.emit("error", {
          message: "Erro ao processar conquista territorial.",
        });
      }
    }
  );

  // --- LISTAR TERRITÓRIOS CONQUISTÁVEIS ---
  // Retorna territórios selvagens onde o jogador pode tentar conquista
  socket.on(
    "action:list_conquerable_territories",
    async ({ matchId, playerId }) => {
      try {
        // Buscar territórios selvagens
        const wildTerritories = await prisma.territory.findMany({
          where: {
            matchId,
            ownerId: null,
          },
        });

        // Para cada território, verificar se o jogador tem unidades suficientes
        const result = await Promise.all(
          wildTerritories.map(async (t) => {
            const unitsInTerritory = await prisma.unit.findMany({
              where: {
                matchId,
                ownerId: playerId,
                locationIndex: t.mapIndex,
              },
            });

            const unitCount = unitsInTerritory.length;
            const hasLeader = unitsInTerritory.some(
              (u) =>
                u.category === UnitCategory.HERO ||
                u.category === UnitCategory.REGENT
            );

            return {
              territoryId: t.id,
              mapIndex: t.mapIndex,
              type: t.type,
              terrainType: t.terrainType,
              unitCount,
              hasLeader,
              canConquer: unitCount >= 3 && hasLeader,
            };
          })
        );

        // Calcular custo atual
        const ownedCount = await prisma.territory.count({
          where: { matchId, ownerId: playerId },
        });
        const cost = calculateConquestCost(ownedCount);

        socket.emit("action:conquerable_territories", {
          territories: result.filter((t) => t.unitCount > 0), // Só mostrar onde tem unidades
          conquestCost: cost,
        });
      } catch (error) {
        console.error(
          "[ACTION] Erro ao listar territórios conquistáveis:",
          error
        );
        socket.emit("error", {
          message: "Erro ao listar territórios conquistáveis.",
        });
      }
    }
  );
};
