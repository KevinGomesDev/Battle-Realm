import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "./useSession";
import { useAuth } from "../../features/auth";
import { useBattleOptional } from "../../features/battle";
import { colyseusService } from "../../services/colyseus.service";
import type { SessionGuardState } from "@boundless/shared/types/session.types";

// ============================================
// Types
// ============================================

export interface SessionGuardResult {
  /** Estado atual do guard */
  guardState: SessionGuardState;
  /** Mensagem de loading (se aplicável) */
  loadingMessage: string | null;
  /** Se está pronto para renderizar o conteúdo */
  isReady: boolean;
  /** Se está em processo de carregamento */
  isLoading: boolean;
  /** Erro (se houver) */
  error: string | null;
  /** Força uma nova verificação */
  recheck: () => void;
}

// ============================================
// Constants
// ============================================

const TIMEOUT_MS = 5000;
const LOADING_MESSAGES: Record<SessionGuardState, string | null> = {
  idle: null,
  checking: "Verificando sessão ativa...",
  restoring: "Restaurando sessão...",
  ready: null,
  error: null,
};

// ============================================
// Hook
// ============================================

/**
 * Hook para gerenciar o fluxo de verificação de sessão
 *
 * Estados do fluxo:
 * 1. idle - Aguardando usuário
 * 2. checking - Verificando se há sessão ativa
 * 3. restoring - Aguardando restauração de batalha (se necessário)
 * 4. ready - Pronto para renderizar
 * 5. error - Erro ou timeout
 */
export function useSessionGuard(): SessionGuardResult {
  const { state: sessionState, checkSession } = useSession();
  const { state: authState } = useAuth();
  const battleStore = useBattleOptional();

  // O battleStore retorna o store diretamente, acessar campos dele
  const BattleState = battleStore
    ? {
        battle: battleStore.battle,
        battleId: battleStore.battleId,
      }
    : null;

  const [guardState, setGuardState] = useState<SessionGuardState>("idle");
  const [error, setError] = useState<string | null>(null);

  // Refs para evitar múltiplas verificações e timeouts
  const hasCheckedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup do timeout
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  /**
   * Verifica a sessão quando o usuário é autenticado NO SERVIDOR
   * Importante: esperar isServerValidated para garantir que o servidor
   * reconhece o cliente antes de enviar session:check
   */
  useEffect(() => {
    // Só verificar quando o servidor validou a autenticação
    if (!authState.user?.id || !authState.isServerValidated) {
      hasCheckedRef.current = false;
      setGuardState("idle");
      return;
    }

    if (hasCheckedRef.current) return;

    const performCheck = async () => {
      hasCheckedRef.current = true;
      setGuardState("checking");
      setError(null);

      try {
        await checkSession(authState.user!.id);
      } catch (err) {
        console.error("[SessionGuard] Erro ao verificar sessão:", err);
        setError("Erro ao verificar sessão");
        setGuardState("error");
      }
    };

    performCheck();
    // checkSession é estável do Zustand, não precisa ser dependência
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState.user?.id, authState.isServerValidated]);

  /**
   * Transição de checking -> restoring/ready após verificação
   */
  useEffect(() => {
    if (guardState !== "checking" || sessionState.isChecking) return;

    const session = sessionState.activeSession;

    // Sem sessão ativa - pronto
    if (!session?.type) {
      setGuardState("ready");
      return;
    }

    // Se não temos contexto de batalha, ir para ready (não bloquear)
    if (!BattleState) {
      setGuardState("ready");
      return;
    }

    // Para BATTLE_LOBBY: não bloquear, deixar o Dashboard redirecionar quando lobbyId existir
    // A reconexão vai acontecer em background via handleSessionActive
    if (session.type === "BATTLE_LOBBY") {
      console.log(
        "%c[SessionGuard] 🎮 Sessão de lobby detectada, continuando...",
        "color: #22c55e; font-weight: bold;"
      );
      setGuardState("ready");
      return;
    }

    // Para BATTLE_SESSION: verificar se precisa aguardar restauração
    const needsBattleRestore =
      session.type === "BATTLE_SESSION" &&
      !BattleState.battle &&
      !BattleState.battleId;

    if (needsBattleRestore) {
      console.log(
        "%c[SessionGuard] ⏳ Aguardando restauração de batalha...",
        "color: #f59e0b; font-weight: bold;",
        { sessionType: session.type }
      );
      setGuardState("restoring");
      return;
    }

    // Não precisa restaurar - pronto
    setGuardState("ready");
  }, [
    guardState,
    sessionState.isChecking,
    sessionState.activeSession,
    BattleState?.battle,
    BattleState?.battleId,
  ]);

  /**
   * Tentativa de reconexão quando entra em restoring
   * Serve como fallback caso o handler de evento session:active não funcione
   */
  useEffect(() => {
    if (guardState !== "restoring") return;

    const session = sessionState.activeSession;
    if (!session?.type || session.type !== "BATTLE_SESSION") return;

    const roomId = session.battleId || session.lobbyId;
    if (!roomId) return;

    // Verificar se já está conectado
    if (colyseusService.isInBattle()) {
      const currentRoom = colyseusService.getBattleRoom();
      if (currentRoom?.id === roomId) {
        console.log(
          "[SessionGuard] Já conectado à batalha, aguardando sync..."
        );
        return;
      }
    }

    // Tentar reconectar
    const performReconnection = async () => {
      try {
        // Obter kingdomId
        const userData = localStorage.getItem("auth_user");
        const authUser = userData ? JSON.parse(userData) : null;
        const selectedKingdom = localStorage.getItem("selected_kingdom");
        const kingdomId = selectedKingdom
          ? JSON.parse(selectedKingdom)?.id
          : authUser?.kingdoms?.[0]?.id;

        if (!kingdomId) {
          console.error(
            "[SessionGuard] Não foi possível encontrar kingdomId para reconexão"
          );
          return;
        }

        console.log(
          "[SessionGuard] Iniciando reconexão manual à batalha:",
          roomId
        );
        await colyseusService.joinBattleLobby(roomId, kingdomId);
        console.log("[SessionGuard] Reconexão manual completada");
      } catch (err) {
        console.error("[SessionGuard] Erro ao reconectar manualmente:", err);
      }
    };

    // Pequeno delay para dar tempo de handlers de eventos serem processados primeiro
    const timer = setTimeout(performReconnection, 100);
    return () => clearTimeout(timer);
  }, [guardState, sessionState.activeSession]);

  /**
   * Transição de restoring -> ready quando Batalha restaurada
   */
  useEffect(() => {
    if (guardState !== "restoring") return;

    const session = sessionState.activeSession;
    if (!session?.type) {
      setGuardState("ready");
      return;
    }

    // Se não temos contexto de Batalha, ir para ready
    if (!BattleState) {
      setGuardState("ready");
      return;
    }

    const isBattleRestored =
      session.type === "BATTLE_SESSION" &&
      (BattleState.battle || BattleState.battleId);

    if (isBattleRestored) {
      console.log(
        "%c[SessionGuard] ✅ Batalha restaurada!",
        "color: #22c55e; font-weight: bold;",
        {
          hasBattle: !!BattleState.battle,
          hasBattleId: !!BattleState.battleId,
        }
      );
      setGuardState("ready");
    }
  }, [
    guardState,
    sessionState.activeSession,
    BattleState?.battle,
    BattleState?.battleId,
  ]);

  /**
   * Timeout para evitar espera infinita no estado restoring
   */
  useEffect(() => {
    if (guardState !== "restoring") {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    timeoutRef.current = setTimeout(() => {
      console.warn(
        "%c[SessionGuard] ⚠️ Timeout aguardando restauração",
        "color: #ef4444; font-weight: bold;",
        {
          session: sessionState.activeSession,
          hasBattle: !!BattleState?.battle,
          hasBattleId: !!BattleState?.battleId,
        }
      );
      setError("Timeout ao restaurar sessão");
      setGuardState("ready"); // Continua mesmo com erro para não bloquear
    }, TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [guardState]);

  /**
   * Força uma nova verificação
   */
  const recheck = useCallback(() => {
    if (!authState.user?.id) return;
    hasCheckedRef.current = false;
    setGuardState("checking");
    setError(null);
    checkSession(authState.user.id);
    // checkSession é estável do Zustand
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState.user?.id]);

  // Computed values
  const isLoading = guardState === "checking" || guardState === "restoring";
  const isReady = guardState === "ready" || guardState === "error";
  const loadingMessage = LOADING_MESSAGES[guardState];

  return {
    guardState,
    loadingMessage,
    isReady,
    isLoading,
    error,
    recheck,
  };
}
