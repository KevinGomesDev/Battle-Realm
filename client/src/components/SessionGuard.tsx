import React, { useEffect, useState } from "react";
import { useSession } from "../core";
import { useAuth } from "../features/auth";
import { useArena } from "../features/arena";

interface SessionGuardProps {
  children: React.ReactNode;
}

/**
 * SessionGuard - Verifica se há sessão ativa e aguarda restauração
 */
export const SessionGuard: React.FC<SessionGuardProps> = ({ children }) => {
  const { state: sessionState, checkSession } = useSession();
  const { state: authState } = useAuth();
  const { state: arenaState } = useArena();
  const [hasChecked, setHasChecked] = useState(false);
  const [isWaitingArenaRestore, setIsWaitingArenaRestore] = useState(false);
  const [waitStartTime, setWaitStartTime] = useState<number | null>(null);

  useEffect(() => {
    const checkForActiveSession = async () => {
      if (!authState.user?.id) return;

      await checkSession(authState.user.id);
      setHasChecked(true);
    };

    checkForActiveSession();
  }, [authState.user?.id, checkSession]);

  // Timeout para evitar espera infinita
  useEffect(() => {
    if (!isWaitingArenaRestore) {
      setWaitStartTime(null);
      return;
    }

    if (!waitStartTime) {
      setWaitStartTime(Date.now());
    }

    const timeout = setTimeout(() => {
      if (isWaitingArenaRestore && waitStartTime) {
        const elapsed = Date.now() - waitStartTime;
        if (elapsed > 5000) {
          console.warn(
            "%c[SessionGuard] ⚠️ Timeout aguardando restauração de arena",
            "color: #ef4444; font-weight: bold;"
          );
          setIsWaitingArenaRestore(false);
        }
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [isWaitingArenaRestore, waitStartTime]);

  // Verificar se precisa aguardar restauração de arena
  useEffect(() => {
    if (!hasChecked || !sessionState.activeSession) {
      setIsWaitingArenaRestore(false);
      return;
    }

    const session = sessionState.activeSession;

    // Se a sessão é arena_battle mas arenaState.battle ainda é null, aguardar
    if (session.type === "arena_battle" && !arenaState.battle) {
      console.log(
        "%c[SessionGuard] ⏳ Aguardando restauração de batalha de arena...",
        "color: #f59e0b; font-weight: bold;"
      );
      setIsWaitingArenaRestore(true);
      return;
    }

    // Se a sessão é arena_lobby mas arenaState.currentLobby ainda é null, aguardar
    if (session.type === "arena_lobby" && !arenaState.currentLobby) {
      console.log(
        "%c[SessionGuard] ⏳ Aguardando restauração de lobby de arena...",
        "color: #f59e0b; font-weight: bold;"
      );
      setIsWaitingArenaRestore(true);
      return;
    }

    // Arena restaurada
    if (isWaitingArenaRestore) {
      console.log(
        "%c[SessionGuard] ✅ Arena restaurada com sucesso!",
        "color: #22c55e; font-weight: bold;",
        {
          hasBattle: !!arenaState.battle,
          hasLobby: !!arenaState.currentLobby,
        }
      );
    }
    setIsWaitingArenaRestore(false);
  }, [
    hasChecked,
    sessionState.activeSession,
    arenaState.battle,
    arenaState.currentLobby,
    isWaitingArenaRestore,
  ]);

  // Mostrar loading enquanto verifica ou aguarda arena
  if ((!hasChecked && authState.user) || isWaitingArenaRestore) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-b from-citadel-obsidian via-citadel-slate to-citadel-obsidian">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-metal-bronze rounded-full animate-spin border-t-transparent" />
            <div
              className="absolute inset-2 border-3 border-metal-gold rounded-full animate-spin border-b-transparent"
              style={{ animationDirection: "reverse" }}
            />
          </div>
          <p
            className="text-parchment-aged text-lg"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {isWaitingArenaRestore
              ? "Restaurando sessão de arena..."
              : "Verificando sessão ativa..."}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
