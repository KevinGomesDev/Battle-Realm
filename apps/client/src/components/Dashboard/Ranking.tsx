import React, { useEffect, useState } from "react";
import { colyseusService } from "../../services/colyseus.service";
import type {
  RankingData,
  RankingTab,
} from "../../../../shared/types/ranking.types";

export const Ranking: React.FC = () => {
  const [ranking, setRanking] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<RankingTab>("battle");

  useEffect(() => {
    const handleRankingData = (data: RankingData) => {
      setRanking(data);
      setLoading(false);
    };

    const handleRankingError = () => {
      setLoading(false);
    };

    colyseusService.on("ranking:data", handleRankingData);
    colyseusService.on("ranking:error", handleRankingError);

    // Buscar ranking
    colyseusService.sendToGlobal("ranking:get", {});

    return () => {
      colyseusService.off("ranking:data", handleRankingData);
      colyseusService.off("ranking:error", handleRankingError);
    };
  }, []);

  const getRankIcon = (rank: number): string => {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return `#${rank}`;
    }
  };

  const getRankStyle = (rank: number): string => {
    switch (rank) {
      case 1:
        return "bg-yellow-500/10 border-yellow-500/30";
      case 2:
        return "bg-gray-400/10 border-gray-400/30";
      case 3:
        return "bg-orange-600/10 border-orange-500/30";
      default:
        return "bg-surface-800/30 border-surface-500/20";
    }
  };

  const currentRanking =
    activeTab === "battle" ? ranking?.battle : ranking?.match;

  return (
    <div className="space-y-2">
      {/* Tabs compactas */}
      <div className="flex gap-1 p-0.5 bg-surface-900/50 rounded">
        <button
          onClick={() => setActiveTab("battle")}
          className={`flex-1 py-1 px-2 text-[10px] font-semibold rounded transition-colors ${
            activeTab === "battle"
              ? "bg-mystic-blue/30 text-mystic-glow"
              : "text-astral-steel hover:text-astral-chrome"
          }`}
        >
          🏟️ Batalha
        </button>
        <button
          onClick={() => setActiveTab("match")}
          className={`flex-1 py-1 px-2 text-[10px] font-semibold rounded transition-colors ${
            activeTab === "match"
              ? "bg-red-500/30 text-red-400"
              : "text-astral-steel hover:text-astral-chrome"
          }`}
        >
          ⚔️ Partidas
        </button>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin w-5 h-5 border-2 border-stellar-amber border-t-transparent rounded-full" />
        </div>
      ) : !currentRanking || currentRanking.length === 0 ? (
        <div className="text-center py-6 text-astral-steel text-xs">
          <p className="text-xl mb-1">📜</p>
          <p>Nenhuma vitória registrada.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {currentRanking.slice(0, 5).map((entry) => (
            <div
              key={`${activeTab}-${entry.rank}`}
              className={`flex items-center gap-2 px-2 py-1.5 rounded border text-xs ${getRankStyle(
                entry.rank
              )}`}
            >
              {/* Rank */}
              <div className="w-6 text-center">
                {entry.rank <= 3 ? (
                  <span className="text-sm">{getRankIcon(entry.rank)}</span>
                ) : (
                  <span className="text-astral-steel text-[10px] font-bold">
                    {getRankIcon(entry.rank)}
                  </span>
                )}
              </div>

              {/* Username */}
              <span
                className={`flex-1 font-medium truncate ${
                  entry.rank === 1
                    ? "text-yellow-400"
                    : entry.rank === 2
                    ? "text-gray-300"
                    : entry.rank === 3
                    ? "text-orange-400"
                    : "text-astral-chrome"
                }`}
              >
                {entry.username}
              </span>

              {/* Victories */}
              <span className="text-astral-silver font-bold">
                ⚔️ {entry.victories}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
