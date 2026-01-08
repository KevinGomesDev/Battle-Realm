import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useMatch } from "../features/match";
import { useMap } from "../features/map/hooks/useMap";
import {
  MapCanvas,
  TopHUD,
  RightSidebar,
  TerritoryModal,
} from "../features/map";
import type { Territory, MapTerritory } from "../features/map";

/**
 * Map Page - Visualização principal do jogo
 * Tela principal quando há partida ativa
 */
const MapPage: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useMatch();
  const { state: mapState, requestMapData } = useMap();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado do modal de território - este é o único jeito de construir
  const [openTerritoryModal, setOpenTerritoryModal] =
    useState<Territory | null>(null);

  const matchId = state.matchId || "";
  const matchStatus = state.status;
  const inPreparation = matchStatus === "PREPARATION";
  const canBuild = inPreparation || state.phase === "ADMINISTRATION";

  // Redirecionar para dashboard se não há partida ativa
  useEffect(() => {
    if (!matchId || matchStatus === "IDLE" || matchStatus === "FINISHED") {
      navigate("/dashboard", { replace: true });
    }
  }, [matchId, matchStatus, navigate]);

  // Carregar dados do mapa ao montar
  useEffect(() => {
    if (matchId && mapState.territories.length === 0 && !mapState.isLoading) {
      setIsLoading(true);
      requestMapData(matchId)
        .catch((err) => setError(err?.message || "Failed to load map"))
        .finally(() => setIsLoading(false));
    }
  }, [
    matchId,
    mapState.territories.length,
    mapState.isLoading,
    requestMapData,
  ]);

  // Clique em território - abre modal se for do jogador e puder construir
  const handleTerritoryClick = useCallback(
    (territory: MapTerritory) => {
      // Verifica se é um território do jogador atual
      const isOwnTerritory = territory.ownerId === state.myPlayerId;

      if (isOwnTerritory && canBuild) {
        // Encontra o território completo no mapState
        const fullTerritory = mapState.territories.find(
          (t) => t.id === territory.id
        );
        if (fullTerritory) {
          setOpenTerritoryModal(fullTerritory);
        }
      }
    },
    [state.myPlayerId, canBuild, mapState.territories]
  );

  // Fecha modal de território
  const handleCloseTerritory = useCallback(() => {
    setOpenTerritoryModal(null);
  }, []);

  // Callback quando construção é bem-sucedida
  const handleBuildSuccess = useCallback(() => {
    // O estado será atualizado via Colyseus automaticamente
  }, []);

  const displayError = error || state.error || mapState.error;

  return (
    <div className="relative min-h-screen flex flex-col bg-surface-900">
      {/* Ambiente de Fundo Medieval */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-surface-800 via-surface-900 to-black" />
        <div className="absolute inset-0 bg-stellar-amber opacity-20" />
      </div>

      {/* TopHUD - Barra Superior */}
      <TopHUD />

      {/* RightSidebar - Sidebar Direita com suporte a território selecionado */}
      <RightSidebar
        selectedTerritory={openTerritoryModal}
        onCloseTerritory={handleCloseTerritory}
      />

      {/* Error Display */}
      {displayError && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-40 p-4 bg-red-800/90 border-2 border-red-500 rounded-lg shadow-stellar max-w-md pointer-events-auto">
          <p className="text-astral-chrome font-semibold">{displayError}</p>
        </div>
      )}

      {/* Loading State */}
      {(isLoading || mapState.isLoading) &&
        mapState.territories.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-30 bg-surface-900/80">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-astral-silver text-lg">Loading map...</p>
            </div>
          </div>
        )}

      {/* Map Canvas - Área principal */}
      {mapState.territories.length > 0 && (
        <div className="flex-1 relative flex items-center justify-center pr-80">
          <MapCanvas
            territories={mapState.territories}
            players={state.players || []}
            width={Math.min(1400, window.innerWidth - 400)}
            height={Math.min(900, window.innerHeight - 100)}
            onTerritoryClick={handleTerritoryClick}
          />
        </div>
      )}

      {/* Territory Modal - Sobrepõe apenas o mapa, não fullscreen */}
      {openTerritoryModal && state.myPlayerId && matchId && (
        <TerritoryModal
          territory={openTerritoryModal}
          playerId={state.myPlayerId}
          matchId={matchId}
          onClose={handleCloseTerritory}
          onBuildSuccess={handleBuildSuccess}
        />
      )}

      {/* Dica para o jogador durante preparação (quando nenhum território selecionado) */}
      {canBuild && !openTerritoryModal && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-surface-600/90 border-2 border-surface-500 rounded-lg px-6 py-3 shadow-card">
            <p
              className="text-astral-silver text-sm text-center"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              {inPreparation
                ? "Clique em um de seus territórios para construir estruturas gratuitas."
                : "Clique em um de seus territórios para administrar construções."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapPage;
