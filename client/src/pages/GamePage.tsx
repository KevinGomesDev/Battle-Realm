import React, { useEffect } from "react";
import { useMatch } from "../features/match";
import {
  MatchStatusDisplay,
  PlayerResourcesDisplay,
  MatchControls,
} from "../features/match";
import { MapCanvas } from "../features/map";
import { Topbar } from "../components/Topbar";

interface GamePageProps {
  matchId: string;
  onBack?: () => void;
}

/**
 * Página do Jogo - Mostra o jogo em andamento com todos os controles
 */
const GamePage: React.FC<GamePageProps> = ({
  matchId: propMatchId,
  onBack,
}) => {
  const {
    completeMatchState,
    requestMatchState,
    requestMapData,
    matchMapData,
    isLoading,
    error,
  } = useMatch();

  // Se não houver matchId na prop, tenta recuperar do sessionStorage
  const actualMatchId =
    propMatchId || sessionStorage.getItem("currentMatchId") || "";

  // Sincronizar estado ao montar
  useEffect(() => {
    if (!actualMatchId) return;

    const syncState = async () => {
      try {
        await requestMatchState(actualMatchId);
        await requestMapData(actualMatchId);
      } catch (err) {
        console.error("Erro ao sincronizar estado:", err);
      }
    };

    syncState();
  }, [actualMatchId, requestMatchState, requestMapData]);

  // Sincronizar na reconexão (já tratado automaticamente no MatchContext)
  useEffect(() => {
    // O listener para reconexão é gerenciado no MatchContext
    // que usa sessionStorage.getItem("currentMatchId") se necessário
  }, []);

  if (isLoading && !completeMatchState) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-3 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-400">Carregando partida...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (!completeMatchState) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 opacity-50">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div
            className="absolute top-40 right-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"
            style={{ animationDelay: "2s" }}
          ></div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 p-4">
        {/* Header */}
        <Topbar context="game" onBack={onBack} />

        {/* Main Game Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Left Sidebar - Info */}
          <div className="lg:col-span-1 space-y-4">
            <MatchStatusDisplay />
            <PlayerResourcesDisplay />
          </div>

          {/* Center - Map */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border-2 border-purple-500/30 p-4">
              <h3 className="text-lg font-bold text-purple-300 mb-3">
                🗺️ Mapa do Reino
              </h3>
              {matchMapData && completeMatchState ? (
                <MapCanvas
                  territories={matchMapData.territories}
                  players={completeMatchState.players}
                  onTerritoryClick={(_territory) => {
                    // Clique em território no modo de jogo
                  }}
                />
              ) : (
                <div className="text-center text-slate-400 py-8">
                  Carregando mapa...
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Actions */}
          <div className="lg:col-span-1 space-y-4">
            <MatchControls />

            {/* Placeholder para ações futuras */}
            <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border-2 border-blue-500/30 p-4">
              <h3 className="text-lg font-bold text-blue-300 mb-3">🎯 Ações</h3>
              <div className="text-center text-slate-400 text-sm py-8">
                <p>Ações do turno atual</p>
                <p className="text-xs mt-2">{completeMatchState.currentTurn}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }

        .animate-blob {
          animation: blob 7s infinite;
        }
      `}</style>
    </div>
  );
};

export default GamePage;
