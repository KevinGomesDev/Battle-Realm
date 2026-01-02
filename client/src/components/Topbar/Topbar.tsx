// client/src/components/Topbar/Topbar.tsx
// Componente de Topbar unificado que muda conteúdo baseado no contexto

import React, { useState } from "react";
import { useConnection } from "../../core";
import { useAuth } from "../../features/auth";
import { EventHistoryButton } from "../../features/events";
import { SwordManAvatar } from "../SwordManAvatar";
import type {
  ArenaKingdom,
  ArenaConfig,
} from "../../features/arena/types/arena.types";

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
    myKingdom: ArenaKingdom;
    opponentKingdom: ArenaKingdom;
    myUnitsAlive: number;
    enemyUnitsAlive: number;
    isMyTurn: boolean;
    config: ArenaConfig;
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
 * Logo do jogo
 */
const GameLogo: React.FC<{ size?: "sm" | "md" }> = ({ size = "md" }) => {
  const sizes = {
    sm: { container: "w-8 h-10", icon: "text-base" },
    md: { container: "w-10 h-12", icon: "text-xl" },
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className={`${sizes[size].container} bg-citadel-carved border-2 border-metal-iron rounded-b-lg shadow-stone-raised flex items-center justify-center`}
        style={{
          clipPath: "polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)",
        }}
      >
        <span className={sizes[size].icon}>🏰</span>
      </div>
      <h1
        className="text-xl font-bold tracking-wider text-parchment-light"
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        BATTLE REALM
      </h1>
    </div>
  );
};

/**
 * Status de conexão
 */
const ConnectionStatus: React.FC = () => {
  const { isConnected } = useConnection();

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
        isConnected
          ? "bg-green-900/30 border-green-600/50"
          : "bg-war-blood/30 border-war-crimson/50"
      }`}
    >
      <div
        className={`w-2.5 h-2.5 rounded-full ${
          isConnected ? "bg-green-500 animate-pulse" : "bg-war-crimson"
        }`}
      />
      <span
        className={`text-xs font-semibold ${
          isConnected ? "text-green-400" : "text-war-ember"
        }`}
      >
        {isConnected ? "Online" : "Offline"}
      </span>
    </div>
  );
};

/**
 * Informações do usuário
 */
const UserInfo: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="hidden sm:flex items-center gap-2">
      <div className="w-8 h-8 bg-gradient-to-b from-metal-bronze to-metal-copper rounded-md border border-metal-iron flex items-center justify-center">
        <span className="text-sm">👤</span>
      </div>
      <span
        className="text-parchment-light font-semibold text-sm"
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        {user.username}
      </span>
    </div>
  );
};

/**
 * Botão de logout
 */
const LogoutButton: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <button
      onClick={() => logout()}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-war-blood/30 hover:bg-war-blood/50 border border-war-crimson/50 hover:border-war-crimson rounded-lg transition-all group"
      title="Sair"
    >
      <span className="text-sm group-hover:scale-110 transition-transform">
        🚪
      </span>
      <span className="hidden sm:inline text-xs font-semibold text-war-ember group-hover:text-parchment-light transition-colors">
        Sair
      </span>
    </button>
  );
};

/**
 * Botão de voltar
 */
const BackButton: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  if (!onClick) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-citadel-slate/50 hover:bg-citadel-slate/80 border border-metal-iron rounded-lg transition-all"
    >
      <span className="text-sm">←</span>
      <span className="hidden sm:inline text-xs font-semibold text-parchment-light">
        Voltar
      </span>
    </button>
  );
};

/**
 * Indicador de Clima com tooltip (para contexto de batalha)
 */
const WeatherIndicator: React.FC<{
  emoji: string;
  name: string;
  effect: string;
  terrainName: string;
}> = ({ emoji, name, effect, terrainName }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="bg-citadel-obsidian/60 px-3 py-1 rounded border border-metal-iron cursor-help hover:bg-citadel-slate/50 transition-colors">
        <span className="text-xl">{emoji}</span>
      </div>
      {showTooltip && (
        <div className="absolute z-[200] top-full left-1/2 -translate-x-1/2 mt-2 w-56 p-3 bg-citadel-obsidian border border-metal-iron rounded-lg shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{emoji}</span>
            <div>
              <span className="text-parchment-light font-bold text-sm block">
                {name}
              </span>
              <span className="text-parchment-dark text-[10px]">
                Terreno: {terrainName}
              </span>
            </div>
          </div>
          <p className="text-parchment-aged text-xs leading-relaxed border-t border-metal-iron/30 pt-2">
            {effect}
          </p>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 w-2 h-2 bg-citadel-obsidian border-l border-t border-metal-iron" />
        </div>
      )}
    </div>
  );
};

/**
 * Painel de informações do reino (para contexto de batalha)
 */
const KingdomPanel: React.FC<{
  kingdom: ArenaKingdom;
  unitsAlive: number;
  isMyTurn?: boolean;
  isOpponent?: boolean;
}> = ({ kingdom, unitsAlive, isMyTurn = false, isOpponent = false }) => {
  const bgColor = isOpponent
    ? "bg-gradient-to-b from-red-600 to-red-800"
    : "bg-gradient-to-b from-blue-600 to-blue-800";
  const textColor = isOpponent ? "text-war-ember" : "text-green-400";

  return (
    <div
      className={`flex items-center gap-3 ${
        isOpponent ? "flex-row-reverse" : ""
      }`}
    >
      <div
        className={`w-10 h-10 ${bgColor} rounded-lg border-2 border-metal-iron flex items-center justify-center overflow-hidden`}
      >
        {isOpponent ? (
          <span className="text-xl">⚔️</span>
        ) : (
          <SwordManAvatar size={40} animation={isMyTurn ? 0 : 0} />
        )}
      </div>
      <div className={isOpponent ? "text-right" : ""}>
        <p
          className="text-parchment-light font-bold text-sm"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          {kingdom.name}
        </p>
        <p className={`${textColor} text-xs`}>
          {unitsAlive} unidade{unitsAlive !== 1 ? "s" : ""} viva
          {unitsAlive !== 1 ? "s" : ""}
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

    {/* DIREITA: Eventos + Usuário + Status + Logout */}
    <div className="flex items-center gap-4">
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

    {/* DIREITA: Eventos + Status */}
    <div className="flex items-center gap-4">
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
    <div className="flex items-center gap-4">
      <BackButton onClick={onBack} />
      <GameLogo size="sm" />
    </div>

    {/* DIREITA: Eventos + Usuário + Status */}
    <div className="flex items-center gap-4">
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

    {/* CENTRO: Clima e Separador */}
    <div className="flex items-center gap-4">
      {battleData.config.map && (
        <WeatherIndicator
          emoji={battleData.config.map.weatherEmoji}
          name={battleData.config.map.weatherName}
          effect={battleData.config.map.weatherEffect}
          terrainName={battleData.config.map.terrainName}
        />
      )}
      <span className="text-2xl font-bold text-war-crimson">⚔️</span>
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

  // Classes base da topbar
  const baseClasses = "relative z-20";
  const containerClasses =
    "bg-citadel-granite border-b-4 border-citadel-carved shadow-stone-raised";

  // Layout específico do contexto de batalha (mais compacto)
  if (context === "battle") {
    const { battleData } = props as TopbarBattleProps;
    return (
      <div className={baseClasses}>
        <div className="bg-citadel-slate/50 border-b border-metal-iron">
          <div className="px-4 py-2 flex items-center justify-between">
            <BattleLayout battleData={battleData} />
          </div>
        </div>
      </div>
    );
  }

  // Layout padrão para outros contextos
  return (
    <div className={baseClasses}>
      <div className={containerClasses}>
        <div className="absolute inset-0 bg-stone-texture opacity-50" />
        <div className="relative px-4 sm:px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            {context === "dashboard" && <DashboardLayout />}
            {context === "game" && <GameLayout onBack={onBack} />}
            {context === "lobby" && <LobbyLayout onBack={onBack} />}
          </div>
        </div>
      </div>
    </div>
  );
};
