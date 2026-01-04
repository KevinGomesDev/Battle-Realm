import React, { useState } from "react";
import { useMatch } from "../features/match";
import { useArena } from "../features/arena";
import { EventHistory } from "../features/events";
import {
  SectionCard,
  Ranking,
  KingdomSection,
  useKingdomSectionActions,
  MatchSection,
  useMatchSectionActions,
  ArenaSection,
  useArenaSectionActions,
  ArenaSelectionProvider,
  MatchLobby,
  ArenaLobby,
} from "../components/Dashboard";
import { ArenaBattleView } from "../features/arena";
import { SessionGuard } from "../components/SessionGuard";
import { Topbar } from "../components/Topbar";
import MapPage from "./MapPage";
import { CreateKingdomModal, useKingdom } from "../features/kingdom";
import { GlobalChat } from "../features/chat";
import { MAX_KINGDOMS_PER_USER } from "../../../shared/data/units";

// =============================================================================
// BOTÕES DE HEADER
// =============================================================================

/** Botão compacto para header - Fundar Reino */
const FundarReinoBtn: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
}> = ({ onClick, disabled, tooltip }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={tooltip}
    className={`px-2 py-0.5 text-[10px] font-semibold
               border border-metal-iron/50 rounded
               text-citadel-obsidian transition-all
               ${
                 disabled
                   ? "bg-gradient-to-b from-citadel-slate to-citadel-granite cursor-not-allowed opacity-60"
                   : "bg-gradient-to-b from-metal-bronze to-metal-copper hover:from-metal-gold hover:to-metal-bronze"
               }`}
  >
    ⚒️ Fundar
  </button>
);

/** Botão compacto para header - Criar Partida */
const CriarPartidaBtn: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}> = ({ onClick, disabled, isLoading }) => {
  const handleClick = () => {
    console.log("[CriarPartidaBtn] Button clicked", { disabled, isLoading });
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className="px-2 py-0.5 text-[10px] font-semibold
                 bg-gradient-to-b from-war-crimson to-war-blood
                 border border-metal-iron/50 rounded
                 hover:from-war-ember hover:to-war-crimson
                 disabled:from-citadel-slate disabled:to-citadel-granite
                 text-parchment-light transition-all disabled:cursor-not-allowed"
    >
      {isLoading ? "..." : "Criar Partida"}
    </button>
  );
};

/** Botão compacto para header - Criar Arena */
const CriarArenaBtn: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}> = ({ onClick, disabled, isLoading }) => {
  const handleClick = () => {
    console.log("[CriarArenaBtn] Button clicked", { disabled, isLoading });
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className="px-2 py-0.5 text-[10px] font-semibold
                 bg-gradient-to-b from-purple-600 to-purple-800
                 border border-metal-iron/50 rounded
                 hover:from-purple-500 hover:to-purple-700
                 disabled:from-citadel-slate disabled:to-citadel-granite
                 text-parchment-light transition-all disabled:cursor-not-allowed"
    >
      {isLoading ? "..." : "Criar Arena"}
    </button>
  );
};

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

/**
 * Componente interno da Arena que usa o Provider
 */
const ArenaSectionWrapper: React.FC = () => {
  const { state: arenaState } = useArena();
  const arenaActions = useArenaSectionActions();

  return (
    <SectionCard
      title="Arena"
      icon="🏟️"
      accentColor="purple"
      headerAction={
        !arenaState.currentLobby && (
          <div className="flex items-center gap-2">
            {/* Checkbox BOT */}
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={arenaActions.vsBot}
                onChange={(e) => arenaActions.setVsBot(e.target.checked)}
                className="w-3 h-3 accent-purple-500 cursor-pointer"
              />
              <span className="text-[10px] text-parchment-dark">BOT?</span>
            </label>
            <CriarArenaBtn
              onClick={arenaActions.handleCreate}
              disabled={!arenaActions.hasKingdoms || arenaActions.isCreating}
              isLoading={arenaActions.isCreating}
            />
          </div>
        )
      }
    >
      {arenaState.currentLobby ? <ArenaLobby /> : <ArenaSection />}
    </SectionCard>
  );
};

/**
 * Dashboard Page - A CIDADELA DE PEDRA
 * Visão única com todas as seções lado a lado
 */
const DashboardPage: React.FC = () => {
  const { currentMatch } = useMatch();
  const { state: arenaState } = useArena();
  const { kingdoms } = useKingdom();

  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);

  // Hooks para ações dos headers
  const kingdomActions = useKingdomSectionActions();
  const matchActions = useMatchSectionActions();

  // Verificar limite de reinos
  const isKingdomLimitReached = kingdoms.length >= MAX_KINGDOMS_PER_USER;

  // Se há uma partida ativa, vai direto para o mapa
  if (currentMatch) {
    return <MapPage />;
  }

  // Se está em batalha de arena, mostrar tela de batalha
  if (arenaState.battle || arenaState.battleResult) {
    return <ArenaBattleView />;
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-citadel-obsidian">
      {/* === AMBIENTE === */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-citadel-slate/80 via-citadel-obsidian to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-torch-glow/5 via-transparent to-transparent" />
      </div>

      {/* === TOPBAR === */}
      <Topbar context="dashboard" />

      {/* === CONTEÚDO PRINCIPAL === */}
      <div className="relative z-10 flex-1 p-3 overflow-auto">
        <div className="max-w-[1920px] mx-auto h-full">
          {/* Grid de 4 colunas */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 h-full">
            {/* 1. Seus Reinos */}
            <SectionCard
              title="Seus Reinos"
              icon="🏰"
              accentColor="bronze"
              headerAction={
                <FundarReinoBtn
                  onClick={kingdomActions.openModal}
                  disabled={isKingdomLimitReached}
                  tooltip={
                    isKingdomLimitReached
                      ? `Limite de ${MAX_KINGDOMS_PER_USER} reinos atingido`
                      : undefined
                  }
                />
              }
            >
              <KingdomSection />
            </SectionCard>

            {/* 2. Sala de Guerra */}
            <SectionCard
              title="Sala de Guerra"
              icon="⚔️"
              accentColor="crimson"
              headerAction={
                !activeMatchId && (
                  <CriarPartidaBtn
                    onClick={() =>
                      matchActions.handleCreate((id) => setActiveMatchId(id))
                    }
                    disabled={
                      !matchActions.hasKingdoms || matchActions.isCreating
                    }
                    isLoading={matchActions.isCreating}
                  />
                )
              }
            >
              {activeMatchId ? (
                <MatchLobby
                  matchId={activeMatchId}
                  onLeave={() => setActiveMatchId(null)}
                  onGameStart={() => {}}
                />
              ) : (
                <MatchSection
                  onMatchJoined={(matchId) => setActiveMatchId(matchId)}
                />
              )}
            </SectionCard>

            {/* 3. Arena de Combate - envolvido pelo Provider */}
            <ArenaSelectionProvider>
              <ArenaSectionWrapper />
            </ArenaSelectionProvider>

            {/* 4. Ranking */}
            <SectionCard title="Ranking" icon="🏆" accentColor="gold">
              <Ranking />
            </SectionCard>
          </div>

          {/* 5. Chat Global */}
          <div className="mt-3">
            <SectionCard title="Chat Global" icon="💬" accentColor="bronze">
              <GlobalChat />
            </SectionCard>
          </div>
        </div>
      </div>

      {/* === MODAL DE HISTÓRICO DE EVENTOS === */}
      <EventHistory />

      {/* === MODAL DE CRIAÇÃO DE REINO === */}
      {kingdomActions.isModalOpen && (
        <CreateKingdomModal
          onClose={kingdomActions.closeModal}
          onSuccess={() => {
            kingdomActions.closeModal();
            // Forçar recarregar reinos após criação
            window.location.reload();
          }}
        />
      )}

      {/* === FONTE === */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&display=swap');
      `}</style>
    </div>
  );
};

// Wrap com SessionGuard
const DashboardPageWithSessionGuard: React.FC = () => (
  <SessionGuard>
    <DashboardPage />
  </SessionGuard>
);

export default DashboardPageWithSessionGuard;
