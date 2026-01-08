// client/src/components/Topbar/Topbar.tsx
// Componente de Topbar unificado que muda conteúdo baseado no contexto

import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useColyseusConnection } from "../../core";
import { useAuth } from "../../features/auth";
import { EventHistoryButton } from "../../features/events";
import { SwordManAvatar } from "../SwordManAvatar";
import { Tooltip } from "@/components/Tooltip";
import { Button } from "@/components/Button";
import type {
  BattleKingdom,
  BattleConfig,
} from "../../features/battle/types/battle.types";

// =============================================================================
// TIPOS
// =============================================================================

export type TopbarContext = "dashboard" | "game" | "battle" | "lobby";

interface TopbarBaseProps {
  /** Contexto determina o layout e conteúdo da topbar */
  context: TopbarContext;
  /** Callback para voltar (usado em alguns contextos) */
  onBack?: () => void;
  /** Título customizado (opcional) */
  title?: string;
}

interface TopbarBattleProps extends TopbarBaseProps {
  context: "battle";
  /** Dados específicos de batalha */
  battleData: {
    myKingdom: BattleKingdom;
    opponentKingdom: BattleKingdom;
    myUnitsAlive: number;
    enemyUnitsAlive: number;
    isMyTurn: boolean;
    config: BattleConfig;
  };
}

interface TopbarOtherProps extends TopbarBaseProps {
  context: "dashboard" | "game" | "lobby";
  battleData?: never;
}

type TopbarProps = TopbarBattleProps | TopbarOtherProps;

// =============================================================================
// COMPONENTES INTERNOS
// =============================================================================

/**
 * Logo do jogo - BOUNDLESS
 */
const GameLogo: React.FC<{ size?: "sm" | "md" }> = ({ size = "md" }) => {
  const isSmall = size === "sm";

  return (
    <div className="flex items-center gap-2">
      {/* Ícone */}
      <div
        className={`
          ${isSmall ? "w-7 h-7" : "w-9 h-9"}
          relative flex items-center justify-center
          bg-gradient-to-br from-stellar-amber via-stellar-gold to-stellar-dark
          rounded-lg
          shadow-[0_0_12px_rgba(251,191,36,0.4)]
        `}
      >
        <span className={`${isSmall ? "text-sm" : "text-lg"} text-cosmos-void`}>
          ✦
        </span>
      </div>

      {/* Título */}
      <h1
        className={`
          ${isSmall ? "text-base" : "text-lg"}
          font-bold tracking-[0.2em] uppercase
          bg-gradient-to-r from-stellar-light via-stellar-amber to-stellar-gold
          bg-clip-text text-transparent
        `}
        style={{ fontFamily: "'Orbitron', sans-serif" }}
      >
        Boundless
      </h1>
    </div>
  );
};

/**
 * Status de conexão - minimalista
 */
const ConnectionStatus: React.FC = () => {
  const { isConnected } = useColyseusConnection();

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`
          w-2 h-2 rounded-full
          ${
            isConnected
              ? "bg-ember-green shadow-[0_0_6px_rgba(34,197,94,0.6)]"
              : "bg-danger-DEFAULT"
          }
        `}
      />
      <span
        className={`
          text-xs font-medium
          ${isConnected ? "text-ember-glow" : "text-danger-light"}
        `}
      >
        {isConnected ? "Online" : "Offline"}
      </span>
    </div>
  );
};

/**
 * Informações do usuário - compacto
 */
const UserInfo: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-800/50 rounded-lg border border-surface-500/30">
      <div
        className="
          w-6 h-6 rounded-md
          bg-gradient-to-br from-stellar-amber to-stellar-deep
          flex items-center justify-center
          shadow-[0_0_8px_rgba(251,191,36,0.3)]
        "
      >
        <span className="text-[10px] text-cosmos-void font-bold">
          {user.username.charAt(0).toUpperCase()}
        </span>
      </div>
      <span
        className="text-sm font-semibold text-astral-chrome hidden sm:block"
        style={{ fontFamily: "'Rajdhani', sans-serif" }}
      >
        {user.username}
      </span>
    </div>
  );
};

/**
 * Botão de logout - minimalista
 */
const LogoutButton: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <Button
      variant="danger"
      size="sm"
      onClick={handleLogout}
      title="Sair"
      icon={
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
      }
    >
      <span className="hidden sm:inline">Sair</span>
    </Button>
  );
};

/**
 * Botão de voltar
 */
const BackButton: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  if (!onClick) return null;

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onClick}
      icon={
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      }
    >
      <span className="hidden sm:inline">Voltar</span>
    </Button>
  );
};

/**
 * Indicador de Terreno com tooltip (para contexto de batalha)
 */
const TerrainIndicator: React.FC<{
  emoji: string;
  name: string;
}> = ({ emoji, name }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const indicatorRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={indicatorRef}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className="
          px-3 py-1.5 rounded-lg
          bg-surface-800/60 border border-surface-500/30
          cursor-help hover:border-stellar-amber/30
          transition-all duration-200
        "
      >
        <span className="text-lg">{emoji}</span>
      </div>
      <Tooltip
        anchorRef={indicatorRef}
        visible={showTooltip}
        preferredPosition="bottom"
        width="w-40"
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">{emoji}</span>
          <span className="text-astral-chrome font-bold text-sm">{name}</span>
        </div>
      </Tooltip>
    </div>
  );
};

/**
 * Painel de informações do reino (para contexto de batalha)
 */
const KingdomPanel: React.FC<{
  kingdom: BattleKingdom;
  unitsAlive: number;
  isMyTurn?: boolean;
  isOpponent?: boolean;
}> = ({ kingdom, unitsAlive, isMyTurn = false, isOpponent = false }) => {
  const avatarGradient = isOpponent
    ? "from-danger-DEFAULT to-danger-dark"
    : "from-mystic-blue to-mystic-deep";

  const glowColor = isOpponent
    ? "shadow-[0_0_10px_rgba(239,68,68,0.3)]"
    : "shadow-[0_0_10px_rgba(59,130,246,0.3)]";

  const textColor = isOpponent ? "text-danger-light" : "text-ember-glow";

  return (
    <div
      className={`flex items-center gap-3 ${
        isOpponent ? "flex-row-reverse" : ""
      }`}
    >
      {/* Avatar */}
      <div
        className={`
          w-10 h-10 rounded-lg overflow-hidden
          bg-gradient-to-br ${avatarGradient}
          border border-surface-500/50
          ${glowColor}
          flex items-center justify-center
        `}
      >
        {isOpponent ? (
          <span className="text-xl">⚔️</span>
        ) : (
          <SwordManAvatar size={40} animation={isMyTurn ? 0 : 0} />
        )}
      </div>

      {/* Info */}
      <div className={isOpponent ? "text-right" : ""}>
        <p
          className="text-astral-chrome font-bold text-sm leading-tight"
          style={{ fontFamily: "'Rajdhani', sans-serif" }}
        >
          {kingdom.name}
        </p>
        <p className={`${textColor} text-xs`}>
          {unitsAlive} unidade{unitsAlive !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
};

// =============================================================================
// LAYOUTS POR CONTEXTO
// =============================================================================

/**
 * Layout padrão do Dashboard
 */
const DashboardLayout: React.FC = () => (
  <>
    {/* ESQUERDA: Logo */}
    <GameLogo />

    {/* DIREITA: Ações */}
    <div className="flex items-center gap-3">
      <EventHistoryButton />
      <UserInfo />
      <ConnectionStatus />
      <LogoutButton />
    </div>
  </>
);

/**
 * Layout do Game (Match)
 */
const GameLayout: React.FC<{ onBack?: () => void }> = ({ onBack }) => (
  <>
    {/* ESQUERDA: Voltar */}
    <BackButton onClick={onBack} />

    {/* CENTRO: Logo */}
    <GameLogo size="sm" />

    {/* DIREITA: Ações */}
    <div className="flex items-center gap-3">
      <EventHistoryButton />
      <ConnectionStatus />
    </div>
  </>
);

/**
 * Layout do Lobby
 */
const LobbyLayout: React.FC<{ onBack?: () => void }> = ({ onBack }) => (
  <>
    {/* ESQUERDA: Voltar + Logo */}
    <div className="flex items-center gap-3">
      <BackButton onClick={onBack} />
      <GameLogo size="sm" />
    </div>

    {/* DIREITA: Ações */}
    <div className="flex items-center gap-3">
      <EventHistoryButton />
      <UserInfo />
      <ConnectionStatus />
    </div>
  </>
);

/**
 * Layout de Batalha
 */
const BattleLayout: React.FC<{
  battleData: TopbarBattleProps["battleData"];
}> = ({ battleData }) => (
  <>
    {/* ESQUERDA: Meu Reino */}
    <KingdomPanel
      kingdom={battleData.myKingdom}
      unitsAlive={battleData.myUnitsAlive}
      isMyTurn={battleData.isMyTurn}
    />

    {/* CENTRO: Terreno e Separador */}
    <div className="flex items-center gap-3">
      {battleData.config.map && (
        <TerrainIndicator
          emoji={battleData.config.map.terrainEmoji}
          name={battleData.config.map.terrainName}
        />
      )}
      <div className="text-xl text-stellar-amber">⚔️</div>
    </div>

    {/* DIREITA: Reino Oponente */}
    <KingdomPanel
      kingdom={battleData.opponentKingdom}
      unitsAlive={battleData.enemyUnitsAlive}
      isOpponent
    />
  </>
);

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

export const Topbar: React.FC<TopbarProps> = (props) => {
  const { context, onBack } = props;

  // Layout específico do contexto de batalha
  if (context === "battle") {
    const { battleData } = props as TopbarBattleProps;
    return (
      <header className="relative z-20">
        <div
          className="
            bg-gradient-to-r from-cosmos-deep via-cosmos-dark to-cosmos-deep
            border-b border-surface-500/30
            backdrop-blur-sm
          "
        >
          <div className="px-4 py-2 flex items-center justify-between">
            <BattleLayout battleData={battleData} />
          </div>
        </div>
      </header>
    );
  }

  // Layout padrão para outros contextos
  return (
    <header className="relative z-20">
      {/* Background com gradiente sutil */}
      <div
        className="
          bg-gradient-to-r from-cosmos-void via-cosmos-deep to-cosmos-void
          border-b border-stellar-amber/20
        "
      >
        {/* Linha decorativa superior */}
        <div className="h-[1px] bg-gradient-to-r from-transparent via-stellar-amber/40 to-transparent" />

        {/* Conteúdo */}
        <div className="px-4 sm:px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            {context === "dashboard" && <DashboardLayout />}
            {context === "game" && <GameLayout onBack={onBack} />}
            {context === "lobby" && <LobbyLayout onBack={onBack} />}
          </div>
        </div>

        {/* Linha decorativa inferior */}
        <div className="h-[1px] bg-gradient-to-r from-transparent via-stellar-amber/20 to-transparent" />
      </div>
    </header>
  );
};
