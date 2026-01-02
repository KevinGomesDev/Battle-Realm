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
  const { kingdoms, loadKingdoms, isLoading, error } = useKingdom();
  const { user } = useAuth();
  const hasLoadedRef = useRef(false);

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

  return (
    <div className="space-y-2">
      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin w-5 h-5 border-2 border-metal-bronze border-t-transparent rounded-full" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-war-blood/20 border border-war-crimson/50 rounded p-2">
          <p className="text-war-ember text-xs">⚠️ {error}</p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && kingdoms.length === 0 && (
        <div className="text-center py-4 bg-citadel-slate/20 rounded border border-dashed border-metal-iron/30">
          <div className="text-2xl mb-1">🏰</div>
          <p className="text-parchment-dark text-xs mb-2">
            Nenhum reino fundado
          </p>
          <p className="text-parchment-dark/60 text-[10px]">
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
                locationIndex: 0,
                ownerId: "",
                createdAt: new Date(),
                updatedAt: new Date(),
              }}
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
const KingdomCard: React.FC<{ kingdom: Kingdom }> = ({ kingdom }) => {
  const raceIcons: Record<string, string> = {
    HUMANOIDE: "👤",
    ABERRACAO: "👁️",
    CONSTRUTO: "🤖",
  };

  return (
    <div
      className="group flex items-center gap-2 p-2
                 bg-citadel-slate/30 border border-metal-iron/30 rounded
                 hover:border-metal-bronze/50 hover:bg-citadel-slate/50
                 transition-all cursor-pointer"
    >
      {/* Ícone */}
      <div className="w-7 h-7 bg-citadel-obsidian/50 border border-metal-iron/50 rounded flex items-center justify-center">
        <span className="text-sm">{raceIcons[kingdom.race] || "🏰"}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-semibold text-parchment-light truncate group-hover:text-metal-gold transition-colors">
          {kingdom.name}
        </h4>
      </div>

      {/* Badge */}
      <div className="text-[10px] text-parchment-dark px-1.5 py-0.5 bg-citadel-obsidian/30 rounded">
        💰 N/A
      </div>
    </div>
  );
};

/**
 * Hook para expor a função de abrir modal para o header
 */
export const useKingdomSectionActions = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return { isModalOpen, openModal, closeModal };
};
