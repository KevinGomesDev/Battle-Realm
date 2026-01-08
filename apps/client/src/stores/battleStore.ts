// client/src/stores/battleStore.ts
// Store Zustand para Batalha PvP

import { create } from "zustand";
import {
  colyseusService,
  serializeSchemaObject,
  type BattleSessionState,
  type BattleUnitState,
  type BattlePlayerState,
  type BattleObstacleState,
} from "../services/colyseus.service";
import { BATTLE_COLORS } from "@boundless/shared/config";
import { CONDITION_COLORS } from "../config/colors.config";

// ============================================
// Types
// ============================================

interface BattleLobbyData {
  lobbyId: string;
  hostUserId: string;
  hostUsername: string;
  hostKingdomId: string;
  hostKingdomName: string;
  maxPlayers: number;
  currentPlayers: number;
  vsBot: boolean;
  status: string;
  createdAt: string;
}

interface BattleSessionResult {
  battleId: string;
  winnerId: string;
  winReason: string;
  finalUnits: BattleUnitState[];
  vsBot: boolean;
}

export interface BattleComputed {
  battleId: string;
  round: number;
  turnTimer: number;
  activeUnitId: string | null;
  selectedUnitId: string | null;
  currentPlayerId: string | null;
  unitLocked: boolean;
  actionOrder: string[];
  kingdoms: Array<{
    ownerId: string;
    kingdomId: string;
    kingdomName: string;
    playerIndex: number;
    playerColor: string;
  }>;
  config: {
    grid: {
      width: number;
      height: number;
    };
    map: {
      obstacles: BattleObstacleState[];
      terrainType?: string;
      terrainColors?: {
        primary?: { hex: string };
        secondary?: { hex: string };
        accent?: { hex: string };
      };
    };
    colors: typeof BATTLE_COLORS;
    conditionColors: typeof CONDITION_COLORS;
  };
}

interface BattleState {
  // Lobby
  lobbyId: string | null;
  isHost: boolean;
  lobbies: BattleLobbyData[];

  // Battle
  battleId: string | null;
  isInBattle: boolean;
  status: string;
  round: number;
  turnTimer: number;
  gridWidth: number;
  gridHeight: number;

  // Players
  players: BattlePlayerState[];

  // Units
  units: BattleUnitState[];
  activeUnitId: string | null;
  selectedUnitId: string | null;
  currentPlayerId: string | null;
  unitLocked: boolean;
  actionOrder: string[];

  // Obstacles
  obstacles: BattleObstacleState[];

  // Result
  winnerId: string | null;
  winReason: string | null;
  rematchRequests: string[];

  // UI State
  isLoading: boolean;
  error: string | null;

  // Computed
  battle: BattleComputed | null;
  battleResult: BattleSessionResult | null;
  rematchPending: boolean;
  opponentWantsRematch: boolean;
}

interface BattleActions {
  // Lobby listing
  listLobbies: () => Promise<BattleLobbyData[]>;

  // Lobby
  createLobby: (
    kingdomId: string,
    options?: { maxPlayers?: number; vsBot?: boolean }
  ) => Promise<void>;
  joinLobby: (roomId: string, kingdomId: string) => Promise<void>;
  leaveLobby: () => Promise<void>;
  setReady: () => void;
  startBattle: () => void;

  // Battle
  selectUnit: (unitId: string) => void;
  beginAction: (unitId: string) => void;
  moveUnit: (unitId: string, toX: number, toY: number) => void;
  attackUnit: (
    attackerId: string,
    targetPosition: { x: number; y: number }
  ) => void;
  endAction: (unitId: string) => void;
  executeAction: (
    actionName: string,
    unitId: string,
    params?: Record<string, unknown>
  ) => void;
  castSpell: (
    unitId: string,
    spellCode: string,
    targetId?: string,
    targetPosition?: { x: number; y: number }
  ) => void;
  surrender: () => void;
  requestRematch: () => void;

  // Utilities
  getUnit: (unitId: string) => BattleUnitState | undefined;
  getMyUnits: (userId: string) => BattleUnitState[];
  clearError: () => void;
  dismissBattleResult: () => Promise<void>;

  // State setters
  setLobby: (lobbyId: string, isHost: boolean) => void;
  setLobbies: (lobbies: BattleLobbyData[]) => void;
  setBattleState: (state: Partial<BattleState>) => void;
  setUnits: (units: BattleUnitState[]) => void;
  updateUnit: (unit: BattleUnitState) => void;
  setPlayers: (players: BattlePlayerState[]) => void;
  setObstacles: (obstacles: BattleObstacleState[]) => void;
  setActiveUnit: (unitId: string | null) => void;
  setResult: (winnerId: string, winReason: string) => void;
  addRematchRequest: (userId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  initializeListeners: (userId: string | undefined) => () => void;
  computeBattle: (userId: string | undefined) => void;
}

const initialState: BattleState = {
  lobbyId: null,
  isHost: false,
  lobbies: [],
  battleId: null,
  isInBattle: false,
  status: "IDLE",
  round: 0,
  turnTimer: 0,
  gridWidth: 12,
  gridHeight: 8,
  players: [],
  units: [],
  activeUnitId: null,
  selectedUnitId: null,
  currentPlayerId: null,
  unitLocked: false,
  actionOrder: [],
  obstacles: [],
  winnerId: null,
  winReason: null,
  rematchRequests: [],
  isLoading: false,
  error: null,
  battle: null,
  battleResult: null,
  rematchPending: false,
  opponentWantsRematch: false,
};

export const useBattleStore = create<BattleState & BattleActions>(
  (set, get) => ({
    ...initialState,

    // State setters
    setLobby: (lobbyId, isHost) => set({ lobbyId, isHost }),

    setLobbies: (lobbies) => set({ lobbies }),

    setBattleState: (state) => set((prev) => ({ ...prev, ...state })),

    setUnits: (units) => set({ units }),

    updateUnit: (unit) =>
      set((state) => ({
        units: state.units.map((u) => (u.id === unit.id ? unit : u)),
      })),

    setPlayers: (players) => set({ players }),

    setObstacles: (obstacles) => set({ obstacles }),

    setActiveUnit: (activeUnitId) => set({ activeUnitId }),

    setResult: (winnerId, winReason) => set({ winnerId, winReason }),

    addRematchRequest: (userId) =>
      set((state) => ({
        rematchRequests: [...state.rematchRequests, userId],
      })),

    setLoading: (isLoading) => set({ isLoading }),

    setError: (error) => set({ error, isLoading: false }),

    reset: () => set(initialState),

    clearError: () => set({ error: null }),

    // Compute battle object for compatibility with BattleView
    computeBattle: (userId) => {
      const state = get();

      const battle: BattleComputed | null =
        state.isInBattle && state.battleId
          ? {
              battleId: state.battleId,
              round: state.round,
              turnTimer: state.turnTimer,
              activeUnitId: state.activeUnitId,
              selectedUnitId: state.selectedUnitId,
              currentPlayerId: state.currentPlayerId,
              unitLocked: state.unitLocked,
              actionOrder: state.actionOrder,
              kingdoms: state.players.map((p) => ({
                ownerId: p.oderId,
                kingdomId: p.kingdomId,
                kingdomName: p.kingdomName,
                playerIndex: p.playerIndex,
                playerColor: p.playerColor,
              })),
              config: {
                grid: {
                  width: state.gridWidth,
                  height: state.gridHeight,
                },
                map: {
                  obstacles: state.obstacles,
                },
                colors: BATTLE_COLORS,
                conditionColors: CONDITION_COLORS,
              },
            }
          : null;

      const battleResult: BattleSessionResult | null =
        state.winnerId && state.winReason && state.battleId
          ? {
              battleId: state.battleId,
              winnerId: state.winnerId,
              winReason: state.winReason,
              finalUnits: state.units,
              vsBot: state.players.some((p) => p.isBot),
            }
          : null;

      const rematchPending = userId
        ? state.rematchRequests.includes(userId)
        : false;
      const opponentWantsRematch = userId
        ? state.rematchRequests.some((id) => id !== userId)
        : false;

      set({ battle, battleResult, rematchPending, opponentWantsRematch });
    },

    // Lobby Actions
    listLobbies: async () => {
      set({ isLoading: true });

      try {
        const lobbies = await colyseusService.waitForResponse<
          BattleLobbyData[]
        >(
          "battle:list_lobbies",
          {},
          "battle:lobbies_list",
          "battle:error",
          5000
        );

        set({ lobbies: lobbies || [], isLoading: false });
        return lobbies || [];
      } catch (err: unknown) {
        console.error("[Battle] Erro ao listar lobbies:", err);
        set({ lobbies: [], isLoading: false });
        return [];
      }
    },

    createLobby: async (kingdomId, options) => {
      set({ isLoading: true, error: null });

      try {
        const room = await colyseusService.createBattleLobby({
          kingdomId,
          maxPlayers: options?.maxPlayers,
          vsBot: options?.vsBot,
        });

        set({ lobbyId: room.id, isHost: true, isLoading: false });
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
      }
    },

    joinLobby: async (roomId, kingdomId) => {
      set({ isLoading: true, error: null });

      try {
        const room = await colyseusService.joinBattleLobby(roomId, kingdomId);
        set({ lobbyId: room.id, isHost: false, isLoading: false });
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
      }
    },

    leaveLobby: async () => {
      await colyseusService.leaveBattle();
      set(initialState);
    },

    setReady: () => {
      colyseusService.sendToBattle("lobby:ready", {});
    },

    startBattle: () => {
      colyseusService.sendToBattle("lobby:start", {});
    },

    // Battle Actions
    selectUnit: (unitId) => {
      colyseusService.sendToBattle("battle:select_unit", { unitId });
    },

    beginAction: (unitId) => {
      colyseusService.sendToBattle("battle:begin_action", { unitId });
    },

    moveUnit: (unitId, toX, toY) => {
      colyseusService.sendToBattle("battle:move", { unitId, toX, toY });
    },

    attackUnit: (attackerId, targetPosition) => {
      colyseusService.sendToBattle("battle:attack", {
        attackerId,
        targetPosition,
      });
    },

    endAction: (unitId) => {
      colyseusService.sendToBattle("battle:end_action", { unitId });
    },

    executeAction: (actionName, unitId, params) => {
      colyseusService.sendToBattle("battle:execute_action", {
        actionName,
        unitId,
        params,
      });
    },

    castSpell: (unitId, spellCode, targetId, targetPosition) => {
      colyseusService.sendToBattle("battle:cast_spell", {
        unitId,
        spellCode,
        targetId,
        targetPosition,
      });
    },

    surrender: () => {
      colyseusService.sendToBattle("battle:surrender", {});
    },

    requestRematch: () => {
      colyseusService.sendToBattle("battle:request_rematch", {});
    },

    // Utilities
    getUnit: (unitId) => {
      return get().units.find((u) => u.id === unitId);
    },

    getMyUnits: (userId) => {
      if (!userId) return [];
      return get().units.filter((u) => u.ownerId === userId);
    },

    dismissBattleResult: async () => {
      set({ winnerId: "", winReason: "" });

      try {
        await colyseusService.leaveBattle();
      } catch (err) {
        console.error("[Battle] Erro ao sair da battle:", err);
      }

      set(initialState);
    },

    initializeListeners: (userId) => {
      const handleStateChanged = (colyseusState: BattleSessionState) => {
        const unitsArray: BattleUnitState[] = [];
        if (colyseusState.units) {
          colyseusState.units.forEach((unit: BattleUnitState) => {
            // Serializar objeto Colyseus Schema para objeto JS puro
            unitsArray.push(serializeSchemaObject(unit));
          });
        }

        const playersArray: BattlePlayerState[] = [];
        if (colyseusState.players) {
          colyseusState.players.forEach((player: BattlePlayerState) => {
            // Serializar objeto Colyseus Schema para objeto JS puro
            playersArray.push(serializeSchemaObject(player));
          });
        }

        const obstaclesArray: BattleObstacleState[] = [];
        if (colyseusState.obstacles) {
          colyseusState.obstacles.forEach((obs: BattleObstacleState) => {
            // Serializar objeto Colyseus Schema para objeto JS puro
            obstaclesArray.push(serializeSchemaObject(obs));
          });
        }

        const hasActiveUnits = unitsArray.length > 0;
        const hasBattleData =
          !!colyseusState.battleId && colyseusState.round > 0;
        const isStatusActive = colyseusState.status === "ACTIVE";
        const isInBattle = isStatusActive || (hasActiveUnits && hasBattleData);

        set({
          battleId: colyseusState.battleId,
          lobbyId: colyseusState.lobbyId,
          isInBattle,
          status: colyseusState.status,
          round: colyseusState.round,
          turnTimer: colyseusState.turnTimer,
          gridWidth: colyseusState.gridWidth,
          gridHeight: colyseusState.gridHeight,
          activeUnitId: colyseusState.activeUnitId || null,
          selectedUnitId: colyseusState.selectedUnitId || null,
          currentPlayerId: colyseusState.currentPlayerId || null,
          unitLocked: colyseusState.unitLocked || false,
          actionOrder: Array.from(colyseusState.actionOrder || []),
          winnerId: colyseusState.winnerId || null,
          winReason: colyseusState.winReason || null,
          rematchRequests: Array.from(colyseusState.rematchRequests || []),
          units: unitsArray,
          players: playersArray,
          obstacles: obstaclesArray,
        });

        // Compute battle after state update
        get().computeBattle(userId);
      };

      const handleLeft = () => {
        set(initialState);
      };

      const handleError = (data: { message?: string }) => {
        set({ error: data.message || "Erro na battle" });
      };

      const handleSessionActive = async (data: {
        type: string;
        roomId?: string;
        battleId?: string;
        lobbyId?: string;
        kingdomId?: string;
        status?: string;
        source?: "memory" | "database";
        needsRestore?: boolean;
      }) => {
        if (data.type !== "BATTLE_SESSION" && data.type !== "BATTLE_LOBBY") {
          return;
        }

        const roomId = data.roomId || data.battleId || data.lobbyId;
        if (!roomId) {
          console.warn(
            "[Battle] Sessão ativa sem roomId, não é possível reconectar"
          );
          return;
        }

        if (colyseusService.isInBattle()) {
          const currentRoom = colyseusService.getBattleRoom();
          if (currentRoom?.id === roomId) {
            console.log("[Battle] Já conectado à room:", roomId);
            return;
          }
        }

        set({ isLoading: true });

        try {
          let kingdomId = data.kingdomId;

          if (!kingdomId) {
            const userData = localStorage.getItem("auth_user");
            const authUser = userData ? JSON.parse(userData) : null;
            const selectedKingdom = localStorage.getItem("selected_kingdom");
            kingdomId = selectedKingdom
              ? JSON.parse(selectedKingdom)?.id
              : authUser?.kingdoms?.[0]?.id;
          }

          if (!kingdomId) {
            console.error(
              "[Battle] Não foi possível encontrar kingdomId para reconexão"
            );
            set({
              error: "Reino não encontrado para reconexão",
              isLoading: false,
            });
            return;
          }

          if (data.needsRestore) {
            await colyseusService.createBattleLobby({
              kingdomId,
              restoreBattleId: roomId,
            });
          } else {
            await colyseusService.joinBattleLobby(roomId, kingdomId);
          }

          set({ lobbyId: roomId, isHost: false, isLoading: false });
        } catch (err: any) {
          console.error("[Battle] Erro ao reconectar:", err);
          set({ error: err.message || "Erro ao reconectar", isLoading: false });
        }
      };

      colyseusService.on("battle:state_changed", handleStateChanged);
      colyseusService.on("battle:left", handleLeft);
      colyseusService.on("battle:error", handleError);
      colyseusService.on("session:active", handleSessionActive);

      // Check if already in battle
      if (colyseusService.isInBattle()) {
        const BattleState = colyseusService.getBattleState();
        if (BattleState) {
          handleStateChanged(BattleState);
        }
      }

      return () => {
        colyseusService.off("battle:state_changed", handleStateChanged);
        colyseusService.off("battle:left", handleLeft);
        colyseusService.off("battle:error", handleError);
        colyseusService.off("session:active", handleSessionActive);
      };
    },
  })
);
