import React, { useState, useEffect, useCallback, useRef } from "react";
import { useArena } from "../hooks/useArena";
import { useAuth } from "../../auth";
import {
  ArenaBattleCanvas,
  type SpriteDirection,
  type ArenaBattleCanvasRef,
} from "./canvas";
import {
  InitiativePanel,
  UnitPanel,
  BattleResultModal,
  BattleHeader,
  PauseMenu,
} from "./battle";
import { FullScreenLoading } from "@/components/FullScreenLoading";
import type { ArenaUnit } from "../types/arena.types";

/**
 * ArenaBattleView - Tela completa de batalha da Arena
 * Inclui o grid canvas, painel de unidade, controles e logs
 */
export const ArenaBattleView: React.FC = () => {
  const { user } = useAuth();
  const canvasRef = useRef<ArenaBattleCanvasRef>(null);
  const {
    state: {
      battle,
      battleResult,
      units,
      rematchPending,
      opponentWantsRematch,
    },
    beginAction,
    moveUnit,
    attackUnit,
    endAction,
    executeAction,
    surrender,
    requestRematch,
    dismissBattleResult,
  } = useArena();

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null); // Ação aguardando alvo
  const [unitDirection, setUnitDirection] = useState<{
    unitId: string;
    direction: SpriteDirection;
  } | null>(null);
  const [isPauseMenuOpen, setIsPauseMenuOpen] = useState(false);
  const autoEndTriggeredRef = useRef<boolean>(false); // Evita múltiplos auto-ends
  const isMovingRef = useRef<boolean>(false); // Lock para evitar cliques rápidos

  // Handler para abrir menu de pausa (ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPauseMenuOpen) {
        setIsPauseMenuOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPauseMenuOpen]);

  // Resetar flag de auto-end quando muda de turno
  useEffect(() => {
    autoEndTriggeredRef.current = false;
  }, [battle?.currentPlayerId, battle?.round]);

  // Auto-selecionar a unidade do turno atual quando muda de turno ou monta
  // E guiar câmera para ela
  useEffect(() => {
    if (!battle || !user) return;

    const isMyTurnNow = battle.currentPlayerId === user.id;
    if (isMyTurnNow) {
      // Encontrar minha unidade viva do turno atual
      const myAliveUnit = units.find((u) => u.ownerId === user.id && u.isAlive);
      if (myAliveUnit) {
        // SEMPRE selecionar minha unidade quando é meu turno
        setSelectedUnitId(myAliveUnit.id);

        // Guiar câmera para a unidade selecionada
        // Pequeno delay para garantir que o canvas está pronto
        setTimeout(() => {
          canvasRef.current?.centerOnUnit(myAliveUnit.id);
        }, 100);

        // Se a unidade ainda não iniciou ação, iniciar
        if (!myAliveUnit.hasStartedAction && myAliveUnit.movesLeft === 0) {
          beginAction(myAliveUnit.id);
        }
      }
    }
  }, [battle?.currentPlayerId, battle?.round, user?.id, units, beginAction]);

  // Auto-encerrar turno quando movimentos E ações acabarem
  useEffect(() => {
    if (!battle || !user || autoEndTriggeredRef.current) return;

    const isMyTurnNow = battle.currentPlayerId === user.id;
    if (!isMyTurnNow) return;

    const myUnit = units.find((u) => u.ownerId === user.id && u.isAlive);
    if (!myUnit) return;

    // Só verificar se a unidade já começou a ação (tem hasStartedAction)
    if (
      myUnit.hasStartedAction &&
      myUnit.movesLeft === 0 &&
      myUnit.actionsLeft === 0
    ) {
      console.log(
        "%c[ArenaBattleView] ✅ Movimentos e ações esgotados - Auto-encerrar turno",
        "color: #22c55e; font-weight: bold;"
      );
      autoEndTriggeredRef.current = true;
      // Pequeno delay para feedback visual
      setTimeout(() => {
        endAction(myUnit.id);
      }, 500);
    }
  }, [battle?.currentPlayerId, user?.id, units, endAction]);

  // Resetar lock de movimento quando unidade termina de mover
  useEffect(() => {
    // Resetar lock quando movesLeft muda (movimento foi processado)
    isMovingRef.current = false;
  }, [units]);

  // Handler para centralizar mapa em uma unidade (chamado pelo InitiativePanel)
  const handleInitiativeUnitClick = useCallback((unit: ArenaUnit) => {
    canvasRef.current?.centerOnUnit(unit.id);
  }, []);

  // Se só temos battleResult (sem battle), mostrar apenas o modal de resultado
  if (!battle && battleResult && user) {
    return (
      <div className="min-h-screen bg-citadel-obsidian flex items-center justify-center">
        <BattleResultModal
          result={battleResult}
          units={battleResult.finalUnits}
          isWinner={battleResult.winnerId === user.id}
          myKingdomName="Seu Reino"
          opponentKingdomName="Reino Oponente"
          myUserId={user.id}
          onRematch={requestRematch}
          onLeave={dismissBattleResult}
          rematchPending={rematchPending}
          opponentWantsRematch={opponentWantsRematch}
        />
      </div>
    );
  }

  if (!battle || !user) {
    return <FullScreenLoading message="Preparando a arena de batalha..." />;
  }

  const isMyTurn = battle.currentPlayerId === user.id;
  const selectedUnit = units.find((u) => u.id === selectedUnitId);
  const myUnits = units.filter((u) => u.ownerId === user.id && u.isAlive);
  const enemyUnits = units.filter((u) => u.ownerId !== user.id && u.isAlive);

  // Determinar o oponente
  const isHost = battle.hostKingdom.ownerId === user.id;
  const opponentKingdom = isHost ? battle.guestKingdom : battle.hostKingdom;
  const myKingdom = isHost ? battle.hostKingdom : battle.guestKingdom;

  // === MOVIMENTAÇÃO COM WASD ===
  const handleKeyboardMove = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      if (!selectedUnit || !isMyTurn || selectedUnit.ownerId !== user.id)
        return;
      if (selectedUnit.movesLeft <= 0) return;

      // Usar tamanho do grid do config da batalha
      const gridWidth = battle.config.grid.width;
      const gridHeight = battle.config.grid.height;

      let newX = selectedUnit.posX;
      let newY = selectedUnit.posY;

      switch (direction) {
        case "up":
          newY = Math.max(0, selectedUnit.posY - 1);
          break;
        case "down":
          newY = Math.min(gridHeight - 1, selectedUnit.posY + 1);
          break;
        case "left":
          newX = Math.max(0, selectedUnit.posX - 1);
          break;
        case "right":
          newX = Math.min(gridWidth - 1, selectedUnit.posX + 1);
          break;
      }

      // Verificar se a célula está ocupada
      const occupied = units.some(
        (u) => u.posX === newX && u.posY === newY && u.isAlive
      );

      // Sempre atualizar a direção do sprite baseado no movimento
      setUnitDirection({ unitId: selectedUnit.id, direction });

      // Bloquear cliques rápidos enquanto movimento está sendo processado
      if (isMovingRef.current) {
        return;
      }

      if (
        !occupied &&
        (newX !== selectedUnit.posX || newY !== selectedUnit.posY)
      ) {
        console.log(
          "%c[ArenaBattleView] ⌨️ Movimento WASD",
          "color: #22c55e; font-weight: bold;",
          {
            direction,
            from: { x: selectedUnit.posX, y: selectedUnit.posY },
            to: { x: newX, y: newY },
          }
        );
        isMovingRef.current = true; // Lock para evitar movimentos rápidos
        moveUnit(selectedUnit.id, newX, newY);
      }
    },
    [
      selectedUnit,
      isMyTurn,
      user.id,
      units,
      moveUnit,
      battle.config.grid.width,
      battle.config.grid.height,
    ]
  );

  // Event listener para teclas WASD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar se estiver digitando em um input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "w":
          e.preventDefault();
          handleKeyboardMove("up");
          break;
        case "s":
          e.preventDefault();
          handleKeyboardMove("down");
          break;
        case "a":
          e.preventDefault();
          handleKeyboardMove("left");
          break;
        case "d":
          e.preventDefault();
          handleKeyboardMove("right");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyboardMove]);

  const handleUnitClick = (unit: ArenaUnit) => {
    console.log(
      "%c[ArenaBattleView] 🎯 Clique em unidade",
      "color: #06b6d4; font-weight: bold;",
      {
        unitId: unit.id,
        unitName: unit.name,
        ownerId: unit.ownerId,
        isMyUnit: unit.ownerId === user.id,
        isMyTurn,
        currentlySelected: selectedUnitId,
        pendingAction,
      }
    );

    // Se há uma ação pendente aguardando alvo
    if (pendingAction === "attack" && selectedUnit && isMyTurn) {
      const dx = Math.abs(unit.posX - selectedUnit.posX);
      const dy = Math.abs(unit.posY - selectedUnit.posY);

      // Chebyshev distance: permite diagonais (8 direções)
      if (Math.max(dx, dy) === 1) {
        console.log(
          "%c[ArenaBattleView] ⚔️ Atacando alvo!",
          "color: #ef4444; font-weight: bold;",
          { targetId: unit.id, targetName: unit.name }
        );
        attackUnit(selectedUnit.id, unit.id);
        setPendingAction(null); // Limpa ação pendente
      } else {
        console.log(
          "%c[ArenaBattleView] ❌ Alvo fora de alcance",
          "color: #ef4444;"
        );
      }
      return;
    }

    // Comportamento padrão: selecionar unidade
    if (unit.ownerId === user.id) {
      console.log(
        "%c[ArenaBattleView] ✅ Selecionando minha unidade",
        "color: #22c55e;",
        {
          unitId: unit.id,
          unitName: unit.name,
          hasStartedAction: unit.hasStartedAction,
          movesLeft: unit.movesLeft,
        }
      );
      setSelectedUnitId(unit.id);
      setPendingAction(null); // Limpa ação pendente ao trocar unidade
      // Se é meu turno e a unidade NÃO começou a ação ainda, iniciar
      const hasNotStarted = !unit.hasStartedAction && unit.movesLeft === 0;
      if (isMyTurn && hasNotStarted) {
        console.log(
          "%c[ArenaBattleView] ▶️ Iniciando ação da unidade",
          "color: #f59e0b;",
          { unitId: unit.id }
        );
        beginAction(unit.id);
      }
    }
  };

  const handleCellClick = (x: number, y: number) => {
    console.log(
      "%c[ArenaBattleView] 🗺️ Clique em célula",
      "color: #8b5cf6; font-weight: bold;",
      {
        position: { x, y },
        hasSelectedUnit: !!selectedUnit,
        selectedUnitId,
        isMyTurn,
      }
    );

    // Bloquear cliques rápidos enquanto movimento está sendo processado
    if (isMovingRef.current) {
      console.log(
        "%c[ArenaBattleView] ⏳ Movimento em andamento, ignorando clique",
        "color: #f59e0b;"
      );
      return;
    }

    if (!selectedUnit || !isMyTurn) {
      console.log(
        "%c[ArenaBattleView] ⚠️ Movimento inválido - sem unidade ou não é meu turno",
        "color: #f59e0b;"
      );
      return;
    }

    // Calcular direção baseado no clique
    const deltaX = x - selectedUnit.posX;
    const deltaY = y - selectedUnit.posY;
    let clickDirection: SpriteDirection = "right";
    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      clickDirection = deltaX >= 0 ? "right" : "left";
    } else {
      clickDirection = deltaY >= 0 ? "down" : "up";
    }
    setUnitDirection({ unitId: selectedUnit.id, direction: clickDirection });

    // Tentar mover para a célula
    if (selectedUnit.movesLeft > 0) {
      const dx = Math.abs(x - selectedUnit.posX);
      const dy = Math.abs(y - selectedUnit.posY);
      console.log(
        "%c[ArenaBattleView] 🚶 Tentando mover unidade",
        "color: #06b6d4;",
        {
          unitId: selectedUnit.id,
          from: { x: selectedUnit.posX, y: selectedUnit.posY },
          to: { x, y },
          distance: dx + dy,
          movesLeft: selectedUnit.movesLeft,
          canMove: dx + dy <= selectedUnit.movesLeft,
        }
      );
      if (dx + dy <= selectedUnit.movesLeft) {
        console.log(
          "%c[ArenaBattleView] ✅ Movimento válido!",
          "color: #22c55e;"
        );
        isMovingRef.current = true; // Lock para evitar cliques rápidos
        moveUnit(selectedUnit.id, x, y);
      } else {
        console.log(
          "%c[ArenaBattleView] ❌ Distância muito grande",
          "color: #ef4444;"
        );
      }
    } else {
      console.log(
        "%c[ArenaBattleView] ❌ Sem movimentos restantes",
        "color: #ef4444;",
        { movesLeft: selectedUnit.movesLeft }
      );
    }
  };

  // Handler para clique em obstáculo
  const handleObstacleClick = (obstacle: {
    id: string;
    posX: number;
    posY: number;
    destroyed?: boolean;
  }) => {
    console.log(
      "%c[ArenaBattleView] 🪨 Clique em obstáculo",
      "color: #a855f7; font-weight: bold;",
      {
        obstacleId: obstacle.id,
        position: { x: obstacle.posX, y: obstacle.posY },
        hasSelectedUnit: !!selectedUnit,
        isMyTurn,
        pendingAction,
      }
    );

    // Se há ação de ataque pendente e estou adjacente (8 direções)
    if (pendingAction === "attack" && selectedUnit && isMyTurn) {
      const dx = Math.abs(obstacle.posX - selectedUnit.posX);
      const dy = Math.abs(obstacle.posY - selectedUnit.posY);

      // Chebyshev distance: permite diagonais
      if (Math.max(dx, dy) === 1) {
        console.log(
          "%c[ArenaBattleView] ⚔️ Atacando obstáculo!",
          "color: #ef4444; font-weight: bold;",
          { obstacleId: obstacle.id }
        );
        attackUnit(selectedUnit.id, undefined, obstacle.id);
        setPendingAction(null);
      } else {
        console.log(
          "%c[ArenaBattleView] ❌ Obstáculo fora de alcance",
          "color: #ef4444;"
        );
      }
    }
  };

  const handleEndAction = () => {
    console.log(
      "%c[ArenaBattleView] 🏁 Finalizando ação",
      "color: #f59e0b; font-weight: bold;",
      {
        unitId: selectedUnit?.id,
        unitName: selectedUnit?.name,
      }
    );
    if (selectedUnit) {
      endAction(selectedUnit.id);
      setSelectedUnitId(null);
    }
  };

  const handleSurrender = () => {
    console.log(
      "%c[ArenaBattleView] 🏳️ Rendendo...",
      "color: #ef4444; font-weight: bold;"
    );
    setIsPauseMenuOpen(false);
    surrender();
  };

  return (
    <div className="h-screen w-screen bg-citadel-obsidian flex flex-col overflow-hidden">
      {/* Menu de Pausa */}
      <PauseMenu
        isOpen={isPauseMenuOpen}
        onClose={() => setIsPauseMenuOpen(false)}
        onSurrender={handleSurrender}
      />

      {/* Header da Batalha - Fixo no topo */}
      <BattleHeader
        myKingdom={myKingdom}
        opponentKingdom={opponentKingdom}
        myUnitsAlive={myUnits.length}
        enemyUnitsAlive={enemyUnits.length}
        isMyTurn={isMyTurn}
        config={battle.config}
      />

      {/* Área Principal - Flex grow para preencher */}
      <div className="flex-1 flex min-h-0">
        {/* Painel de Iniciativa - Fixo à esquerda */}
        <InitiativePanel
          battle={battle}
          units={units}
          currentUserId={user.id}
          onUnitClick={handleInitiativeUnitClick}
        />

        {/* Canvas do Grid - Área principal */}
        <div className="flex-1 p-2 min-w-0">
          <div className="w-full h-full bg-citadel-granite rounded-xl border-4 border-metal-iron shadow-stone-raised">
            <ArenaBattleCanvas
              ref={canvasRef}
              battle={battle}
              units={units}
              currentUserId={user.id}
              selectedUnitId={selectedUnitId}
              onUnitClick={handleUnitClick}
              onCellClick={handleCellClick}
              onObstacleClick={handleObstacleClick}
              unitDirection={unitDirection}
            />
          </div>
        </div>

        {/* UnitPanel - Painel lateral direito */}
        <UnitPanel
          selectedUnit={selectedUnit ?? null}
          isMyTurn={isMyTurn}
          currentUserId={user.id}
          pendingAction={pendingAction}
          onSetPendingAction={setPendingAction}
          onExecuteAction={executeAction}
          onEndAction={handleEndAction}
        />
      </div>

      {/* Modal de Resultado da Batalha */}
      {battleResult && (
        <BattleResultModal
          result={battleResult}
          units={battleResult.finalUnits}
          isWinner={battleResult.winnerId === user.id}
          myKingdomName={myKingdom.name}
          opponentKingdomName={opponentKingdom.name}
          myUserId={user.id}
          onRematch={requestRematch}
          onLeave={dismissBattleResult}
          rematchPending={rematchPending}
          opponentWantsRematch={opponentWantsRematch}
        />
      )}
    </div>
  );
};
