import { useState, useEffect } from "react";
import { useMatch } from "../../features/match";
import { useKingdom } from "../../features/kingdom";
import { useSession } from "../../core";
import { useAuth } from "../../features/auth";

/**
 * Hook para expor a função de criar partida para o header
 */
export const useMatchSectionActions = () => {
  const {
    state: { kingdoms },
  } = useKingdom();
  const { createMatch } = useMatch();
  const { canJoinSession, state: sessionState } = useSession();
  const { state: authState } = useAuth();

  const [selectedKingdom, setSelectedKingdom] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (kingdoms.length > 0 && !selectedKingdom) {
      setSelectedKingdom(kingdoms[0].id);
    }
  }, [kingdoms, selectedKingdom]);

  const handleCreate = async (onSuccess?: () => void) => {
    console.log("[MatchSection] handleCreate called", {
      selectedKingdom,
      hasKingdoms: kingdoms.length > 0,
    });
    if (!selectedKingdom) {
      alert("Selecione um reino primeiro");
      return;
    }
    if (authState.user?.id) {
      const canJoin = await canJoinSession(authState.user.id);
      console.log("[MatchSection] canJoinSession result:", canJoin);
      if (!canJoin) {
        alert(sessionState.canJoinReason || "Você já está em uma sessão ativa");
        return;
      }
    }
    console.log("[MatchSection] Creating match with kingdom:", selectedKingdom);
    setIsCreating(true);
    try {
      await createMatch(selectedKingdom);
      console.log("[MatchSection] Match created successfully");
      onSuccess?.();
    } catch (err: any) {
      console.error("[MatchSection] Error creating match:", err);
      alert(err.message || "Erro ao criar partida");
    } finally {
      setIsCreating(false);
    }
  };

  return {
    handleCreate,
    isCreating,
    hasKingdoms: kingdoms.length > 0,
    selectedKingdom,
  };
};
