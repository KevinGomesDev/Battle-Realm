import React, { useEffect, useState } from "react";
import { useMatch } from "../../match";
import { useAuth } from "../../auth";
import { KingdomSection } from "../../../components/Dashboard";
import { MatchStatusDisplay } from "../../match/components/MatchStatusDisplay";
import { socketService } from "../../../services/socket.service";
import type { Territory } from "../types/map.types";
import type { AvailableStructure } from "./TerritoryModal";

interface RightSidebarProps {
  /** Território selecionado para exibir modal de construção */
  selectedTerritory?: Territory | null;
  /** Callback para fechar o modal de território */
  onCloseTerritory?: () => void;
}

/**
 * RightSidebar - Sidebar Direita Minimizável do Mapa
 * Exibe informações detalhadas da partida e construções arrastáveis
 */
export const RightSidebar: React.FC<RightSidebarProps> = ({
  selectedTerritory,
  onCloseTerritory,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<"status" | "profile" | "kingdoms">(
    "status"
  );
  const {
    currentMatch,
    completeMatchState,
    preparationData,
    getPreparationData,
    setPlayerReady,
    isLoading,
  } = useMatch();
  const { user } = useAuth();

  const matchId = completeMatchState?.matchId || currentMatch?.id || "";
  const inPreparation =
    completeMatchState?.status === "PREPARATION" ||
    currentMatch?.status === "PREPARATION";
  const inAdministration = completeMatchState?.currentTurn === "ADMINISTRACAO";
  const canBuild = inPreparation || inAdministration;

  const [isReady, setIsReady] = useState<boolean>(false);
  const [structures, setStructures] = useState<AvailableStructure[]>([]);
  const [structuresLoading, setStructuresLoading] = useState(false);

  // Sync ready state when preparation data changes
  useEffect(() => {
    if (preparationData) {
      setIsReady(preparationData.isReady);
    }
  }, [preparationData]);

  // On mount or when entering preparation, fetch prep data and subscribe to updates
  useEffect(() => {
    if (!matchId || !inPreparation) return;
    getPreparationData(matchId).catch(() => {});

    const handleReadyUpdate = () => {
      getPreparationData(matchId).catch(() => {});
    };

    socketService.on("match:player_ready_update", handleReadyUpdate);
    socketService.on("match:preparation_started", handleReadyUpdate);
    return () => {
      socketService.off("match:player_ready_update", handleReadyUpdate);
      socketService.off("match:preparation_started", handleReadyUpdate);
    };
  }, [matchId, inPreparation, getPreparationData]);

  // Fetch available structures when territory modal is open and can build
  useEffect(() => {
    if (!selectedTerritory || !canBuild) {
      setStructures([]);
      return;
    }

    const fetchStructures = async () => {
      setStructuresLoading(true);
      try {
        const available = await new Promise<AvailableStructure[]>(
          (resolve, reject) => {
            let timeoutId: ReturnType<typeof setTimeout>;

            const successHandler = (data: {
              structures: AvailableStructure[];
            }) => {
              clearTimeout(timeoutId);
              socketService.off(
                "preparation:available_structures",
                successHandler
              );
              socketService.off("error", errorHandler);
              resolve(data.structures || []);
            };

            const errorHandler = (data: { message: string }) => {
              clearTimeout(timeoutId);
              socketService.off(
                "preparation:available_structures",
                successHandler
              );
              socketService.off("error", errorHandler);
              reject(new Error(data.message || "Erro ao listar estruturas"));
            };

            socketService.on(
              "preparation:available_structures",
              successHandler
            );
            socketService.on("error", errorHandler);

            socketService.emit("preparation:list_available_structures");

            timeoutId = setTimeout(() => {
              socketService.off(
                "preparation:available_structures",
                successHandler
              );
              socketService.off("error", errorHandler);
              reject(new Error("Timeout ao listar estruturas"));
            }, 10000);
          }
        );

        setStructures(available);
      } catch (err) {
        console.error("Erro ao carregar estruturas:", err);
        setStructures([]);
      } finally {
        setStructuresLoading(false);
      }
    };

    fetchStructures();
  }, [selectedTerritory, canBuild]);

  const handleDragStart = (
    e: React.DragEvent,
    structure: AvailableStructure
  ) => {
    e.dataTransfer.setData("structureType", structure.type);
    e.dataTransfer.setData("structureName", structure.name);
    e.dataTransfer.setData("structureId", structure.id);
    e.dataTransfer.effectAllowed = "copy";
  };

  const getStructureIcon = (type: string) => {
    const icons: Record<string, string> = {
      FARM: "🌾",
      MINE: "⛏️",
      BARRACKS: "🏛️",
      TEMPLE: "⛪",
      TOWER: "🗼",
      WALL: "🧱",
      MARKET: "🏪",
      FORGE: "🔨",
      STABLE: "🐴",
      LIBRARY: "📚",
    };
    return icons[type.toUpperCase()] || "🏗️";
  };

  if (!currentMatch) {
    return null;
  }

  // Se há território selecionado, mostra modo de construção
  const isBuildMode = selectedTerritory && canBuild;

  return (
    <div
      className={`absolute top-16 right-0 bottom-0 z-30 transition-all duration-300 pointer-events-none ${
        isMinimized ? "w-12" : "w-80"
      }`}
    >
      {/* Sidebar Container */}
      <div className="h-full bg-gradient-to-b from-citadel-granite to-citadel-carved border-l-4 border-metal-iron shadow-stone-raised pointer-events-auto flex flex-col">
        {/* Textura de pedra */}
        <div className="absolute inset-0 bg-stone-texture opacity-30 pointer-events-none"></div>

        {/* Botão Voltar (quando modal aberto) OU Toggle Button */}
        {isBuildMode ? (
          <button
            onClick={onCloseTerritory}
            className="relative z-10 w-full py-3 bg-gradient-to-b from-war-crimson to-war-blood border-b-2 border-metal-iron hover:from-war-ember hover:to-war-crimson transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-parchment-light text-lg">←</span>
            <span
              className="text-parchment-light font-bold tracking-wider"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              VOLTAR
            </span>
          </button>
        ) : (
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="relative z-10 w-full py-3 bg-citadel-carved border-b-2 border-metal-iron hover:bg-citadel-weathered transition-colors"
          >
            <span className="text-parchment-light text-lg">
              {isMinimized ? "◀" : "▶"}
            </span>
          </button>
        )}

        {!isMinimized && (
          <>
            {/* Modo Construção */}
            {isBuildMode ? (
              <div className="relative z-10 flex-1 overflow-y-auto p-4">
                {/* Header do território */}
                <div className="bg-citadel-carved border-2 border-metal-iron rounded-lg p-3 shadow-stone-inset mb-4">
                  <h3
                    className="text-parchment-light font-bold text-sm mb-1 tracking-wider"
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    CONSTRUIR EM
                  </h3>
                  <div className="text-parchment-aged text-xs">
                    Território #{selectedTerritory.mapIndex} •{" "}
                    {selectedTerritory.terrainType}
                  </div>
                  <div className="text-parchment-aged text-xs mt-1">
                    Áreas: {selectedTerritory.usedSlots}/
                    {selectedTerritory.areaSlots}
                  </div>
                  {inPreparation && preparationData && (
                    <div className="text-metal-gold text-xs mt-2 font-bold">
                      Construções gratuitas:{" "}
                      {preparationData.freeBuildingsRemaining}
                    </div>
                  )}
                </div>

                {/* Lista de estruturas arrastáveis */}
                <div className="bg-citadel-carved border-2 border-metal-iron rounded-lg p-3 shadow-stone-inset">
                  <h3
                    className="text-parchment-light font-bold text-sm mb-3 tracking-wider"
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    ESTRUTURAS DISPONÍVEIS
                  </h3>

                  {structuresLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="w-8 h-8 border-3 border-war-crimson border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : structures.length === 0 ? (
                    <div className="text-parchment-aged text-xs text-center py-4">
                      Nenhuma estrutura disponível.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {structures.map((structure) => (
                        <div
                          key={structure.id || structure.type}
                          draggable
                          onDragStart={(e) => handleDragStart(e, structure)}
                          className="flex items-center gap-3 p-3 bg-citadel-slate/50 border-2 border-metal-iron/50 rounded-lg cursor-grab hover:bg-citadel-slate hover:border-metal-iron active:cursor-grabbing transition-all"
                        >
                          <div className="w-10 h-10 bg-citadel-carved border-2 border-metal-iron rounded-lg flex items-center justify-center shadow-stone-inset">
                            <span className="text-xl">
                              {getStructureIcon(structure.type)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-parchment-light font-semibold text-sm truncate">
                              {structure.name}
                            </div>
                            {structure.description && (
                              <div className="text-parchment-aged text-[10px] truncate">
                                {structure.description}
                              </div>
                            )}
                            {structure.cost && (
                              <div className="text-metal-gold text-[10px]">
                                {Object.entries(structure.cost)
                                  .map(([k, v]) => `${v} ${k}`)
                                  .join(", ")}
                              </div>
                            )}
                          </div>
                          <div className="text-parchment-dark text-xs">⋮⋮</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-parchment-dark/60 text-[10px] text-center mt-3">
                    Arraste uma estrutura para uma área vazia do território.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Tabs normais */}
                <div className="relative z-10 flex border-b-2 border-metal-iron bg-citadel-slate">
                  <button
                    onClick={() => setActiveTab("status")}
                    className={`flex-1 py-2 text-xs font-semibold tracking-wide transition-colors ${
                      activeTab === "status"
                        ? "bg-war-crimson text-parchment-light"
                        : "text-parchment-aged hover:bg-citadel-weathered"
                    }`}
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    STATUS
                  </button>
                  <button
                    onClick={() => setActiveTab("profile")}
                    className={`flex-1 py-2 text-xs font-semibold tracking-wide transition-colors ${
                      activeTab === "profile"
                        ? "bg-war-crimson text-parchment-light"
                        : "text-parchment-aged hover:bg-citadel-weathered"
                    }`}
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    PROFILE
                  </button>
                  <button
                    onClick={() => setActiveTab("kingdoms")}
                    className={`flex-1 py-2 text-xs font-semibold tracking-wide transition-colors ${
                      activeTab === "kingdoms"
                        ? "bg-war-crimson text-parchment-light"
                        : "text-parchment-aged hover:bg-citadel-weathered"
                    }`}
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    KINGDOMS
                  </button>
                </div>

                {/* Content */}
                <div className="relative z-10 flex-1 overflow-y-auto p-4">
                  {activeTab === "status" && (
                    <div className="space-y-4">
                      <div className="bg-citadel-carved border-2 border-metal-iron rounded-lg p-3 shadow-stone-inset">
                        <h3
                          className="text-parchment-light font-bold text-sm mb-2 tracking-wider"
                          style={{ fontFamily: "'Cinzel', serif" }}
                        >
                          MATCH STATUS
                        </h3>
                        <MatchStatusDisplay />
                      </div>

                      {/* Info Adicional */}
                      <div className="bg-citadel-carved border-2 border-metal-iron rounded-lg p-3 shadow-stone-inset">
                        <h3
                          className="text-parchment-light font-bold text-sm mb-2 tracking-wider"
                          style={{ fontFamily: "'Cinzel', serif" }}
                        >
                          TURN INFO
                        </h3>
                        <div className="text-parchment-aged text-xs space-y-1">
                          <div className="flex justify-between">
                            <span>Round:</span>
                            <span className="text-parchment-light font-bold">
                              {completeMatchState?.currentRound || "1"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Turn:</span>
                            <span className="text-parchment-light font-bold">
                              {completeMatchState?.currentTurn ||
                                currentMatch.status}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Status:</span>
                            <span className="text-green-400 font-bold">
                              {currentMatch.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Preparation Controls */}
                      {inPreparation && (
                        <div className="bg-citadel-carved border-2 border-metal-iron rounded-lg p-3 shadow-stone-inset space-y-3">
                          <h3
                            className="text-parchment-light font-bold text-sm tracking-wider"
                            style={{ fontFamily: "'Cinzel', serif" }}
                          >
                            PREPARATION
                          </h3>
                          {preparationData && (
                            <div className="text-parchment-aged text-xs space-y-1">
                              <div className="flex justify-between">
                                <span>Free builds:</span>
                                <span className="text-parchment-light font-bold">
                                  {preparationData.freeBuildingsRemaining}
                                </span>
                              </div>
                              {preparationData.capital && (
                                <div className="flex justify-between">
                                  <span>Capital:</span>
                                  <span className="text-parchment-light font-bold">
                                    {preparationData.capital.name}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          <p className="text-parchment-dark/60 text-[11px] text-center">
                            Clique em um território seu para construir.
                          </p>

                          <button
                            onClick={() =>
                              matchId &&
                              setPlayerReady(matchId)
                                .then(() => setIsReady(true))
                                .catch(() => {})
                            }
                            disabled={
                              isReady ||
                              isLoading ||
                              (preparationData?.freeBuildingsRemaining ?? 0) > 0
                            }
                            className={`group relative w-full px-4 py-3 rounded-lg transition-all flex items-center justify-center gap-2 border-2 ${
                              isReady ||
                              (preparationData?.freeBuildingsRemaining ?? 0) > 0
                                ? "bg-slate-600/80 border-slate-500 cursor-not-allowed"
                                : "bg-gradient-to-b from-war-crimson to-war-blood border-metal-iron shadow-forge-glow hover:from-war-ember hover:to-war-crimson active:animate-stone-press"
                            }`}
                          >
                            <div className="absolute top-1 left-1 w-2 h-2 bg-metal-iron rounded-full"></div>
                            <div className="absolute top-1 right-1 w-2 h-2 bg-metal-iron rounded-full"></div>
                            <div className="absolute bottom-1 left-1 w-2 h-2 bg-metal-iron rounded-full"></div>
                            <div className="absolute bottom-1 right-1 w-2 h-2 bg-metal-iron rounded-full"></div>
                            {isLoading ? (
                              <span className="text-parchment-light font-bold flex items-center gap-2">
                                <div className="animate-spin w-4 h-4 border-2 border-parchment-light border-t-transparent rounded-full"></div>
                                Preparando...
                              </span>
                            ) : isReady ? (
                              <span className="text-parchment-light font-bold">
                                ✅ Pronto para Batalha!
                              </span>
                            ) : (preparationData?.freeBuildingsRemaining ?? 0) >
                              0 ? (
                              <span className="text-parchment-light font-bold text-xs text-center">
                                Coloque{" "}
                                {preparationData?.freeBuildingsRemaining}{" "}
                                construções gratuitas.
                              </span>
                            ) : (
                              <span
                                className="text-parchment-light font-bold tracking-wider"
                                style={{ fontFamily: "'Cinzel', serif" }}
                              >
                                ⚔️ ESTOU PRONTO!
                              </span>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "profile" && user && (
                    <div className="bg-citadel-carved border-2 border-metal-iron rounded-lg p-3 shadow-stone-inset">
                      <div className="text-center">
                        <div
                          className="text-parchment-light font-bold text-lg tracking-wider mb-2"
                          style={{ fontFamily: "'Cinzel', serif" }}
                        >
                          {user.username}
                        </div>
                        <div className="text-parchment-aged text-xs">
                          Commander
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "kingdoms" && (
                    <div>
                      <KingdomSection />
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
