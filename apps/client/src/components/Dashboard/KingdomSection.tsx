import React, { useEffect, useState, useRef } from "react";
import { useKingdom } from "../../features/kingdom";
import { useAuth } from "../../features/auth";
import type { Kingdom } from "../../features/kingdom";

interface KingdomSectionProps {
  /** Callback quando um reino é criado (para recarregar a lista) */
  onKingdomCreated?: () => void;
}

/**
 * KingdomSection - Conteúdo da seção de reinos (sem botão criar no corpo)
 * IMPORTANTE: Modal deve ser renderizado fora deste componente (no DashboardPage)
 */
export const KingdomSection: React.FC<KingdomSectionProps> = ({
  onKingdomCreated,
}) => {
  const { kingdoms, loadKingdoms, deleteKingdom, isLoading, error } =
    useKingdom();
  const { user } = useAuth();
  const hasLoadedRef = useRef(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (user && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadKingdoms().catch(console.error);
    }
  }, [user, loadKingdoms]);

  // Recarregar quando houver uma atualização externa
  useEffect(() => {
    if (onKingdomCreated) {
      loadKingdoms().catch(console.error);
    }
  }, [onKingdomCreated, loadKingdoms]);

  const handleDeleteClick = (kingdomId: string) => {
    setConfirmDeleteId(kingdomId);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;

    setDeletingId(confirmDeleteId);
    setConfirmDeleteId(null);

    try {
      await deleteKingdom(confirmDeleteId);
    } catch (err) {
      console.error("Erro ao deletar reino:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDeleteId(null);
  };

  return (
    <div className="space-y-2">
      {/* Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface-900 border border-red-500/50 rounded-lg p-4 max-w-sm mx-4 shadow-xl">
            <h3 className="text-sm font-semibold text-astral-chrome mb-2">
              ⚠️ Confirmar Deleção
            </h3>
            <p className="text-xs text-astral-silver mb-4">
              Tem certeza que deseja deletar este reino? Esta ação é
              irreversível e removerá todas as tropas e histórico de partidas.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancelDelete}
                className="px-3 py-1.5 text-xs bg-surface-700 hover:bg-surface-600 
                         text-astral-silver rounded transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 
                         text-white rounded transition-colors"
              >
                Deletar Reino
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin w-5 h-5 border-2 border-stellar-amber border-t-transparent rounded-full" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded p-2">
          <p className="text-red-400 text-xs">⚠️ {error}</p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && kingdoms.length === 0 && (
        <div className="text-center py-4 bg-surface-800/50 rounded border border-dashed border-surface-500/30">
          <div className="text-2xl mb-1">🏰</div>
          <p className="text-astral-silver text-xs mb-2">
            Nenhum reino fundado
          </p>
          <p className="text-astral-steel text-[10px]">
            Clique em "Fundar Reino" para começar!
          </p>
        </div>
      )}

      {/* Kingdom List */}
      {!isLoading && kingdoms.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {kingdoms.map((summary) => (
            <KingdomCard
              key={summary.id}
              kingdom={{
                id: summary.id,
                name: summary.name,
                race: summary.race,
                alignment: summary.alignment,
                ownerId: "",
                createdAt: new Date(),
                updatedAt: new Date(),
              }}
              onDelete={handleDeleteClick}
              isDeleting={deletingId === summary.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Card de Reino - Compacto
 */
const KingdomCard: React.FC<{
  kingdom: Kingdom;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}> = ({ kingdom, onDelete, isDeleting }) => {
  const raceIcons: Record<string, string> = {
    HUMANOIDE: "👤",
    ABERRACAO: "👁️",
    CONSTRUTO: "🤖",
  };

  return (
    <div
      className={`group flex items-center gap-2 p-2
                 bg-surface-800/50 border border-surface-500/30 rounded
                 hover:border-stellar-amber/50 hover:bg-surface-700/50
                 transition-all ${
                   isDeleting ? "opacity-50 pointer-events-none" : ""
                 }`}
    >
      {/* Ícone */}
      <div className="w-7 h-7 bg-surface-900/50 border border-surface-500/50 rounded flex items-center justify-center">
        <span className="text-sm">{raceIcons[kingdom.race] || "🏰"}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-semibold text-astral-chrome truncate group-hover:text-stellar-amber transition-colors">
          {kingdom.name}
        </h4>
      </div>

      {/* Badge */}
      <div className="text-[10px] text-astral-silver px-1.5 py-0.5 bg-surface-900/30 rounded">
        💰 N/A
      </div>

      {/* Delete Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(kingdom.id);
        }}
        disabled={isDeleting}
        className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 
                   hover:bg-red-500/20 rounded transition-all"
        title="Deletar Reino"
      >
        {isDeleting ? (
          <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
        ) : (
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
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        )}
      </button>
    </div>
  );
};
