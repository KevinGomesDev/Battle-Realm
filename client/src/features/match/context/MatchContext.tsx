import React, {
  createContext,
  useReducer,
  useCallback,
  useContext,
} from "react";
import type {
  MatchState,
  MatchContextType,
  MatchAction,
  Match,
  OpenMatch,
  PreparationData,
  MatchMapData,
  CompleteMatchState,
} from "../types/match.types";
import { socketService } from "../../../services/socket.service";
import { AuthContext } from "../../auth/context/AuthContext";
import { KingdomContext } from "../../kingdom/context/KingdomContext";

const initialState: MatchState = {
  currentMatch: null,
  openMatches: [],
  preparationData: null,
  matchMapData: null,
  completeMatchState: null,
  myPlayerId: null,
  isMyTurn: false,
  waitingForPlayers: [],
  isLoading: false,
  error: null,
};

function matchReducer(state: MatchState, action: MatchAction): MatchState {
  switch (action.type) {
    case "SET_MATCH":
      return { ...state, currentMatch: action.payload };
    case "SET_OPEN_MATCHES":
      return { ...state, openMatches: action.payload };
    case "SET_PREPARATION_DATA":
      return { ...state, preparationData: action.payload };
    case "SET_MATCH_MAP_DATA":
      return { ...state, matchMapData: action.payload };
    case "SET_COMPLETE_MATCH_STATE":
      return { ...state, completeMatchState: action.payload };
    case "SET_MY_PLAYER_ID":
      return { ...state, myPlayerId: action.payload };
    case "SET_IS_MY_TURN":
      return { ...state, isMyTurn: action.payload };
    case "SET_WAITING_FOR_PLAYERS":
      return { ...state, waitingForPlayers: action.payload };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "RESET":
      // Limpa sessionStorage quando reseta o contexto
      sessionStorage.removeItem("currentMatchId");
      return initialState;
    default:
      return state;
  }
}

export const MatchContext = createContext<MatchContextType | undefined>(
  undefined
);

export function MatchProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(matchReducer, initialState);
  const authContext = useContext(AuthContext);
  const kingdomContext = useContext(KingdomContext);

  const userId = authContext?.state.user?.id;
  const kingdomId = kingdomContext?.state.kingdom?.id;

  const listOpenMatches = useCallback(async (): Promise<OpenMatch[]> => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      socketService.emit("match:list_open");

      const matches = await new Promise<OpenMatch[]>((resolve, reject) => {
        let timeoutId: ReturnType<typeof setTimeout>;

        const successHandler = (data: OpenMatch[]) => {
          clearTimeout(timeoutId);
          socketService.off("match:list_result", successHandler);
          socketService.off("error", errorHandler);
          resolve(data);
        };

        const errorHandler = (data: { message: string }) => {
          clearTimeout(timeoutId);
          socketService.off("match:list_result", successHandler);
          socketService.off("error", errorHandler);
          reject(new Error(data.message || "Erro ao listar partidas"));
        };

        socketService.on("match:list_result", successHandler);
        socketService.on("error", errorHandler);

        timeoutId = setTimeout(() => {
          socketService.off("match:list_result", successHandler);
          socketService.off("error", errorHandler);
          reject(new Error("Timeout ao listar partidas"));
        }, 10000);
      });

      dispatch({ type: "SET_OPEN_MATCHES", payload: matches });
      dispatch({ type: "SET_LOADING", payload: false });
      return matches;
    } catch (error: any) {
      dispatch({
        type: "SET_ERROR",
        payload: error?.message || "Erro ao listar partidas",
      });
      dispatch({ type: "SET_LOADING", payload: false });
      throw error;
    }
  }, []);

  const createMatch = useCallback(
    async (selectedKingdomId: string): Promise<{ matchId: string }> => {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      try {
        socketService.emit("match:create", {
          userId,
          kingdomId: selectedKingdomId,
        });

        const result = await new Promise<{ matchId: string }>(
          (resolve, reject) => {
            let timeoutId: ReturnType<typeof setTimeout>;

            const successHandler = (data: { matchId: string }) => {
              clearTimeout(timeoutId);
              socketService.off("match:created_success", successHandler);
              socketService.off("error", errorHandler);
              resolve(data);
            };

            const errorHandler = (data: { message: string }) => {
              clearTimeout(timeoutId);
              socketService.off("match:created_success", successHandler);
              socketService.off("error", errorHandler);
              reject(new Error(data.message || "Erro ao criar partida"));
            };

            socketService.on("match:created_success", successHandler);
            socketService.on("error", errorHandler);

            timeoutId = setTimeout(() => {
              socketService.off("match:created_success", successHandler);
              socketService.off("error", errorHandler);
              reject(new Error("Timeout ao criar partida"));
            }, 10000);
          }
        );

        dispatch({ type: "SET_LOADING", payload: false });
        return result;
      } catch (error: any) {
        dispatch({
          type: "SET_ERROR",
          payload: error?.message || "Erro ao criar partida",
        });
        dispatch({ type: "SET_LOADING", payload: false });
        throw error;
      }
    },
    [userId]
  );

  const joinMatch = useCallback(
    async (matchId: string, selectedKingdomId: string): Promise<void> => {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      try {
        socketService.emit("match:join", {
          matchId,
          userId,
          kingdomId: selectedKingdomId,
        });

        await new Promise<void>((resolve, reject) => {
          let timeoutId: ReturnType<typeof setTimeout>;

          const successHandler = (data: any) => {
            clearTimeout(timeoutId);
            socketService.off("match:preparation_started", successHandler);
            socketService.off("error", errorHandler);
            dispatch({
              type: "SET_MATCH",
              payload: { id: matchId, ...data } as Match,
            });
            resolve();
          };

          const errorHandler = (data: { message: string }) => {
            clearTimeout(timeoutId);
            socketService.off("match:preparation_started", successHandler);
            socketService.off("error", errorHandler);
            reject(new Error(data.message || "Erro ao entrar na partida"));
          };

          socketService.on("match:preparation_started", successHandler);
          socketService.on("error", errorHandler);

          timeoutId = setTimeout(() => {
            socketService.off("match:preparation_started", successHandler);
            socketService.off("error", errorHandler);
            reject(new Error("Timeout ao entrar na partida"));
          }, 15000);
        });

        dispatch({ type: "SET_LOADING", payload: false });
      } catch (error: any) {
        dispatch({
          type: "SET_ERROR",
          payload: error?.message || "Erro ao entrar na partida",
        });
        dispatch({ type: "SET_LOADING", payload: false });
        throw error;
      }
    },
    [userId]
  );

  const getPreparationData = useCallback(
    async (matchId: string): Promise<PreparationData> => {
      dispatch({ type: "SET_LOADING", payload: true });

      try {
        socketService.emit("match:get_preparation_data", {
          matchId,
          userId,
        });

        const data = await new Promise<PreparationData>((resolve, reject) => {
          let timeoutId: ReturnType<typeof setTimeout>;

          const successHandler = (prepData: PreparationData) => {
            clearTimeout(timeoutId);
            socketService.off("match:preparation_data", successHandler);
            socketService.off("error", errorHandler);
            resolve(prepData);
          };

          const errorHandler = (data: { message: string }) => {
            clearTimeout(timeoutId);
            socketService.off("match:preparation_data", successHandler);
            socketService.off("error", errorHandler);
            reject(new Error(data.message || "Erro ao buscar preparação"));
          };

          socketService.on("match:preparation_data", successHandler);
          socketService.on("error", errorHandler);

          timeoutId = setTimeout(() => {
            socketService.off("match:preparation_data", successHandler);
            socketService.off("error", errorHandler);
            reject(new Error("Timeout ao buscar preparação"));
          }, 10000);
        });

        dispatch({ type: "SET_PREPARATION_DATA", payload: data });
        dispatch({ type: "SET_MY_PLAYER_ID", payload: data.playerId });
        dispatch({ type: "SET_LOADING", payload: false });
        return data;
      } catch (error: any) {
        dispatch({ type: "SET_LOADING", payload: false });
        throw error;
      }
    },
    [userId]
  );

  const setPlayerReady = useCallback(
    async (matchId: string): Promise<void> => {
      dispatch({ type: "SET_LOADING", payload: true });

      try {
        socketService.emit("match:player_ready", {
          matchId,
          userId,
        });

        await new Promise<void>((resolve, reject) => {
          let timeoutId: ReturnType<typeof setTimeout>;

          const successHandler = () => {
            clearTimeout(timeoutId);
            socketService.off("match:player_ready_update", successHandler);
            socketService.off("error", errorHandler);
            resolve();
          };

          const errorHandler = (data: { message: string }) => {
            clearTimeout(timeoutId);
            socketService.off("match:player_ready_update", successHandler);
            socketService.off("error", errorHandler);
            reject(new Error(data.message || "Erro ao marcar como pronto"));
          };

          socketService.on("match:player_ready_update", successHandler);
          socketService.on("error", errorHandler);

          timeoutId = setTimeout(() => {
            socketService.off("match:player_ready_update", successHandler);
            socketService.off("error", errorHandler);
            reject(new Error("Timeout ao marcar como pronto"));
          }, 10000);
        });

        dispatch({ type: "SET_LOADING", payload: false });
      } catch (error: any) {
        dispatch({ type: "SET_LOADING", payload: false });
        throw error;
      }
    },
    [userId]
  );

  const startMatch = useCallback(
    async (playerIds: string[]): Promise<void> => {
      dispatch({ type: "SET_LOADING", payload: true });

      try {
        socketService.emit("match:start", {
          players: playerIds.map((id) => ({
            playerId: id,
            kingdomId,
          })),
        });

        const match = await new Promise<Match>((resolve, reject) => {
          const successHandler = (data: Match) => {
            socketService.off("match:started", successHandler);
            socketService.off("error", errorHandler);
            resolve(data);
          };

          const errorHandler = (data: { message: string }) => {
            socketService.off("match:started", successHandler);
            socketService.off("error", errorHandler);
            reject(new Error(data.message));
          };

          socketService.on("match:started", successHandler);
          socketService.on("error", errorHandler);

          setTimeout(
            () => reject(new Error("Timeout ao iniciar partida")),
            10000
          );
        });

        dispatch({ type: "SET_MATCH", payload: match });
        dispatch({ type: "SET_LOADING", payload: false });
      } catch (error: any) {
        dispatch({
          type: "SET_ERROR",
          payload: error?.message || "Erro ao iniciar partida",
        });
        dispatch({ type: "SET_LOADING", payload: false });
        throw error;
      }
    },
    [kingdomId]
  );

  const loadMatch = useCallback(async (matchId: string): Promise<void> => {
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      socketService.emit("match:load", { matchId });

      const mapData = await new Promise<MatchMapData>((resolve, reject) => {
        let timeoutId: ReturnType<typeof setTimeout>;

        const successHandler = (data: MatchMapData) => {
          clearTimeout(timeoutId);
          socketService.off("match:map_data", successHandler);
          socketService.off("error", errorHandler);
          resolve(data);
        };

        const errorHandler = (data: { message: string }) => {
          clearTimeout(timeoutId);
          socketService.off("match:map_data", successHandler);
          socketService.off("error", errorHandler);
          reject(new Error(data.message || "Erro ao carregar partida"));
        };

        socketService.on("match:map_data", successHandler);
        socketService.on("error", errorHandler);

        timeoutId = setTimeout(() => {
          socketService.off("match:map_data", successHandler);
          socketService.off("error", errorHandler);
          reject(new Error("Timeout ao carregar partida"));
        }, 10000);
      });

      // Construir Match a partir dos dados do mapa
      const match: Match = {
        id: matchId,
        status: mapData.status as any,
        startDate: new Date().toISOString(),
        turnCount: 0,
        maxPlayers: mapData.players.length,
      };

      dispatch({ type: "SET_MATCH", payload: match });
      dispatch({ type: "SET_MATCH_MAP_DATA", payload: mapData });
      dispatch({ type: "SET_LOADING", payload: false });
    } catch (error: any) {
      dispatch({
        type: "SET_ERROR",
        payload: error?.message || "Erro ao carregar partida",
      });
      dispatch({ type: "SET_LOADING", payload: false });
      throw error;
    }
  }, []);

  const setMatchMapData = useCallback((data: MatchMapData | null) => {
    dispatch({ type: "SET_MATCH_MAP_DATA", payload: data });
  }, []);

  const setPreparationData = useCallback((data: PreparationData | null) => {
    dispatch({ type: "SET_PREPARATION_DATA", payload: data });
  }, []);

  const requestMapData = useCallback(
    async (matchId?: string): Promise<MatchMapData> => {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      try {
        socketService.emit("match:request_map", { matchId });

        const mapData = await new Promise<MatchMapData>((resolve, reject) => {
          let timeoutId: ReturnType<typeof setTimeout>;

          const successHandler = (data: MatchMapData) => {
            clearTimeout(timeoutId);
            socketService.off("match:map_data", successHandler);
            socketService.off("error", errorHandler);
            resolve(data);
          };

          const errorHandler = (data: { message: string }) => {
            clearTimeout(timeoutId);
            socketService.off("match:map_data", successHandler);
            socketService.off("error", errorHandler);
            reject(new Error(data.message || "Erro ao carregar mapa"));
          };

          socketService.on("match:map_data", successHandler);
          socketService.on("error", errorHandler);

          timeoutId = setTimeout(() => {
            socketService.off("match:map_data", successHandler);
            socketService.off("error", errorHandler);
            reject(new Error("Timeout ao carregar mapa"));
          }, 15000);
        });

        dispatch({ type: "SET_MATCH_MAP_DATA", payload: mapData });
        dispatch({ type: "SET_LOADING", payload: false });
        return mapData;
      } catch (error: any) {
        dispatch({
          type: "SET_ERROR",
          payload: error?.message || "Erro ao carregar mapa",
        });
        dispatch({ type: "SET_LOADING", payload: false });
        throw error;
      }
    },
    []
  );

  // Novo: Requisitar estado completo da partida
  const requestMatchState = useCallback(
    async (matchId: string): Promise<void> => {
      try {
        socketService.emit("match:request_state", { matchId });
      } catch (error: any) {
        console.error("Erro ao requisitar estado:", error);
      }
    },
    []
  );

  // Novo: Terminar turno
  const finishTurn = useCallback(
    async (matchId: string, playerId: string): Promise<void> => {
      try {
        socketService.emit("turn:finish_turn", {
          matchId,
          playerId,
        });
        // Estado será atualizado via match:state_updated
      } catch (error: any) {
        dispatch({
          type: "SET_ERROR",
          payload: error?.message || "Erro ao terminar turno",
        });
        throw error;
      }
    },
    []
  );

  // Listener para o novo sistema de broadcast
  React.useEffect(() => {
    const handleMatchStateUpdated = (completeState: CompleteMatchState) => {
      // Atualizar estado completo
      dispatch({ type: "SET_COMPLETE_MATCH_STATE", payload: completeState });

      // Persistir matchId no sessionStorage para reconexão
      sessionStorage.setItem("currentMatchId", completeState.matchId);

      // Calcular se é minha vez
      if (userId && state.myPlayerId) {
        const isMyTurn = completeState.activePlayerIds.includes(
          state.myPlayerId
        );
        dispatch({ type: "SET_IS_MY_TURN", payload: isMyTurn });

        // Calcular quem está esperando
        const waitingPlayers = completeState.players
          .filter((p) => completeState.activePlayerIds.includes(p.id))
          .filter((p) => !p.hasFinishedCurrentTurn)
          .map((p) => p.username);

        dispatch({ type: "SET_WAITING_FOR_PLAYERS", payload: waitingPlayers });
      }
    };

    socketService.on("match:state_updated", handleMatchStateUpdated);

    return () => {
      socketService.off("match:state_updated", handleMatchStateUpdated);
    };
  }, [userId, state.myPlayerId]);

  // Listener para reconexão - sincroniza automaticamente
  React.useEffect(() => {
    const handleReconnect = () => {
      // Tenta recuperar matchId do sessionStorage ou do estado
      const matchId =
        state.completeMatchState?.matchId ||
        sessionStorage.getItem("currentMatchId");

      if (matchId) {
        requestMatchState(matchId);
        requestMapData(matchId);
      }
    };

    socketService.on("reconnect", handleReconnect);

    return () => {
      socketService.off("reconnect", handleReconnect);
    };
  }, [state.completeMatchState?.matchId, requestMatchState, requestMapData]);

  const contextValue: MatchContextType = {
    state,
    listOpenMatches,
    createMatch,
    joinMatch,
    getPreparationData,
    requestMapData,
    requestMatchState,
    setPlayerReady,
    finishTurn,
    startMatch,
    loadMatch,
    setMatchMapData,
    setPreparationData,
  };

  return (
    <MatchContext.Provider value={contextValue}>
      {children}
    </MatchContext.Provider>
  );
}
