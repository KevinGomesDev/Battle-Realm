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
import { useSession } from "../../../core";
import { useEvents } from "../../events";
import { arenaReducer, initialArenaState } from "./arenaReducer";
import { arenaLog, battleLog, lobbyLog } from "../utils";
import type {
  ArenaContextType,
  ArenaLobby,
  ArenaBattle,
  ArenaConfig,
  LobbyCreatedResponse,
  LobbiesListResponse,
  PlayerJoinedResponse,
  BattleStartedResponse,
  UnitMovedResponse,
  UnitAttackedResponse,
  BattleEndedResponse,
  ArenaLobbyStatus,
} from "../types/arena.types";
import type { BattleUnit } from "../../../../../shared/types/battle.types";
import { findSkillByCode } from "../../../../../shared/data/skills.data";

export const ArenaContext = createContext<ArenaContextType | null>(null);

interface ArenaProviderProps {
  children: ReactNode;
}

export const ArenaProvider: React.FC<ArenaProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(arenaReducer, initialArenaState);
  const { user } = useAuth();
  const { clearSession } = useSession();
  const { showToast } = useEvents();

  // Ref para acessar showToast no handler de socket
  const showToastRef = React.useRef(showToast);
  showToastRef.current = showToast;

  // Ref para acessar valores atuais nos handlers sem causar re-render do useEffect
  // IMPORTANTE: Atualizar sincronamente durante render, NÃO em useEffect!
  const stateRef = React.useRef(state);
  stateRef.current = state; // Atualiza a cada render

  // Setup socket event listeners
  useEffect(() => {
    if (!user) return;

    arenaLog("🎮", "Inicializando Arena Provider", { userId: user.id });

    const handleLobbyCreated = (data: LobbyCreatedResponse) => {
      lobbyLog("✅", "LOBBY CRIADO", {
        lobbyId: data.lobbyId,
        hostUserId: data.hostUserId,
        hostKingdomName: data.hostKingdomName,
        status: data.status,
      });
      const lobby: ArenaLobby = {
        lobbyId: data.lobbyId,
        hostUserId: data.hostUserId,
        maxPlayers: data.maxPlayers ?? 2,
        players: [
          {
            userId: data.hostUserId,
            username: user.username,
            kingdomId: "", // Will be updated when server sends full data
            kingdomName: data.hostKingdomName,
            playerIndex: 0,
            isReady: false,
          },
        ],
        status: data.status,
        createdAt: new Date(),
      };
      dispatch({ type: "SET_CURRENT_LOBBY", payload: lobby });
      dispatch({ type: "SET_IS_HOST", payload: true });
    };

    const handleLobbiesList = (data: LobbiesListResponse) => {
      lobbyLog("📋", "LISTA DE LOBBIES", {
        count: data.lobbies.length,
        lobbies: data.lobbies.map((l) => ({
          id: l.lobbyId,
          host:
            l.players.find((p) => p.playerIndex === 0)?.username ?? "Unknown",
          playersCount: l.players.length,
          maxPlayers: l.maxPlayers,
          status: l.status,
        })),
      });
      dispatch({ type: "SET_LOBBIES", payload: data.lobbies });
    };

    // Handler para atualizações em tempo real de lobbies (criação/remoção)
    const handleLobbiesUpdated = (data: {
      action: "created" | "removed";
      lobbyId?: string;
      lobby?: ArenaLobby;
    }) => {
      lobbyLog("🔄", "LOBBIES ATUALIZADOS", data);

      if (data.action === "created" && data.lobby) {
        // Adicionar novo lobby à lista (já vem no formato correto do servidor)
        dispatch({
          type: "SET_LOBBIES",
          payload: [...stateRef.current.lobbies, data.lobby],
        });
      } else if (data.action === "removed" && data.lobbyId) {
        // Remover lobby da lista
        dispatch({
          type: "SET_LOBBIES",
          payload: stateRef.current.lobbies.filter(
            (l) => l.lobbyId !== data.lobbyId
          ),
        });
      }
    };

    const handlePlayerJoined = (data: PlayerJoinedResponse) => {
      lobbyLog("👤", "JOGADOR ENTROU NO LOBBY", {
        lobbyId: data.lobbyId,
        players: data.players,
        status: data.status,
      });
      // Só atualiza se já estiver em um lobby (para o host e outros jogadores)
      // O jogador que entrou recebe arena:lobby_joined separadamente
      if (stateRef.current.currentLobby) {
        dispatch({
          type: "SET_CURRENT_LOBBY",
          payload: {
            ...stateRef.current.currentLobby,
            players: data.players,
            status: data.status,
          },
        });
      }
    };

    const handleLobbyJoined = (data: ArenaLobby) => {
      const host = data.players.find((p) => p.playerIndex === 0);
      lobbyLog("🚪", "ENTROU NO LOBBY", {
        lobbyId: data.lobbyId,
        hostUsername: host?.username,
        hostKingdomName: host?.kingdomName,
        playersCount: data.players.length,
        maxPlayers: data.maxPlayers,
      });
      dispatch({ type: "SET_CURRENT_LOBBY", payload: data });
      dispatch({ type: "SET_IS_HOST", payload: data.hostUserId === user.id });
    };

    const handleLobbyClosed = (data: { lobbyId: string; reason: string }) => {
      lobbyLog("🚫", "LOBBY FECHADO", {
        lobbyId: data.lobbyId,
        reason: data.reason,
      });
      dispatch({ type: "SET_CURRENT_LOBBY", payload: null });
      dispatch({ type: "SET_IS_HOST", payload: false });
      dispatch({ type: "SET_ERROR", payload: data.reason });
    };

    const handlePlayerLeft = (data: {
      lobbyId: string;
      userId: string;
      status: ArenaLobbyStatus;
      players: import("../../../../../shared/types/arena.types").ArenaLobbyPlayerInfo[];
    }) => {
      lobbyLog("🚶", "JOGADOR SAIU DO LOBBY", {
        lobbyId: data.lobbyId,
        userId: data.userId,
        status: data.status,
        remainingPlayers: data.players.length,
      });
      if (stateRef.current.currentLobby?.lobbyId === data.lobbyId) {
        dispatch({
          type: "SET_CURRENT_LOBBY",
          payload: {
            ...stateRef.current.currentLobby,
            players: data.players,
            status: data.status,
          },
        });
      }
    };

    const handleBattleStarted = (data: BattleStartedResponse) => {
      battleLog("⚔️", "BATALHA INICIADA!", {
        battleId: data.battleId,
        gridSize: `${data.config.grid.width}x${data.config.grid.height}`,
        unitsCount: data.units.length,
        kingdoms: data.kingdoms.map((k) => k.name),
        actionOrder: data.actionOrder,
      });
      battleLog(
        "🎯",
        "Unidades na batalha",
        data.units.map((u) => ({
          id: u.id,
          name: u.name,
          owner: u.ownerId,
          pos: `(${u.posX}, ${u.posY})`,
          hp: `${u.currentHp}/${u.vitality}`,
        }))
      );

      // Limpar estado anterior (necessário quando uma nova batalha começa)
      dispatch({ type: "SET_BATTLE_RESULT", payload: null });
      dispatch({ type: "SET_REMATCH_PENDING", payload: false });
      dispatch({ type: "SET_OPPONENT_WANTS_REMATCH", payload: false });

      const battle: ArenaBattle = {
        battleId: data.battleId,
        lobbyId: data.lobbyId, // Salvar lobbyId para revanche
        config: data.config, // Configuração visual completa do servidor
        maxPlayers: data.maxPlayers ?? data.kingdoms.length,
        kingdoms: data.kingdoms,
        round: 1,
        status: "ACTIVE",
        currentTurnIndex: 0,
        currentPlayerId: data.actionOrder[0],
        actionOrder: data.actionOrder,
        units: data.units,
        turnTimer: 30, // Timer inicial (será sincronizado pelo servidor)
      };
      dispatch({ type: "SET_BATTLE", payload: battle });
      dispatch({ type: "SET_UNITS", payload: data.units });
    };

    const handleActionStarted = (data: {
      battleId: string;
      unitId: string;
      movesLeft: number;
      actionsLeft: number;
      currentHp?: number;
      isAlive?: boolean;
      actionMarks?: number;
    }) => {
      battleLog("🎬", "AÇÃO INICIADA", {
        battleId: data.battleId,
        unitId: data.unitId,
        movesLeft: data.movesLeft,
        actionsLeft: data.actionsLeft,
        currentHp: data.currentHp,
        isAlive: data.isAlive,
      });
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: data.unitId,
          movesLeft: data.movesLeft,
          actionsLeft: data.actionsLeft,
          hasStartedAction: true,
          ...(data.currentHp !== undefined && { currentHp: data.currentHp }),
          ...(data.isAlive !== undefined && { isAlive: data.isAlive }),
          ...(data.actionMarks !== undefined && {
            actionMarks: data.actionMarks,
          }),
        },
      });
      // Definir unidade ativa no turno
      dispatch({
        type: "SET_BATTLE",
        payload: stateRef.current.battle
          ? {
              ...stateRef.current.battle,
              activeUnitId: data.unitId,
            }
          : null,
      });
    };

    const handleUnitMoved = (data: UnitMovedResponse) => {
      battleLog("🚶", "UNIDADE MOVEU", {
        unitId: data.unitId,
        from: `(${data.fromX}, ${data.fromY})`,
        to: `(${data.toX}, ${data.toY})`,
        movesLeft: data.movesLeft,
      });
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
      console.log("[ARENA-CLIENT] ⚔️ ATAQUE RECEBIDO:", {
        targetUnitId: data.targetUnitId,
        targetHpAfter: data.targetHpAfter,
        targetDefeated: data.targetDefeated,
        finalDamage: data.finalDamage,
        killedSummonIds: data.killedSummonIds,
      });

      battleLog("⚔️", "ATAQUE!", {
        attackerUnitId: data.attackerUnitId,
        targetUnitId: data.targetUnitId,
        damage: data.damage,
        targetHpAfter: data.targetHpAfter,
        damageType: data.damageType,
        attackerActionsLeft: data.attackerActionsLeft,
        missed: data.missed,
      });

      // Atualizar HP e proteções do alvo
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: data.targetUnitId,
          currentHp: data.targetHpAfter,
          physicalProtection: data.targetPhysicalProtection,
          magicalProtection: data.targetMagicalProtection,
          ...(data.targetDefeated ? { isAlive: false } : {}),
        },
      });

      // Atualizar ações e ataques extras do atacante
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: data.attackerUnitId,
          actionsLeft: data.attackerActionsLeft,
          attacksLeftThisTurn: data.attackerAttacksLeftThisTurn,
        },
      });

      // Matar invocações do alvo derrotado (summons morrem com o invocador)
      if (data.killedSummonIds && data.killedSummonIds.length > 0) {
        console.log(
          "[ARENA-CLIENT] 💀 Matando invocações do invocador:",
          data.killedSummonIds
        );
        for (const summonId of data.killedSummonIds) {
          dispatch({
            type: "UPDATE_UNIT",
            payload: { id: summonId, currentHp: 0, isAlive: false },
          });
        }
      }
    };

    const handleUnitDefeated = (data: { battleId: string; unitId: string }) => {
      console.log("[ARENA-CLIENT] 💀 UNIDADE DERROTADA:", data.unitId);
      battleLog("💀", "UNIDADE DERROTADA!", {
        battleId: data.battleId,
        unitId: data.unitId,
      });
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
      battleLog("💨", "DISPARADA!", data);
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: data.unitId,
          movesLeft: data.movesLeft,
          actionsLeft: data.actionsLeft,
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
      battleLog("🛡️", "ESQUIVA!", data);
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: data.unitId,
          actionsLeft: data.actionsLeft,
          conditions: data.conditions,
        },
      });
    };

    // Handler para Skill Usada
    const handleSkillUsed = (data: {
      battleId: string;
      casterUnitId: string;
      skillCode: string;
      skillName: string;
      targetUnitId: string | null;
      result: {
        healAmount?: number;
        damageDealt?: number;
        conditionApplied?: string;
        conditionRemoved?: string;
        actionsGained?: number;
      };
      casterActionsLeft: number;
      casterUnitCooldowns?: Record<string, number>;
      targetHpAfter?: number;
      targetDefeated?: boolean;
      casterName: string;
      targetName: string | null;
    }) => {
      battleLog("✨", "SKILL USADA!", {
        casterUnitId: data.casterUnitId,
        skillCode: data.skillCode,
        skillName: data.skillName,
        targetUnitId: data.targetUnitId,
        healAmount: data.result.healAmount,
        damageDealt: data.result.damageDealt,
        casterActionsLeft: data.casterActionsLeft,
      });

      // Atualizar ações e cooldowns do caster
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: data.casterUnitId,
          actionsLeft: data.casterActionsLeft,
          ...(data.casterUnitCooldowns && {
            unitCooldowns: data.casterUnitCooldowns,
          }),
        },
      });

      // Se há target e mudança de HP
      if (data.targetUnitId && data.targetHpAfter !== undefined) {
        dispatch({
          type: "UPDATE_UNIT",
          payload: {
            id: data.targetUnitId,
            currentHp: data.targetHpAfter,
            ...(data.targetDefeated ? { isAlive: false } : {}),
          },
        });
      }

      // Se ganhou ações (ACTION_SURGE, etc)
      if (data.result.actionsGained && data.result.actionsGained > 0) {
        dispatch({
          type: "UPDATE_UNIT",
          payload: {
            id: data.casterUnitId,
            actionsLeft: data.casterActionsLeft,
          },
        });
      }
    };

    const handleProtectionRecovered = (data: {
      battleId: string;
      unitId: string;
      physicalProtection: number;
      magicalProtection: number;
    }) => {
      battleLog("🛡️", "PROTEÇÃO RECUPERADA", {
        unitId: data.unitId,
        physicalProtection: data.physicalProtection,
        magicalProtection: data.magicalProtection,
      });
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: data.unitId,
          physicalProtection: data.physicalProtection,
          magicalProtection: data.magicalProtection,
        },
      });
    };

    const handleNextPlayer = (data: {
      battleId: string;
      currentPlayerId: string;
      index: number;
      round: number;
    }) => {
      battleLog("🔄", "PRÓXIMO JOGADOR", {
        battleId: data.battleId,
        currentPlayerId: data.currentPlayerId,
        turnIndex: data.index,
        round: data.round,
      });
      // Nota: NÃO resetamos unidades aqui - servidor envia estado atualizado
      // O reset real acontece no servidor e é sincronizado via battle:new_round
      dispatch({
        type: "SET_BATTLE",
        payload: stateRef.current.battle
          ? {
              ...stateRef.current.battle,
              currentPlayerId: data.currentPlayerId,
              currentTurnIndex: data.index,
              round: data.round, // Sincronizar round do servidor
              activeUnitId: undefined, // Resetar unidade ativa ao mudar jogador
            }
          : null,
      });
    };

    // Handler para sincronizar timer do turno (compartilhado pelo servidor)
    const handleTurnTimer = (data: {
      battleId: string;
      timer: number;
      currentPlayerId: string;
    }) => {
      // Atualiza o timer no estado da batalha
      dispatch({
        type: "SET_BATTLE",
        payload: stateRef.current.battle
          ? {
              ...stateRef.current.battle,
              turnTimer: data.timer,
              currentPlayerId: data.currentPlayerId,
            }
          : null,
      });
    };

    // Handler para atualização em massa de unidades (usado após spells, etc)
    const handleUnitsUpdated = (data: {
      units: Array<{
        id: string;
        currentHp?: number;
        isAlive?: boolean;
        actionsLeft?: number;
        posX?: number;
        posY?: number;
        conditions?: string[];
        unitCooldowns?: Record<string, number>;
      }>;
    }) => {
      battleLog("📦", "UNIDADES ATUALIZADAS", {
        count: data.units.length,
      });

      // Atualizar cada unidade recebida
      for (const unitUpdate of data.units) {
        dispatch({
          type: "UPDATE_UNIT",
          payload: unitUpdate,
        });
      }
    };

    // Handler para quando a unidade finaliza o turno
    const handleUnitTurnEnded = (data: {
      battleId: string;
      unitId: string;
      actionMarks: number;
      currentHp: number;
      isAlive: boolean;
      conditions: string[];
      hasStartedAction?: boolean;
      movesLeft?: number;
      actionsLeft?: number;
      attacksLeftThisTurn?: number;
    }) => {
      battleLog("⏹️", "TURNO FINALIZADO", data);
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: data.unitId,
          actionMarks: data.actionMarks,
          currentHp: data.currentHp,
          isAlive: data.isAlive,
          conditions: data.conditions,
          // Campos de recursos resetados pelo servidor
          ...(data.hasStartedAction !== undefined && {
            hasStartedAction: data.hasStartedAction,
          }),
          ...(data.movesLeft !== undefined && { movesLeft: data.movesLeft }),
          ...(data.actionsLeft !== undefined && {
            actionsLeft: data.actionsLeft,
          }),
          ...(data.attacksLeftThisTurn !== undefined && {
            attacksLeftThisTurn: data.attacksLeftThisTurn,
          }),
        },
      });
    };

    const handleNewRound = (data: {
      battleId: string;
      round: number;
      units?: Array<{
        id: string;
        hasStartedAction: boolean;
        movesLeft: number;
        actionsLeft: number;
        attacksLeftThisTurn: number;
        conditions: string[];
        currentHp: number;
        isAlive: boolean;
        unitCooldowns?: Record<string, number>;
      }>;
    }) => {
      battleLog("🔔", "NOVA RODADA", {
        battleId: data.battleId,
        round: data.round,
        previousRound: stateRef.current.battle?.round,
        unitsReceived: data.units?.length,
      });

      // Atualizar round no estado
      if (stateRef.current.battle) {
        const updatedBattle = {
          ...stateRef.current.battle,
          round: data.round,
          activeUnitId: undefined, // Resetar unidade ativa na nova rodada
        };
        dispatch({ type: "SET_BATTLE", payload: updatedBattle });
      }

      // Aplicar estado das unidades recebido do servidor (fonte de verdade)
      if (data.units && data.units.length > 0) {
        const updatedUnits = stateRef.current.units.map((u: BattleUnit) => {
          const serverUnit = data.units!.find((su) => su.id === u.id);
          if (serverUnit) {
            return {
              ...u,
              hasStartedAction: serverUnit.hasStartedAction,
              movesLeft: serverUnit.movesLeft,
              actionsLeft: serverUnit.actionsLeft,
              attacksLeftThisTurn: serverUnit.attacksLeftThisTurn,
              conditions: serverUnit.conditions,
              currentHp: serverUnit.currentHp,
              isAlive: serverUnit.isAlive,
              ...(serverUnit.unitCooldowns && {
                unitCooldowns: serverUnit.unitCooldowns,
              }),
            };
          }
          return u;
        });
        dispatch({ type: "SET_UNITS", payload: updatedUnits });
        console.log(
          `%c[ArenaContext] Nova rodada ${data.round} - ${data.units.length} unidades sincronizadas`,
          "color: #22c55e; font-weight: bold;"
        );
      }
    };

    const handleBattleEnded = (data: BattleEndedResponse) => {
      console.log("[ARENA-CLIENT] 🏆 BATALHA FINALIZADA:", {
        winnerId: data.winnerId,
        reason: data.reason,
        finalUnitsCount: data.finalUnits?.length,
        vsBot: data.vsBot,
      });

      battleLog("🏆", "BATALHA FINALIZADA!", {
        battleId: data.battleId,
        winnerId: data.winnerId,
        reason: data.reason,
        finalUnitsCount: data.finalUnits?.length,
      });
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
          vsBot: data.vsBot,
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
      arenaLog("❌", "ERRO", data.message);
      dispatch({ type: "SET_ERROR", payload: data.message });
    };

    // Handler para quando oponente desconecta temporariamente
    const handlePlayerDisconnected = (data: {
      lobbyId: string;
      userId: string;
    }) => {
      lobbyLog("⚠️", "OPONENTE DESCONECTOU", {
        lobbyId: data.lobbyId,
        userId: data.userId,
      });
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
      lobbyLog("✅", "OPONENTE RECONECTOU", {
        lobbyId: data.lobbyId,
        userId: data.userId,
      });
      // Limpar mensagem de erro
      dispatch({ type: "SET_ERROR", payload: null });
    };

    // Handler para quando oponente quer revanche
    const handleRematchRequested = (data: {
      lobbyId: string;
      userId: string;
    }) => {
      lobbyLog("🔄", "OPONENTE QUER REVANCHE", data);
      if (data.userId !== user.id) {
        dispatch({ type: "SET_OPPONENT_WANTS_REMATCH", payload: true });
      }
    };

    // Handler para quando oponente declina/sai do modal de revanche
    const handleRematchDeclined = (data: {
      lobbyId: string;
      userId: string;
      message: string;
    }) => {
      lobbyLog("🚫", "OPONENTE DECLINOU REVANCHE", data);
      // Só processar se não foi eu que declinei
      if (data.userId !== user.id) {
        dispatch({ type: "SET_REMATCH_PENDING", payload: false });
        dispatch({ type: "SET_OPPONENT_WANTS_REMATCH", payload: false });
        dispatch({
          type: "SET_ERROR",
          payload: "O oponente saiu. Revanche cancelada.",
        });
      }
    };

    // Handler para quando uma spell é conjurada
    const handleSpellCast = (data: {
      unitId: string;
      unitName: string;
      spellCode: string;
      spellName: string;
      result: {
        success: boolean;
        damageDealt?: number;
        targetIds?: string[];
        unitsMoved?: Array<{
          unitId: string;
          from: { x: number; y: number };
          to: { x: number; y: number };
        }>;
        conditionsApplied?: Array<{
          targetId: string;
          conditionId: string;
        }>;
      };
    }) => {
      battleLog("🔮", "SPELL CONJURADA", {
        unitName: data.unitName,
        spellName: data.spellName,
        result: data.result,
      });

      // Mostrar toast sobre a spell
      showToastRef.current({
        id: `spell-${Date.now()}`,
        timestamp: new Date(),
        context: "BATTLE",
        scope: "INDIVIDUAL",
        category: "COMBAT",
        severity: "INFO",
        battleId: state.battle?.battleId || "",
        targetUserIds: [user.id],
        message: `🔮 ${data.unitName} conjurou ${data.spellName}!`,
        code: "SPELL_CAST",
      });
    };

    // Handler para quando um obstáculo é destruído
    const handleObstacleDestroyed = (data: {
      battleId: string;
      obstacleId: string;
    }) => {
      battleLog("💥", "OBSTÁCULO DESTRUÍDO", {
        battleId: data.battleId,
        obstacleId: data.obstacleId,
      });
      dispatch({
        type: "DESTROY_OBSTACLE",
        payload: { obstacleId: data.obstacleId },
      });
    };

    // Handler para toasts de batalha (esquiva, dano, ataques extras, etc)
    const handleBattleToast = (data: {
      battleId: string;
      type: "info" | "success" | "warning" | "error";
      title: string;
      message: string;
      duration?: number;
    }) => {
      // Mostrar toast para todos os jogadores
      battleLog("🔔", "TOAST", {
        type: data.type,
        title: data.title,
        message: data.message,
      });

      // Mapear tipo do toast para severidade do evento
      const severityMap: Record<
        string,
        "INFO" | "SUCCESS" | "WARNING" | "DANGER"
      > = {
        info: "INFO",
        success: "SUCCESS",
        warning: "WARNING",
        error: "DANGER",
      };

      // Usar o sistema de eventos existente para mostrar toast
      showToastRef.current({
        id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        context: "BATTLE",
        scope: "INDIVIDUAL",
        category: "COMBAT",
        severity: severityMap[data.type] || "INFO",
        battleId: data.battleId,
        targetUserIds: [user.id],
        message: `${data.title} ${data.message}`,
        code: "COMBAT_TOAST",
      });
    };

    // Handler for session restoration (reconnection)
    const handleSessionRestored = (data: {
      lobbyId: string;
      hostUserId: string;
      maxPlayers: number;
      players: import("../../../../../shared/types/arena.types").ArenaLobbyPlayerInfo[];
      status: ArenaLobbyStatus;
      isHost: boolean;
      createdAt: string;
    }) => {
      const host = data.players.find((p) => p.playerIndex === 0);
      lobbyLog("🔄", "SESSÃO RESTAURADA (LOBBY)", {
        lobbyId: data.lobbyId,
        isHost: data.isHost,
        status: data.status,
        hostUsername: host?.username,
        playersCount: data.players.length,
      });
      const lobby: ArenaLobby = {
        lobbyId: data.lobbyId,
        hostUserId: data.hostUserId,
        maxPlayers: data.maxPlayers,
        players: data.players,
        status: data.status,
        createdAt: new Date(data.createdAt),
      };
      dispatch({ type: "SET_CURRENT_LOBBY", payload: lobby });
      dispatch({ type: "SET_IS_HOST", payload: data.isHost });
    };

    // Handler for battle restoration (reconnection during battle)
    const handleBattleRestored = (data: {
      battleId: string;
      lobbyId: string;
      config: ArenaConfig;
      maxPlayers: number;
      kingdoms: import("../../../../../shared/types/arena.types").ArenaKingdom[];
      round: number;
      status: "ACTIVE" | "ENDED";
      currentTurnIndex: number;
      currentPlayerId: string;
      turnTimer?: number;
      activeUnitId?: string; // Unidade ativa no momento da reconexão
      units: any[];
      actionOrder: string[];
    }) => {
      battleLog("🔄", "SESSÃO RESTAURADA (BATALHA)", {
        battleId: data.battleId,
        lobbyId: data.lobbyId,
        round: data.round,
        status: data.status,
        unitsCount: data.units.length,
        kingdomsCount: data.kingdoms.length,
        turnTimer: data.turnTimer,
        activeUnitId: data.activeUnitId,
      });
      const battle: ArenaBattle = {
        battleId: data.battleId,
        lobbyId: data.lobbyId, // Salvar lobbyId para revanche
        config: data.config, // Configuração visual completa do servidor
        maxPlayers: data.maxPlayers,
        kingdoms: data.kingdoms,
        round: data.round,
        status: data.status,
        currentTurnIndex: data.currentTurnIndex,
        currentPlayerId: data.currentPlayerId,
        actionOrder: data.actionOrder,
        units: data.units,
        activeUnitId: data.activeUnitId, // Restaurar unidade ativa
        turnTimer: data.turnTimer ?? 30, // Usar timer do servidor ou 30 como fallback
      };
      dispatch({ type: "SET_BATTLE", payload: battle });
      dispatch({ type: "SET_UNITS", payload: data.units });
    };

    // Register listeners
    socketService.on("battle:lobby_created", handleLobbyCreated);
    socketService.on("battle:lobbies_list", handleLobbiesList);
    socketService.on("battle:lobbies_updated", handleLobbiesUpdated);
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
    socketService.on("battle:turn_timer", handleTurnTimer);
    socketService.on("battle:new_round", handleNewRound);
    socketService.on("battle:battle_ended", handleBattleEnded);
    socketService.on("battle:unit_dashed", handleUnitDashed);
    socketService.on("battle:unit_dodged", handleUnitDodged);
    socketService.on("battle:skill_used", handleSkillUsed);
    socketService.on("battle:error", handleError);
    socketService.on("battle:session_restored", handleSessionRestored);
    socketService.on("battle:battle_restored", handleBattleRestored);
    socketService.on("battle:player_disconnected", handlePlayerDisconnected);
    socketService.on("battle:player_reconnected", handlePlayerReconnected);
    socketService.on("battle:rematch_requested", handleRematchRequested);
    socketService.on("battle:rematch_declined", handleRematchDeclined);
    socketService.on("battle:obstacle_destroyed", handleObstacleDestroyed);
    socketService.on("battle:toast", handleBattleToast);
    socketService.on("battle:units_updated", handleUnitsUpdated);
    socketService.on("skills:spell_cast", handleSpellCast);

    return () => {
      socketService.off("battle:lobby_created", handleLobbyCreated);
      socketService.off("battle:lobbies_list", handleLobbiesList);
      socketService.off("battle:lobbies_updated", handleLobbiesUpdated);
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
      socketService.off("battle:turn_timer", handleTurnTimer);
      socketService.off("battle:new_round", handleNewRound);
      socketService.off("battle:battle_ended", handleBattleEnded);
      socketService.off("battle:unit_dashed", handleUnitDashed);
      socketService.off("battle:unit_dodged", handleUnitDodged);
      socketService.off("battle:skill_used", handleSkillUsed);
      socketService.off("battle:error", handleError);
      socketService.off("battle:session_restored", handleSessionRestored);
      socketService.off("battle:battle_restored", handleBattleRestored);
      socketService.off("battle:player_disconnected", handlePlayerDisconnected);
      socketService.off("battle:player_reconnected", handlePlayerReconnected);
      socketService.off("battle:rematch_requested", handleRematchRequested);
      socketService.off("battle:rematch_declined", handleRematchDeclined);
      socketService.off("battle:obstacle_destroyed", handleObstacleDestroyed);
      socketService.off("battle:toast", handleBattleToast);
      socketService.off("battle:units_updated", handleUnitsUpdated);
      socketService.off("skills:spell_cast", handleSpellCast);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Efeito para solicitar restauração de sessão após listeners registrados
  // Resolve condição de corrida onde session:check é chamado antes dos listeners
  useEffect(() => {
    if (!user?.id) return;

    // Pequeno delay para garantir que os listeners foram registrados
    const timer = setTimeout(() => {
      // Re-solicitar check de sessão para garantir que os eventos de restauração
      // sejam recebidos pelos listeners que agora estão registrados
      arenaLog(
        "🔄",
        "Re-solicitando verificação de sessão (listeners prontos)",
        {
          userId: user.id,
        }
      );
      socketService.emit("session:check", { userId: user.id });
    }, 100);

    return () => clearTimeout(timer);
  }, [user?.id]);

  const createLobby = useCallback(
    (kingdomId: string, vsBot: boolean = false) => {
      if (!user) return;
      lobbyLog("⬆️", "EMIT: arena:create_lobby", {
        userId: user.id,
        kingdomId,
        vsBot,
      });
      dispatch({ type: "SET_LOADING", payload: true });
      socketService.emit("battle:create_lobby", {
        userId: user.id,
        kingdomId,
        vsBot,
      });
      dispatch({ type: "SET_LOADING", payload: false });
    },
    [user]
  );

  const listLobbies = useCallback(() => {
    lobbyLog("⬆️", "EMIT: arena:list_lobbies");
    socketService.emit("battle:list_lobbies");
  }, []);

  const joinLobby = useCallback(
    (lobbyId: string, kingdomId: string) => {
      if (!user) return;
      lobbyLog("⬆️", "EMIT: arena:join_lobby", {
        lobbyId,
        userId: user.id,
        kingdomId,
      });
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
    lobbyLog("⬆️", "EMIT: arena:leave_lobby", { userId: user.id });
    socketService.emit("battle:leave_lobby", { userId: user.id });
    dispatch({ type: "SET_CURRENT_LOBBY", payload: null });
    dispatch({ type: "SET_IS_HOST", payload: false });
  }, [user]);

  const startBattle = useCallback(() => {
    if (!user || !state.currentLobby) return;
    battleLog("⬆️", "EMIT: arena:start_battle", {
      lobbyId: state.currentLobby.lobbyId,
      userId: user.id,
    });
    socketService.emit("battle:start_battle", {
      lobbyId: state.currentLobby.lobbyId,
      userId: user.id,
    });
  }, [user, state.currentLobby]);

  const beginAction = useCallback(
    (unitId: string) => {
      if (!user || !state.battle) return;
      battleLog("⬆️", "EMIT: arena:begin_action", {
        battleId: state.battle.battleId,
        unitId,
        userId: user.id,
      });
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
      battleLog("⬆️", "EMIT: arena:move", {
        battleId: state.battle.battleId,
        unitId,
        toX,
        toY,
      });
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
    (
      attackerUnitId: string,
      targetUnitId?: string,
      targetObstacleId?: string
    ) => {
      if (!state.battle) return;
      if (!targetUnitId && !targetObstacleId) return;

      // Validação local: verificar se atacante tem ações
      const attacker = state.units.find((u) => u.id === attackerUnitId);
      if (!attacker || attacker.actionsLeft <= 0) {
        battleLog("⚠️", "Ataque bloqueado: sem ações disponíveis", {
          attackerUnitId,
          actionsLeft: attacker?.actionsLeft ?? 0,
        });
        return;
      }

      // Update otimista: decrementar actionsLeft imediatamente para evitar cliques duplos
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: attackerUnitId,
          actionsLeft: attacker.actionsLeft - 1,
        },
      });

      // Todos os ataques agora via battle:use_skill
      battleLog("⬆️", "EMIT: battle:use_skill (ATTACK)", {
        battleId: state.battle.battleId,
        casterUnitId: attackerUnitId,
        skillCode: "ATTACK",
        targetUnitId,
        targetObstacleId,
      });
      socketService.emit("battle:use_skill", {
        battleId: state.battle.battleId,
        casterUnitId: attackerUnitId,
        skillCode: "ATTACK",
        targetUnitId,
        targetObstacleId,
      });
    },
    [state.battle, state.units]
  );

  const endAction = useCallback(
    (unitId: string) => {
      if (!state.battle) return;
      battleLog("⬆️", "EMIT: arena:end_unit_action", {
        battleId: state.battle.battleId,
        unitId,
      });
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

      const unit = state.units.find((u) => u.id === unitId);
      if (!unit) {
        battleLog("⚠️", `${actionName} bloqueado: unidade não encontrada`, {
          unitId,
        });
        return;
      }

      // Determinar se a ação consome actionsLeft
      let consumesAction = false;
      // Dash não faz update otimista porque também altera movesLeft
      // O servidor responderá com ambos valores atualizados
      const skipOptimisticUpdate = actionName === "dash";

      if (actionName === "dash" || actionName === "dodge") {
        consumesAction = true;
      } else if (actionName === "use_skill" || actionName === "skill") {
        // Buscar skill para verificar consumesAction
        const skillCode = params?.skillCode as string | undefined;
        if (skillCode) {
          const skill = findSkillByCode(skillCode);
          // Só consome ação se a skill existir E consumesAction !== false
          consumesAction = skill ? skill.consumesAction !== false : true;
        }
      }

      // Validação e update otimista para ações que consomem actionsLeft
      // (exceto dash que altera movesLeft e precisa esperar resposta do servidor)
      if (consumesAction && !skipOptimisticUpdate) {
        if (unit.actionsLeft <= 0) {
          battleLog("⚠️", `${actionName} bloqueado: sem ações disponíveis`, {
            unitId,
            actionsLeft: unit.actionsLeft,
          });
          return;
        }

        // Update otimista
        dispatch({
          type: "UPDATE_UNIT",
          payload: {
            id: unitId,
            actionsLeft: unit.actionsLeft - 1,
          },
        });
      } else if (consumesAction && skipOptimisticUpdate) {
        // Apenas validar sem update otimista
        if (unit.actionsLeft <= 0) {
          battleLog("⚠️", `${actionName} bloqueado: sem ações disponíveis`, {
            unitId,
            actionsLeft: unit.actionsLeft,
          });
          return;
        }
      }

      const eventName = `battle:${actionName}`;
      const payload = {
        battleId: state.battle.battleId,
        unitId,
        ...params,
      };

      battleLog("⬆️", `EMIT: ${eventName}`, payload);

      socketService.emit(eventName, payload);
    },
    [state.battle, state.units]
  );

  // Função para conjurar spells
  const castSpell = useCallback(
    (
      unitId: string,
      spellCode: string,
      targetId?: string,
      targetPosition?: { x: number; y: number }
    ) => {
      if (!user || !state.battle) return;

      const unit = state.units.find((u) => u.id === unitId);
      if (!unit || unit.actionsLeft <= 0) {
        battleLog("⚠️", "castSpell bloqueado: sem ações disponíveis", {
          unitId,
          actionsLeft: unit?.actionsLeft ?? 0,
        });
        return;
      }

      battleLog("⬆️", "EMIT: skills:cast_spell", {
        battleId: state.battle.battleId,
        userId: user.id,
        unitId,
        spellCode,
        targetId,
        targetPosition,
      });

      // Update otimista
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: unitId,
          actionsLeft: unit.actionsLeft - 1,
        },
      });

      socketService.emit("skills:cast_spell", {
        battleId: state.battle.battleId,
        userId: user.id,
        unitId,
        spellCode,
        targetId,
        targetPosition,
      });
    },
    [user, state.battle, state.units]
  );

  const surrender = useCallback(() => {
    if (!user || !state.battle) return;
    battleLog("⬆️", "EMIT: arena:surrender", {
      battleId: state.battle.battleId,
      userId: user.id,
    });
    socketService.emit("battle:surrender", {
      battleId: state.battle.battleId,
      userId: user.id,
    });
  }, [user, state.battle]);

  const requestRematch = useCallback(() => {
    // Usar lobbyId do currentLobby ou do battle (para reconexão)
    const lobbyId = state.currentLobby?.lobbyId || state.battle?.lobbyId;
    if (!user || !lobbyId) {
      lobbyLog(
        "⚠️",
        "Não foi possível solicitar revanche: user ou lobbyId não encontrados",
        {
          user: !!user,
          currentLobby: !!state.currentLobby,
          battle: !!state.battle,
          lobbyId,
        }
      );
      return;
    }
    lobbyLog("⬆️", "EMIT: arena:request_rematch", {
      lobbyId,
      userId: user.id,
    });
    dispatch({ type: "SET_REMATCH_PENDING", payload: true });
    socketService.emit("battle:request_rematch", {
      lobbyId,
      userId: user.id,
    });
  }, [user, state.currentLobby, state.battle]);

  const dismissBattleResult = useCallback(() => {
    arenaLog("🚪", "Fechando modal de resultado");

    // Notificar o servidor que o jogador saiu (para cancelar revanche pendente)
    const lobbyId = state.currentLobby?.lobbyId || state.battle?.lobbyId;
    if (user && lobbyId) {
      arenaLog("⬆️", "EMIT: battle:decline_rematch", {
        lobbyId,
        userId: user.id,
      });
      socketService.emit("battle:decline_rematch", {
        lobbyId,
        userId: user.id,
      });
    }

    dispatch({ type: "SET_BATTLE_RESULT", payload: null });
    dispatch({ type: "SET_BATTLE", payload: null });
    dispatch({ type: "SET_UNITS", payload: [] });
    dispatch({ type: "SET_CURRENT_LOBBY", payload: null });
    dispatch({ type: "SET_IS_HOST", payload: false });
    dispatch({ type: "SET_REMATCH_PENDING", payload: false });
    dispatch({ type: "SET_OPPONENT_WANTS_REMATCH", payload: false });
    // Limpar sessão ativa para evitar loop de restauração
    clearSession();
  }, [clearSession, user, state.currentLobby, state.battle]);

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
      castSpell,
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
      castSpell,
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
