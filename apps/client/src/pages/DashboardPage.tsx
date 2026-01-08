import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMatch } from "../features/match";
import { useBattle } from "../features/battle";
import { EventHistory } from "../features/events";
import {
  SectionCard,
  Ranking,
  KingdomSection,
  useKingdomSectionActions,
  MatchSection,
  useMatchSectionActions,
  BattleSection,
  useBattleSectionActions,
  BattleSelectionProvider,
  MatchLobby,
  BattleLobby,
} from "../components/Dashboard";
import { SessionGuard } from "../components/SessionGuard";
import { Topbar } from "../components/Topbar";
import { CreateKingdomModal, useKingdom } from "../features/kingdom";
import { GlobalChat } from "../features/chat";
import { CharacterCreatorModal } from "../features/character-creator";
import type { CharacterConfig } from "../../../shared/types/character.types";
import { MAX_KINGDOMS_PER_USER } from "../../../shared/data/units.data";
import { Button } from "../components/Button";

// =============================================================================
// BOTÕES DE HEADER
// =============================================================================

/** Botão compacto para header - Fundar Reino */
const FundarReinoBtn: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
}> = ({ onClick, disabled, tooltip }) => (
  <Button
    variant="primary"
    size="xs"
    onClick={onClick}
    disabled={disabled}
    title={tooltip}
    icon="✦"
  >
    Fundar
  </Button>
);

/** Botão compacto para header - Criar Partida */
const CriarPartidaBtn: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}> = ({ onClick, disabled, isLoading }) => (
  <Button
    variant="danger"
    size="xs"
    onClick={onClick}
    disabled={disabled}
    isLoading={isLoading}
  >
    Criar Partida
  </Button>
);

/** Botão compacto para header - Criar Batalha */
const CriarBattleBtn: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}> = ({ onClick, disabled, isLoading }) => (
  <Button
    variant="mystic"
    size="xs"
    onClick={onClick}
    disabled={disabled}
    isLoading={isLoading}
  >
    Criar Batalha
  </Button>
);

/** Botão compacto para header - Criar Personagem */
const CriarPersonagemBtn: React.FC<{
  onClick: () => void;
}> = ({ onClick }) => (
  <Button variant="secondary" size="xs" onClick={onClick} icon="🎨">
    Criar Avatar
  </Button>
);

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

/**
 * Componente interno da Batalha que usa o Provider
 */
const BattleSectionWrapper: React.FC = () => {
  const { state: BattleState } = useBattle();
  const BattleActions = useBattleSectionActions();

  return (
    <SectionCard
      title="battle"
      icon="🏟️"
      accentColor="mystic"
      headerAction={
        !BattleState.lobbyId && (
          <div className="flex items-center gap-2">
            {/* Checkbox BOT */}
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={BattleActions.vsBot}
                onChange={(e) => BattleActions.setVsBot(e.target.checked)}
                className="w-3 h-3 accent-mystic-blue cursor-pointer"
              />
              <span className="text-[10px] text-surface-200">BOT?</span>
            </label>
            <CriarBattleBtn
              onClick={BattleActions.handleCreate}
              disabled={!BattleActions.hasKingdoms || BattleActions.isCreating}
              isLoading={BattleActions.isCreating}
            />
          </div>
        )
      }
    >
      {BattleState.lobbyId ? <BattleLobby /> : <BattleSection />}
    </SectionCard>
  );
};

/**
 * Dashboard Page - A CIDADELA DE PEDRA
 * Visão única com todas as seções lado a lado
 */
const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { state: matchState } = useMatch();
  const { state: BattleState } = useBattle();
  const { kingdoms } = useKingdom();

  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [isCharacterCreatorOpen, setIsCharacterCreatorOpen] = useState(false);

  // Hooks para ações dos headers
  const kingdomActions = useKingdomSectionActions();
  const matchActions = useMatchSectionActions();

  // Verificar limite de reinos
  const isKingdomLimitReached = kingdoms.length >= MAX_KINGDOMS_PER_USER;

  // Redirecionar para partida se ativa
  useEffect(() => {
    if (matchState.matchId && matchState.status !== "IDLE") {
      navigate("/match", { replace: true });
    }
  }, [matchState.matchId, matchState.status, navigate]);

  // Redirecionar para battle se em batalha
  useEffect(() => {
    if (BattleState.isInBattle || BattleState.winnerId) {
      navigate("/battle", { replace: true });
    }
  }, [BattleState.isInBattle, BattleState.winnerId, navigate]);

  return (
    <div className="relative min-h-screen flex flex-col bg-cosmos-void">
      {/* === AMBIENTE === */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-cosmos" />
        <div className="absolute inset-0 bg-cosmos-radial opacity-50" />
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
                <div className="flex items-center gap-2">
                  <CriarPersonagemBtn
                    onClick={() => setIsCharacterCreatorOpen(true)}
                  />
                  <FundarReinoBtn
                    onClick={kingdomActions.openModal}
                    disabled={isKingdomLimitReached}
                    tooltip={
                      isKingdomLimitReached
                        ? `Limite de ${MAX_KINGDOMS_PER_USER} reinos atingido`
                        : undefined
                    }
                  />
                </div>
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

            {/* 3. Batalha PvP - envolvido pelo Provider */}
            <BattleSelectionProvider>
              <BattleSectionWrapper />
            </BattleSelectionProvider>

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
            // A lista de reinos já é atualizada automaticamente pelo KingdomContext
          }}
        />
      )}

      {/* === MODAL DE CRIADOR DE PERSONAGEM === */}
      <CharacterCreatorModal
        isOpen={isCharacterCreatorOpen}
        onClose={() => setIsCharacterCreatorOpen(false)}
        onSave={(config: CharacterConfig, svgString: string) => {
          console.log("Personagem salvo:", config);
          console.log("SVG:", svgString);
          // TODO: Salvar personagem no backend
        }}
      />
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
