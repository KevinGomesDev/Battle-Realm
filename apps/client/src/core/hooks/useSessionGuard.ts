import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "./useSession";
import { useAuth } from "../../features/auth";
import { useBattleOptional } from "../../features/battle";
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
        lobbyId: battleStore.lobbyId,
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
   * Verifica a sessão quando o usuário é autenticado
   */
  useEffect(() => {
    if (!authState.user?.id) {
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
  }, [authState.user?.id, checkSession]);

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

    // Verifica se precisa aguardar restauração de batalha
    // Para BATTLE_SESSION: aguarda até BattleState.battle existir
    // Para BATTLE_LOBBY: aguarda até BattleState.lobbyId existir
    const needsBattleRestore =
      (session.type === "BATTLE_SESSION" && !BattleState.battle) ||
      (session.type === "BATTLE_LOBBY" && !BattleState.lobbyId);

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
    BattleState?.lobbyId,
  ]);

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
      (session.type === "BATTLE_SESSION" && BattleState.battle) ||
      (session.type === "BATTLE_LOBBY" && BattleState.lobbyId);

    if (isBattleRestored) {
      console.log(
        "%c[SessionGuard] ✅ Batalha restaurada!",
        "color: #22c55e; font-weight: bold;",
        {
          hasBattle: !!BattleState.battle,
          hasLobby: !!BattleState.lobbyId,
        }
      );
      setGuardState("ready");
    }
  }, [
    guardState,
    sessionState.activeSession,
    BattleState?.battle,
    BattleState?.lobbyId,
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
          hasLobbyId: !!BattleState?.lobbyId,
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
  }, [authState.user?.id, checkSession]);

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
