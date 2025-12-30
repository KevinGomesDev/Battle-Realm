import React, {
  createContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { socketService } from "../../../services/socket.service";
import { useAuth } from "../../auth";
import type {
  ArenaState,
  ArenaAction,
  ArenaContextType,
  ArenaLobby,
  ArenaBattle,
  LobbyCreatedResponse,
  LobbiesListResponse,
  PlayerJoinedResponse,
  BattleStartedResponse,
  UnitMovedResponse,
  UnitAttackedResponse,
  BattleEndedResponse,
  ArenaLobbyStatus,
} from "../types/arena.types";

const initialState: ArenaState = {
  lobbies: [],
  currentLobby: null,
  battle: null,
  battleResult: null,
  units: [],
  logs: [],
  isHost: false,
  isLoading: false,
  error: null,
  rematchPending: false,
  opponentWantsRematch: false,
};

function arenaReducer(state: ArenaState, action: ArenaAction): ArenaState {
  switch (action.type) {
    case "SET_LOBBIES":
      return { ...state, lobbies: action.payload };
    case "SET_CURRENT_LOBBY":
      return { ...state, currentLobby: action.payload };
    case "UPDATE_LOBBY_STATUS":
      return {
        ...state,
        currentLobby:
          state.currentLobby?.lobbyId === action.payload.lobbyId
            ? { ...state.currentLobby, status: action.payload.status }
            : state.currentLobby,
        lobbies: state.lobbies.map((l) =>
          l.lobbyId === action.payload.lobbyId
            ? { ...l, status: action.payload.status }
            : l
        ),
      };
    case "SET_BATTLE":
      return { ...state, battle: action.payload };
    case "SET_BATTLE_RESULT":
      return { ...state, battleResult: action.payload };
    case "SET_UNITS":
      return { ...state, units: action.payload };
    case "UPDATE_UNIT":
      return {
        ...state,
        units: state.units.map((u) =>
          u.id === action.payload.id ? { ...u, ...action.payload } : u
        ),
      };
    case "ADD_LOG":
      return { ...state, logs: [...state.logs.slice(-19), action.payload] };
    case "SET_LOGS":
      return { ...state, logs: action.payload };
    case "SET_IS_HOST":
      return { ...state, isHost: action.payload };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_REMATCH_PENDING":
      return { ...state, rematchPending: action.payload };
    case "SET_OPPONENT_WANTS_REMATCH":
      return { ...state, opponentWantsRematch: action.payload };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export const ArenaContext = createContext<ArenaContextType | null>(null);

interface ArenaProviderProps {
  children: ReactNode;
}

export const ArenaProvider: React.FC<ArenaProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(arenaReducer, initialState);
  const { user } = useAuth();

  // Ref para acessar valores atuais nos handlers sem causar re-render do useEffect
  // IMPORTANTE: Atualizar sincronamente durante render, NÃO em useEffect!
  const stateRef = React.useRef(state);
  stateRef.current = state; // Atualiza a cada render

  // Setup socket event listeners
  useEffect(() => {
    if (!user) return;

    console.log(
      "%c[Arena] 🎮 Inicializando Arena Provider",
      "color: #f59e0b; font-weight: bold;",
      { userId: user.id }
    );

    const handleLobbyCreated = (data: LobbyCreatedResponse) => {
      console.log(
        "%c[Arena] ✅ LOBBY CRIADO",
        "color: #22c55e; font-weight: bold; font-size: 12px;",
        {
          lobbyId: data.lobbyId,
          hostUserId: data.hostUserId,
          hostKingdomName: data.hostKingdomName,
          status: data.status,
        }
      );
      const lobby: ArenaLobby = {
        lobbyId: data.lobbyId,
        hostUserId: data.hostUserId,
        hostUsername: user.username,
        hostKingdomName: data.hostKingdomName,
        status: data.status,
        createdAt: new Date(),
      };
      dispatch({ type: "SET_CURRENT_LOBBY", payload: lobby });
      dispatch({ type: "SET_IS_HOST", payload: true });
    };

    const handleLobbiesList = (data: LobbiesListResponse) => {
      console.log(
        "%c[Arena] 📋 LISTA DE LOBBIES",
        "color: #3b82f6; font-weight: bold;",
        {
          count: data.lobbies.length,
          lobbies: data.lobbies.map((l) => ({
            id: l.lobbyId,
            host: l.hostUsername,
            status: l.status,
          })),
        }
      );
      dispatch({ type: "SET_LOBBIES", payload: data.lobbies });
    };

    const handlePlayerJoined = (data: PlayerJoinedResponse) => {
      console.log(
        "%c[Arena] 👤 JOGADOR ENTROU NO LOBBY",
        "color: #8b5cf6; font-weight: bold;",
        {
          guestUserId: data.guestUserId,
          guestUsername: data.guestUsername,
          guestKingdomName: data.guestKingdomName,
          status: data.status,
        }
      );
      // Só atualiza se já estiver em um lobby (para o host)
      // O guest recebe arena:lobby_joined separadamente
      if (stateRef.current.currentLobby) {
        dispatch({
          type: "SET_CURRENT_LOBBY",
          payload: {
            ...stateRef.current.currentLobby,
            guestUserId: data.guestUserId,
            guestUsername: data.guestUsername,
            guestKingdomName: data.guestKingdomName,
            status: data.status,
          },
        });
      }
    };

    const handleLobbyJoined = (data: ArenaLobby) => {
      console.log(
        "%c[Arena] 🚪 ENTROU NO LOBBY",
        "color: #22c55e; font-weight: bold;",
        {
          lobbyId: data.lobbyId,
          hostUsername: data.hostUsername,
          hostKingdomName: data.hostKingdomName,
        }
      );
      dispatch({ type: "SET_CURRENT_LOBBY", payload: data });
      dispatch({ type: "SET_IS_HOST", payload: false });
    };

    const handleLobbyClosed = (data: { lobbyId: string; reason: string }) => {
      console.log(
        "%c[Arena] 🚫 LOBBY FECHADO",
        "color: #ef4444; font-weight: bold;",
        {
          lobbyId: data.lobbyId,
          reason: data.reason,
        }
      );
      dispatch({ type: "SET_CURRENT_LOBBY", payload: null });
      dispatch({ type: "SET_IS_HOST", payload: false });
      dispatch({ type: "SET_ERROR", payload: data.reason });
    };

    const handlePlayerLeft = (data: {
      lobbyId: string;
      userId: string;
      status: ArenaLobbyStatus;
    }) => {
      console.log(
        "%c[Arena] 🚶 JOGADOR SAIU DO LOBBY",
        "color: #f59e0b; font-weight: bold;",
        {
          lobbyId: data.lobbyId,
          userId: data.userId,
          status: data.status,
        }
      );
      if (stateRef.current.currentLobby?.lobbyId === data.lobbyId) {
        dispatch({
          type: "SET_CURRENT_LOBBY",
          payload: {
            ...stateRef.current.currentLobby,
            guestUserId: undefined,
            guestUsername: undefined,
            guestKingdomName: undefined,
            status: data.status,
          },
        });
      }
    };

    const handleBattleStarted = (data: BattleStartedResponse) => {
      console.log(
        "%c[Arena] ⚔️ BATALHA INICIADA!",
        "color: #ef4444; font-weight: bold; font-size: 14px;",
        {
          battleId: data.battleId,
          gridSize: `${data.grid.width}x${data.grid.height}`,
          unitsCount: data.units.length,
          hostKingdom: data.hostKingdom.name,
          guestKingdom: data.guestKingdom.name,
          initiativeOrder: data.initiativeOrder,
          actionOrder: data.actionOrder,
        }
      );
      console.log(
        "%c[Arena] 🎯 Unidades na batalha:",
        "color: #8b5cf6;",
        data.units.map((u) => ({
          id: u.id,
          name: u.name,
          owner: u.ownerId,
          pos: `(${u.posX}, ${u.posY})`,
          hp: `${u.currentHp}/${u.vitality}`,
        }))
      );
      const battle: ArenaBattle = {
        battleId: data.battleId,
        grid: data.grid,
        round: 1,
        status: "ACTIVE",
        currentTurnIndex: 0,
        currentPlayerId: data.actionOrder[0],
        actionOrder: data.actionOrder,
        initiativeOrder: data.initiativeOrder,
        units: data.units,
        hostKingdom: data.hostKingdom,
        guestKingdom: data.guestKingdom,
      };
      dispatch({ type: "SET_BATTLE", payload: battle });
      dispatch({ type: "SET_UNITS", payload: data.units });
    };

    const handleActionStarted = (data: {
      battleId: string;
      unitId: string;
      movesLeft: number;
      actionsLeft: number;
    }) => {
      console.log(
        "%c[Arena] 🎬 AÇÃO INICIADA",
        "color: #10b981; font-weight: bold;",
        {
          battleId: data.battleId,
          unitId: data.unitId,
          movesLeft: data.movesLeft,
          actionsLeft: data.actionsLeft,
        }
      );
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: data.unitId,
          movesLeft: data.movesLeft,
          actionsLeft: data.actionsLeft,
          hasStartedAction: true,
        },
      });
    };

    const handleUnitMoved = (data: UnitMovedResponse) => {
      console.log(
        "%c[Arena] 🚶 UNIDADE MOVEU",
        "color: #06b6d4; font-weight: bold;",
        {
          unitId: data.unitId,
          from: `(${data.fromX}, ${data.fromY})`,
          to: `(${data.toX}, ${data.toY})`,
          movesLeft: data.movesLeft,
        }
      );
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: data.unitId,
          posX: data.toX,
          posY: data.toY,
          movesLeft: data.movesLeft,
        },
      });
    };

    const handleUnitAttacked = (data: UnitAttackedResponse) => {
      console.log(
        "%c[Arena] ⚔️ ATAQUE!",
        "color: #dc2626; font-weight: bold; font-size: 12px;",
        {
          attackerUnitId: data.attackerUnitId,
          targetUnitId: data.targetUnitId,
          damage: data.damage,
          targetHpAfter: data.targetHpAfter,
          targetProtection: data.targetProtection,
          damageType: data.damageType,
          rolls: data.rolls,
          diceCount: data.diceCount,
          attackerActionsLeft: data.attackerActionsLeft,
        }
      );
      // Atualizar alvo (dano recebido)
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: data.targetUnitId,
          currentHp: data.targetHpAfter,
          protection: data.targetProtection,
        },
      });
      // Atualizar atacante (ação consumida)
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: data.attackerUnitId,
          actionsLeft: data.attackerActionsLeft,
        },
      });
    };

    const handleUnitDefeated = (data: { battleId: string; unitId: string }) => {
      console.log(
        "%c[Arena] 💀 UNIDADE DERROTADA!",
        "color: #7c3aed; font-weight: bold; font-size: 12px;",
        {
          battleId: data.battleId,
          unitId: data.unitId,
        }
      );
      dispatch({
        type: "UPDATE_UNIT",
        payload: { id: data.unitId, isAlive: false },
      });
    };

    // Handler para Disparada (Dash)
    const handleUnitDashed = (data: {
      battleId: string;
      unitId: string;
      movesLeft: number;
      actionsLeft: number;
    }) => {
      console.log(
        "%c[Arena] 💨 DISPARADA!",
        "color: #f59e0b; font-weight: bold;",
        data
      );
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: data.unitId,
          movesLeft: data.movesLeft,
          actionsLeft: data.actionsLeft,
        },
      });
      dispatch({
        type: "ADD_LOG",
        payload: {
          id: `log_${Date.now()}`,
          battleId: data.battleId,
          message: "💨 Disparada! Movimentação resetada.",
          timestamp: new Date(),
        },
      });
    };

    // Handler para Esquiva (Dodge)
    const handleUnitDodged = (data: {
      battleId: string;
      unitId: string;
      actionsLeft: number;
      conditions: string[];
    }) => {
      console.log(
        "%c[Arena] 🛡️ ESQUIVA!",
        "color: #3b82f6; font-weight: bold;",
        data
      );
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: data.unitId,
          actionsLeft: data.actionsLeft,
          conditions: data.conditions,
        },
      });
      dispatch({
        type: "ADD_LOG",
        payload: {
          id: `log_${Date.now()}`,
          battleId: data.battleId,
          message: "🛡️ Esquiva! Entrou em modo defensivo.",
          timestamp: new Date(),
        },
      });
    };

    const handleProtectionRecovered = (data: {
      battleId: string;
      unitId: string;
      protection: number;
    }) => {
      console.log(
        "%c[Arena] 🛡️ PROTEÇÃO RECUPERADA",
        "color: #0ea5e9; font-weight: bold;",
        {
          unitId: data.unitId,
          protection: data.protection,
        }
      );
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: data.unitId,
          protection: data.protection,
          protectionBroken: false,
        },
      });
    };

    const handleNextPlayer = (data: {
      battleId: string;
      currentPlayerId: string;
      index: number;
    }) => {
      console.log(
        "%c[Arena] 🔄 PRÓXIMO JOGADOR",
        "color: #f59e0b; font-weight: bold;",
        {
          battleId: data.battleId,
          currentPlayerId: data.currentPlayerId,
          turnIndex: data.index,
        }
      );
      // Resetar hasStartedAction de todas as unidades quando muda de jogador
      const updatedUnits = stateRef.current.units.map((u) => ({
        ...u,
        hasStartedAction: false,
        movesLeft: 0,
        actionsLeft: 0,
      }));
      dispatch({ type: "SET_UNITS", payload: updatedUnits });
      dispatch({
        type: "SET_BATTLE",
        payload: stateRef.current.battle
          ? {
              ...stateRef.current.battle,
              currentPlayerId: data.currentPlayerId,
              currentTurnIndex: data.index,
            }
          : null,
      });
    };

    // Handler para quando a unidade finaliza o turno
    const handleUnitTurnEnded = (data: {
      battleId: string;
      unitId: string;
      actionMarks: number;
      currentHp: number;
      isAlive: boolean;
      conditions: string[];
    }) => {
      console.log(
        "%c[Arena] ⏹️ TURNO FINALIZADO",
        "color: #6b7280; font-weight: bold;",
        data
      );
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: data.unitId,
          actionMarks: data.actionMarks,
          currentHp: data.currentHp,
          isAlive: data.isAlive,
          conditions: data.conditions,
        },
      });
    };

    const handleNewRound = (data: { battleId: string; round: number }) => {
      console.log(
        "%c[Arena] 🔔 NOVA RODADA",
        "color: #f59e0b; font-weight: bold; font-size: 14px;",
        {
          battleId: data.battleId,
          round: data.round,
        }
      );
      dispatch({
        type: "SET_BATTLE",
        payload: stateRef.current.battle
          ? { ...stateRef.current.battle, round: data.round }
          : null,
      });
    };

    const handleBattleEnded = (data: BattleEndedResponse) => {
      console.log(
        "%c[Arena] 🏆 BATALHA FINALIZADA!",
        "color: #22c55e; font-weight: bold; font-size: 16px;",
        {
          battleId: data.battleId,
          winnerId: data.winnerId,
          reason: data.reason,
          finalUnitsCount: data.finalUnits?.length,
        }
      );
      // Salvar resultado com unidades finais (do servidor ou do state local)
      dispatch({
        type: "SET_BATTLE_RESULT",
        payload: {
          battleId: data.battleId,
          winnerId: data.winnerId,
          winnerKingdomId: data.winnerKingdomId,
          reason: data.reason,
          surrenderedBy: data.surrenderedBy,
          disconnectedBy: data.disconnectedBy,
          finalUnits: data.finalUnits || [...stateRef.current.units], // Preferir do servidor
        },
      });
      // Atualizar status da batalha
      dispatch({
        type: "SET_BATTLE",
        payload: stateRef.current.battle
          ? { ...stateRef.current.battle, status: "ENDED" }
          : null,
      });
      // Limpar flags de rematch
      dispatch({ type: "SET_REMATCH_PENDING", payload: false });
      dispatch({ type: "SET_OPPONENT_WANTS_REMATCH", payload: false });
    };

    const handleError = (data: { message: string }) => {
      console.error(
        "%c[Arena] ❌ ERRO",
        "color: #ef4444; font-weight: bold;",
        data.message
      );
      dispatch({ type: "SET_ERROR", payload: data.message });
    };

    // Handler para quando oponente desconecta temporariamente
    const handlePlayerDisconnected = (data: {
      lobbyId: string;
      userId: string;
    }) => {
      console.log(
        "%c[Arena] ⚠️ OPONENTE DESCONECTOU",
        "color: #f59e0b; font-weight: bold; font-size: 12px;",
        {
          lobbyId: data.lobbyId,
          userId: data.userId,
        }
      );
      // Mostrar mensagem para o usuário
      dispatch({
        type: "SET_ERROR",
        payload: "Oponente desconectou. Aguardando reconexão...",
      });
    };

    // Handler para quando oponente reconecta
    const handlePlayerReconnected = (data: {
      lobbyId: string;
      userId: string;
    }) => {
      console.log(
        "%c[Arena] ✅ OPONENTE RECONECTOU",
        "color: #22c55e; font-weight: bold; font-size: 12px;",
        {
          lobbyId: data.lobbyId,
          userId: data.userId,
        }
      );
      // Limpar mensagem de erro
      dispatch({ type: "SET_ERROR", payload: null });
    };

    // Handler para quando oponente quer revanche
    const handleRematchRequested = (data: {
      lobbyId: string;
      userId: string;
    }) => {
      console.log(
        "%c[Arena] 🔄 OPONENTE QUER REVANCHE",
        "color: #f59e0b; font-weight: bold; font-size: 12px;",
        data
      );
      if (data.userId !== user.id) {
        dispatch({ type: "SET_OPPONENT_WANTS_REMATCH", payload: true });
      }
    };

    // Handler para quando revanche é aceita e nova batalha começa
    const handleRematchStarted = (data: BattleStartedResponse) => {
      console.log(
        "%c[Arena] ⚔️ REVANCHE INICIADA!",
        "color: #22c55e; font-weight: bold; font-size: 16px;",
        data
      );
      // Limpar resultado anterior
      dispatch({ type: "SET_BATTLE_RESULT", payload: null });
      dispatch({ type: "SET_REMATCH_PENDING", payload: false });
      dispatch({ type: "SET_OPPONENT_WANTS_REMATCH", payload: false });
      // Configurar nova batalha (usa o handler existente)
      handleBattleStarted(data);
    };

    // Handler for session restoration (reconnection)
    const handleSessionRestored = (data: {
      lobbyId: string;
      hostUserId: string;
      hostUsername: string;
      hostKingdomName: string;
      guestUserId?: string;
      guestUsername?: string;
      guestKingdomName?: string;
      status: ArenaLobbyStatus;
      isHost: boolean;
      createdAt: string;
    }) => {
      console.log(
        "%c[Arena] 🔄 SESSÃO RESTAURADA (LOBBY)",
        "color: #22c55e; font-weight: bold; font-size: 14px;",
        {
          lobbyId: data.lobbyId,
          isHost: data.isHost,
          status: data.status,
          hostUsername: data.hostUsername,
          guestUsername: data.guestUsername,
        }
      );
      const lobby: ArenaLobby = {
        lobbyId: data.lobbyId,
        hostUserId: data.hostUserId,
        hostUsername: data.hostUsername,
        hostKingdomName: data.hostKingdomName,
        guestUserId: data.guestUserId,
        guestUsername: data.guestUsername,
        guestKingdomName: data.guestKingdomName,
        status: data.status,
        createdAt: new Date(data.createdAt),
      };
      dispatch({ type: "SET_CURRENT_LOBBY", payload: lobby });
      dispatch({ type: "SET_IS_HOST", payload: data.isHost });
    };

    // Handler for battle restoration (reconnection during battle)
    const handleBattleRestored = (data: {
      battleId: string;
      lobbyId?: string;
      grid: { width: number; height: number };
      round: number;
      status: "ACTIVE" | "ENDED";
      currentTurnIndex: number;
      currentPlayerId: string;
      units: any[];
      initiativeOrder: string[];
      actionOrder: string[];
      hostKingdom: { id: string; name: string; ownerId: string } | null;
      guestKingdom: { id: string; name: string; ownerId: string } | null;
    }) => {
      console.log(
        "%c[Arena] 🔄 SESSÃO RESTAURADA (BATALHA)",
        "color: #ef4444; font-weight: bold; font-size: 14px;",
        {
          battleId: data.battleId,
          round: data.round,
          status: data.status,
          unitsCount: data.units.length,
        }
      );
      const battle: ArenaBattle = {
        battleId: data.battleId,
        grid: data.grid,
        round: data.round,
        status: data.status,
        currentTurnIndex: data.currentTurnIndex,
        currentPlayerId: data.currentPlayerId,
        actionOrder: data.actionOrder,
        initiativeOrder: data.initiativeOrder,
        units: data.units,
        hostKingdom: data.hostKingdom || {
          id: "",
          name: "Unknown",
          ownerId: "",
        },
        guestKingdom: data.guestKingdom || {
          id: "",
          name: "Unknown",
          ownerId: "",
        },
      };
      dispatch({ type: "SET_BATTLE", payload: battle });
      dispatch({ type: "SET_UNITS", payload: data.units });
    };

    // Register listeners
    socketService.on("battle:lobby_created", handleLobbyCreated);
    socketService.on("battle:lobbies_list", handleLobbiesList);
    socketService.on("battle:player_joined", handlePlayerJoined);
    socketService.on("battle:lobby_joined", handleLobbyJoined);
    socketService.on("battle:lobby_closed", handleLobbyClosed);
    socketService.on("battle:player_left", handlePlayerLeft);
    socketService.on("battle:battle_started", handleBattleStarted);
    socketService.on("battle:action_started", handleActionStarted);
    socketService.on("battle:unit_moved", handleUnitMoved);
    socketService.on("battle:unit_attacked", handleUnitAttacked);
    socketService.on("battle:unit_defeated", handleUnitDefeated);
    socketService.on("battle:protection_recovered", handleProtectionRecovered);
    socketService.on("battle:unit_turn_ended", handleUnitTurnEnded);
    socketService.on("battle:next_player", handleNextPlayer);
    socketService.on("battle:new_round", handleNewRound);
    socketService.on("battle:battle_ended", handleBattleEnded);
    socketService.on("battle:unit_dashed", handleUnitDashed);
    socketService.on("battle:unit_dodged", handleUnitDodged);
    socketService.on("battle:error", handleError);
    socketService.on("battle:session_restored", handleSessionRestored);
    socketService.on("battle:battle_restored", handleBattleRestored);
    socketService.on("battle:player_disconnected", handlePlayerDisconnected);
    socketService.on("battle:player_reconnected", handlePlayerReconnected);
    socketService.on("battle:rematch_requested", handleRematchRequested);
    socketService.on("battle:rematch_started", handleRematchStarted);

    return () => {
      socketService.off("battle:lobby_created", handleLobbyCreated);
      socketService.off("battle:lobbies_list", handleLobbiesList);
      socketService.off("battle:player_joined", handlePlayerJoined);
      socketService.off("battle:lobby_joined", handleLobbyJoined);
      socketService.off("battle:lobby_closed", handleLobbyClosed);
      socketService.off("battle:player_left", handlePlayerLeft);
      socketService.off("battle:battle_started", handleBattleStarted);
      socketService.off("battle:action_started", handleActionStarted);
      socketService.off("battle:unit_moved", handleUnitMoved);
      socketService.off("battle:unit_attacked", handleUnitAttacked);
      socketService.off("battle:unit_defeated", handleUnitDefeated);
      socketService.off(
        "battle:protection_recovered",
        handleProtectionRecovered
      );
      socketService.off("battle:unit_turn_ended", handleUnitTurnEnded);
      socketService.off("battle:next_player", handleNextPlayer);
      socketService.off("battle:new_round", handleNewRound);
      socketService.off("battle:battle_ended", handleBattleEnded);
      socketService.off("battle:unit_dashed", handleUnitDashed);
      socketService.off("battle:unit_dodged", handleUnitDodged);
      socketService.off("battle:error", handleError);
      socketService.off("battle:session_restored", handleSessionRestored);
      socketService.off("battle:battle_restored", handleBattleRestored);
      socketService.off("battle:player_disconnected", handlePlayerDisconnected);
      socketService.off("battle:player_reconnected", handlePlayerReconnected);
      socketService.off("battle:rematch_requested", handleRematchRequested);
      socketService.off("battle:rematch_started", handleRematchStarted);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const createLobby = useCallback(
    (kingdomId: string) => {
      if (!user) return;
      console.log(
        "%c[Arena] ⬆️ EMIT: arena:create_lobby",
        "color: #22c55e; font-weight: bold;",
        { userId: user.id, kingdomId }
      );
      dispatch({ type: "SET_LOADING", payload: true });
      socketService.emit("battle:create_lobby", { userId: user.id, kingdomId });
      dispatch({ type: "SET_LOADING", payload: false });
    },
    [user]
  );

  const listLobbies = useCallback(() => {
    console.log(
      "%c[Arena] ⬆️ EMIT: arena:list_lobbies",
      "color: #22c55e; font-weight: bold;"
    );
    socketService.emit("battle:list_lobbies");
  }, []);

  const joinLobby = useCallback(
    (lobbyId: string, kingdomId: string) => {
      if (!user) return;
      console.log(
        "%c[Arena] ⬆️ EMIT: arena:join_lobby",
        "color: #22c55e; font-weight: bold;",
        { lobbyId, userId: user.id, kingdomId }
      );
      dispatch({ type: "SET_LOADING", payload: true });
      socketService.emit("battle:join_lobby", {
        lobbyId,
        userId: user.id,
        kingdomId,
      });
      dispatch({ type: "SET_LOADING", payload: false });
    },
    [user]
  );

  const leaveLobby = useCallback(() => {
    if (!user) return;
    console.log(
      "%c[Arena] ⬆️ EMIT: arena:leave_lobby",
      "color: #f59e0b; font-weight: bold;",
      { userId: user.id }
    );
    socketService.emit("battle:leave_lobby", { userId: user.id });
    dispatch({ type: "SET_CURRENT_LOBBY", payload: null });
    dispatch({ type: "SET_IS_HOST", payload: false });
  }, [user]);

  const startBattle = useCallback(() => {
    if (!user || !state.currentLobby) return;
    console.log(
      "%c[Arena] ⬆️ EMIT: arena:start_battle",
      "color: #ef4444; font-weight: bold; font-size: 12px;",
      {
        lobbyId: state.currentLobby.lobbyId,
        userId: user.id,
      }
    );
    socketService.emit("battle:start_battle", {
      lobbyId: state.currentLobby.lobbyId,
      userId: user.id,
    });
  }, [user, state.currentLobby]);

  const beginAction = useCallback(
    (unitId: string) => {
      if (!user || !state.battle) return;
      console.log(
        "%c[Arena] ⬆️ EMIT: arena:begin_action",
        "color: #10b981; font-weight: bold;",
        {
          battleId: state.battle.battleId,
          unitId,
          userId: user.id,
        }
      );
      socketService.emit("battle:begin_action", {
        battleId: state.battle.battleId,
        unitId,
        userId: user.id,
      });
    },
    [user, state.battle]
  );

  const moveUnit = useCallback(
    (unitId: string, toX: number, toY: number) => {
      if (!state.battle) return;
      console.log(
        "%c[Arena] ⬆️ EMIT: arena:move",
        "color: #06b6d4; font-weight: bold;",
        {
          battleId: state.battle.battleId,
          unitId,
          toX,
          toY,
        }
      );
      socketService.emit("battle:move", {
        battleId: state.battle.battleId,
        unitId,
        toX,
        toY,
      });
    },
    [state.battle]
  );

  const attackUnit = useCallback(
    (attackerUnitId: string, targetUnitId: string) => {
      if (!state.battle) return;
      console.log(
        "%c[Arena] ⬆️ EMIT: arena:attack",
        "color: #dc2626; font-weight: bold; font-size: 12px;",
        {
          battleId: state.battle.battleId,
          attackerUnitId,
          targetUnitId,
        }
      );
      socketService.emit("battle:attack", {
        battleId: state.battle.battleId,
        attackerUnitId,
        targetUnitId,
      });
    },
    [state.battle]
  );

  const endAction = useCallback(
    (unitId: string) => {
      if (!state.battle) return;
      console.log(
        "%c[Arena] ⬆️ EMIT: arena:end_unit_action",
        "color: #f59e0b; font-weight: bold;",
        {
          battleId: state.battle.battleId,
          unitId,
        }
      );
      socketService.emit("battle:end_unit_action", {
        battleId: state.battle.battleId,
        unitId,
      });
    },
    [state.battle]
  );

  // Função genérica para executar qualquer ação de batalha
  const executeAction = useCallback(
    (actionName: string, unitId: string, params?: Record<string, unknown>) => {
      if (!state.battle) return;

      const eventName = `battle:${actionName}`;
      const payload = {
        battleId: state.battle.battleId,
        unitId,
        ...params,
      };

      console.log(
        `%c[Arena] ⬆️ EMIT: ${eventName}`,
        "color: #8b5cf6; font-weight: bold;",
        payload
      );

      socketService.emit(eventName, payload);
    },
    [state.battle]
  );

  const surrender = useCallback(() => {
    if (!user || !state.battle) return;
    console.log(
      "%c[Arena] ⬆️ EMIT: arena:surrender",
      "color: #7c3aed; font-weight: bold; font-size: 12px;",
      {
        battleId: state.battle.battleId,
        userId: user.id,
      }
    );
    socketService.emit("battle:surrender", {
      battleId: state.battle.battleId,
      userId: user.id,
    });
  }, [user, state.battle]);

  const requestRematch = useCallback(() => {
    if (!user || !state.currentLobby) return;
    console.log(
      "%c[Arena] ⬆️ EMIT: arena:request_rematch",
      "color: #f59e0b; font-weight: bold; font-size: 12px;",
      {
        lobbyId: state.currentLobby.lobbyId,
        userId: user.id,
      }
    );
    dispatch({ type: "SET_REMATCH_PENDING", payload: true });
    socketService.emit("battle:request_rematch", {
      lobbyId: state.currentLobby.lobbyId,
      userId: user.id,
    });
  }, [user, state.currentLobby]);

  const dismissBattleResult = useCallback(() => {
    console.log(
      "%c[Arena] 🚪 Fechando modal de resultado",
      "color: #6b7280; font-weight: bold;"
    );
    dispatch({ type: "SET_BATTLE_RESULT", payload: null });
    dispatch({ type: "SET_BATTLE", payload: null });
    dispatch({ type: "SET_UNITS", payload: [] });
    dispatch({ type: "SET_CURRENT_LOBBY", payload: null });
    dispatch({ type: "SET_IS_HOST", payload: false });
    dispatch({ type: "SET_REMATCH_PENDING", payload: false });
    dispatch({ type: "SET_OPPONENT_WANTS_REMATCH", payload: false });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: "SET_ERROR", payload: null });
  }, []);

  const value = useMemo(
    () => ({
      state,
      createLobby,
      listLobbies,
      joinLobby,
      leaveLobby,
      startBattle,
      beginAction,
      moveUnit,
      attackUnit,
      endAction,
      executeAction,
      surrender,
      requestRematch,
      dismissBattleResult,
      clearError,
    }),
    [
      state,
      createLobby,
      listLobbies,
      joinLobby,
      leaveLobby,
      startBattle,
      beginAction,
      moveUnit,
      attackUnit,
      endAction,
      executeAction,
      surrender,
      requestRematch,
      dismissBattleResult,
      clearError,
    ]
  );

  return (
    <ArenaContext.Provider value={value}>{children}</ArenaContext.Provider>
  );
};
