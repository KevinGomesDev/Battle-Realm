import React, { useState } from "react";
import { useConnection } from "../core";
import { useAuth } from "../features/auth";
import { useMatch } from "../features/match";
import { useArena } from "../features/arena";
import { KingdomList } from "../components/Dashboard/KingdomList";
import { GameStateDebug } from "../components/Dashboard/GameStateDebug";
import { MatchList, MatchLobby } from "../features/match";
import { ArenaList, ArenaLobbyView, ArenaBattleView } from "../features/arena";
import { SessionGuard } from "../components/SessionGuard";
import MapPage from "./MapPage";

type DashboardTab = "home" | "match" | "arena";

/**
 * Dashboard Page - A CIDADELA DE PEDRA
 * Layout com 3 abas: Início, Encontrar Partida, Modo Arena
 */
const DashboardPage: React.FC = () => {
  const { isConnected } = useConnection();
  const { user, logout } = useAuth();
  const { currentMatch } = useMatch();
  const { state: arenaState } = useArena();

  const [activeTab, setActiveTab] = useState<DashboardTab>("home");
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);

  // Se há uma partida ativa, vai direto para o mapa
  if (currentMatch) {
    return <MapPage />;
  }

  // Se está em batalha de arena (ativa ou acabou de terminar com resultado pendente), mostrar tela de batalha
  if (arenaState.battle || arenaState.battleResult) {
    return <ArenaBattleView />;
  }

  const tabs: { id: DashboardTab; label: string; icon: string }[] = [
    { id: "home", label: "Início", icon: "🏰" },
    { id: "match", label: "Encontrar Partida", icon: "⚔️" },
    { id: "arena", label: "Modo Arena", icon: "🏟️" },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-citadel-obsidian">
      {/* === AMBIENTE: Vista da Cidadela === */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-citadel-slate via-citadel-obsidian to-black"></div>
        <div className="absolute inset-0 bg-torch-light opacity-40"></div>
        <div className="absolute top-0 left-0 w-1/4 h-full bg-gradient-to-r from-torch-glow/10 to-transparent"></div>
        <div className="absolute top-0 right-0 w-1/4 h-full bg-gradient-to-l from-torch-glow/10 to-transparent"></div>
      </div>

      {/* === TOPBAR SIMPLIFICADA === */}
      <div className="relative z-20">
        <div className="bg-citadel-granite border-b-4 border-citadel-carved shadow-stone-raised">
          <div className="absolute inset-0 bg-stone-texture opacity-50"></div>

          <div className="relative px-4 sm:px-6 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              {/* ESQUERDA: Logo e Título */}
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-12 bg-citadel-carved border-2 border-metal-iron rounded-b-lg shadow-stone-raised flex items-center justify-center"
                  style={{
                    clipPath: "polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)",
                  }}
                >
                  <span className="text-xl">🏰</span>
                </div>
                <div>
                  <h1
                    className="text-xl font-bold tracking-wider text-parchment-light"
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    BATTLE REALM
                  </h1>
                </div>
              </div>

              {/* DIREITA: Usuário + Status + Logout */}
              <div className="flex items-center gap-4">
                {/* Nome do Usuário */}
                {user && (
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
                )}

                {/* Status de Conexão */}
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                    isConnected
                      ? "bg-green-900/30 border-green-600/50"
                      : "bg-war-blood/30 border-war-crimson/50"
                  }`}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      isConnected
                        ? "bg-green-500 animate-pulse"
                        : "bg-war-crimson"
                    }`}
                  ></div>
                  <span
                    className={`text-xs font-semibold ${
                      isConnected ? "text-green-400" : "text-war-ember"
                    }`}
                  >
                    {isConnected ? "Online" : "Offline"}
                  </span>
                </div>

                {/* Botão de Logout */}
                {user && (
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
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === NAVEGAÇÃO POR ABAS === */}
      <div className="relative z-10 bg-citadel-slate/80 border-b border-metal-iron/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-3 font-semibold text-sm transition-all ${
                  activeTab === tab.id
                    ? "text-parchment-light"
                    : "text-parchment-dark hover:text-parchment-aged"
                }`}
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                <span className="flex items-center gap-2">
                  <span>{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-metal-bronze via-metal-gold to-metal-bronze"></div>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* === CONTEÚDO PRINCIPAL === */}
      <div className="relative z-10 p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          {/* TAB: INÍCIO (Dashboard) */}
          {activeTab === "home" && (
            <div className="space-y-6">
              {/* Reinos do Jogador */}
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-b from-metal-bronze to-metal-copper opacity-20 rounded-xl blur-sm"></div>
                <div className="relative bg-gradient-to-b from-citadel-granite to-citadel-carved border-4 border-metal-iron rounded-xl overflow-hidden shadow-stone-raised">
                  <div className="bg-gradient-to-r from-citadel-carved via-citadel-granite to-citadel-carved border-b-2 border-metal-rust/50 px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-metal-bronze border-2 border-metal-iron rounded flex items-center justify-center">
                        <span>🏰</span>
                      </div>
                      <h2
                        className="text-parchment-light font-bold tracking-wider"
                        style={{ fontFamily: "'Cinzel', serif" }}
                      >
                        SEUS REINOS
                      </h2>
                    </div>
                  </div>
                  <div className="p-6">
                    <KingdomList />
                  </div>
                </div>
              </div>

              {/* Debug (colapsável) */}
              <details className="group">
                <summary className="cursor-pointer list-none">
                  <div className="relative bg-gradient-to-b from-citadel-carved to-citadel-slate border-2 border-metal-iron/50 rounded-lg px-4 py-2 shadow-stone-inset hover:border-metal-iron transition-colors">
                    <span className="text-parchment-dark text-sm tracking-wide">
                      📜 Pergaminhos de Debug
                    </span>
                  </div>
                </summary>
                <div className="mt-2 relative bg-gradient-to-b from-citadel-slate to-citadel-obsidian border-2 border-metal-iron/30 rounded-xl p-4">
                  <GameStateDebug />
                </div>
              </details>
            </div>
          )}

          {/* TAB: ENCONTRAR PARTIDA */}
          {activeTab === "match" && (
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-b from-war-blood to-war-crimson opacity-30 rounded-xl blur-sm"></div>
              <div className="relative bg-gradient-to-b from-citadel-granite to-citadel-carved border-4 border-metal-iron rounded-xl overflow-hidden shadow-stone-raised">
                <div className="bg-gradient-to-r from-citadel-carved via-citadel-granite to-citadel-carved border-b-2 border-metal-rust/50 px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-war-crimson border-2 border-metal-iron rounded flex items-center justify-center">
                      <span>⚔️</span>
                    </div>
                    <h2
                      className="text-parchment-light font-bold tracking-wider"
                      style={{ fontFamily: "'Cinzel', serif" }}
                    >
                      SALA DE GUERRA
                    </h2>
                  </div>
                </div>

                <div className="p-6">
                  {activeMatchId ? (
                    <MatchLobby
                      matchId={activeMatchId}
                      onLeave={() => setActiveMatchId(null)}
                      onGameStart={() => {
                        // Jogo iniciado
                      }}
                    />
                  ) : (
                    <MatchList
                      onMatchCreated={(matchId) => setActiveMatchId(matchId)}
                      onMatchJoined={(matchId) => setActiveMatchId(matchId)}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: MODO ARENA */}
          {activeTab === "arena" && (
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-b from-purple-900 to-purple-700 opacity-30 rounded-xl blur-sm"></div>
              <div className="relative bg-gradient-to-b from-citadel-granite to-citadel-carved border-4 border-metal-iron rounded-xl overflow-hidden shadow-stone-raised">
                <div className="bg-gradient-to-r from-citadel-carved via-citadel-granite to-citadel-carved border-b-2 border-metal-rust/50 px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-700 border-2 border-metal-iron rounded flex items-center justify-center">
                      <span>🏟️</span>
                    </div>
                    <h2
                      className="text-parchment-light font-bold tracking-wider"
                      style={{ fontFamily: "'Cinzel', serif" }}
                    >
                      ARENA DE COMBATE
                    </h2>
                    <span className="text-xs text-purple-400 bg-purple-900/50 px-2 py-0.5 rounded border border-purple-600/50">
                      PvP 1v1
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  {arenaState.currentLobby ? (
                    <ArenaLobbyView
                      onLeave={() => {}}
                      onBattleStart={() => {}}
                    />
                  ) : (
                    <ArenaList />
                  )}
                </div>
              </div>

              {/* Descrição do Modo Arena */}
              {!arenaState.currentLobby && (
                <div className="mt-4 p-4 bg-citadel-slate/30 rounded-lg border border-metal-iron/30">
                  <h3 className="text-parchment-aged font-semibold mb-2">
                    ⚔️ O que é o Modo Arena?
                  </h3>
                  <p className="text-parchment-dark text-sm leading-relaxed">
                    A Arena é um modo de combate PvP independente de partidas.
                    Dois Regentes se enfrentam em um grid 20x20, usando suas
                    habilidades e estratégias para derrotar o oponente. Cada
                    Regente possui 3 marcas de ação por rodada.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* === FONTE === */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Cinzel+Decorative:wght@400;700&display=swap');
      `}</style>
    </div>
  );
};

// Wrap com SessionGuard para verificar sessão ativa
const DashboardPageWithSessionGuard: React.FC = () => {
  return (
    <SessionGuard>
      <DashboardPage />
    </SessionGuard>
  );
};

export default DashboardPageWithSessionGuard;
