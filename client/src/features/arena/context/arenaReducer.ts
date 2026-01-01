import type { ArenaState, ArenaAction } from "../types/arena.types";

export const initialArenaState: ArenaState = {
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

export function arenaReducer(
  state: ArenaState,
  action: ArenaAction
): ArenaState {
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
    case "DESTROY_OBSTACLE":
      if (!state.battle?.config?.map?.obstacles) return state;
      return {
        ...state,
        battle: {
          ...state.battle,
          config: {
            ...state.battle.config,
            map: {
              ...state.battle.config.map,
              obstacles: state.battle.config.map.obstacles.map((obs) =>
                obs.id === action.payload.obstacleId
                  ? { ...obs, destroyed: true, hp: 0 }
                  : obs
              ),
            },
          },
        },
      };
    case "RESET":
      return initialArenaState;
    default:
      return state;
  }
}

/**
 * Action creators para facilitar o dispatch
 */
export const arenaActions = {
  setLobbies: (lobbies: ArenaState["lobbies"]): ArenaAction => ({
    type: "SET_LOBBIES",
    payload: lobbies,
  }),
  setCurrentLobby: (lobby: ArenaState["currentLobby"]): ArenaAction => ({
    type: "SET_CURRENT_LOBBY",
    payload: lobby,
  }),
  updateLobbyStatus: (
    lobbyId: string,
    status: ArenaState["currentLobby"] extends { status: infer S } | null
      ? S
      : never
  ): ArenaAction => ({
    type: "UPDATE_LOBBY_STATUS",
    payload: { lobbyId, status },
  }),
  setBattle: (battle: ArenaState["battle"]): ArenaAction => ({
    type: "SET_BATTLE",
    payload: battle,
  }),
  setBattleResult: (result: ArenaState["battleResult"]): ArenaAction => ({
    type: "SET_BATTLE_RESULT",
    payload: result,
  }),
  setUnits: (units: ArenaState["units"]): ArenaAction => ({
    type: "SET_UNITS",
    payload: units,
  }),
  updateUnit: (
    unit: Partial<ArenaState["units"][number]> & { id: string }
  ): ArenaAction => ({
    type: "UPDATE_UNIT",
    payload: unit,
  }),
  addLog: (log: ArenaState["logs"][number]): ArenaAction => ({
    type: "ADD_LOG",
    payload: log,
  }),
  setLogs: (logs: ArenaState["logs"]): ArenaAction => ({
    type: "SET_LOGS",
    payload: logs,
  }),
  setIsHost: (isHost: boolean): ArenaAction => ({
    type: "SET_IS_HOST",
    payload: isHost,
  }),
  setLoading: (loading: boolean): ArenaAction => ({
    type: "SET_LOADING",
    payload: loading,
  }),
  setError: (error: string | null): ArenaAction => ({
    type: "SET_ERROR",
    payload: error,
  }),
  setRematchPending: (pending: boolean): ArenaAction => ({
    type: "SET_REMATCH_PENDING",
    payload: pending,
  }),
  setOpponentWantsRematch: (wants: boolean): ArenaAction => ({
    type: "SET_OPPONENT_WANTS_REMATCH",
    payload: wants,
  }),
  reset: (): ArenaAction => ({ type: "RESET" }),
};
