import React, { useState, useEffect, useCallback, useRef } from "react";
import { useArena } from "../hooks/useArena";
import { useAuth } from "../../auth";
import { useDiceRoll } from "../../dice-roll";
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
import { BattleChat } from "../../chat";
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
      error: arenaError,
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
  const autoEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Timer para debounce do auto-end
  const unitsRef = useRef(units); // Ref para acessar units atualizado dentro do setTimeout
  const cameraCenteredRef = useRef<string | null>(null); // Controla se já centralizou a câmera neste turno

  // Hook de dice roll para verificar se animação está ativa
  const { isOpen: isDiceRollOpen } = useDiceRoll();
  const isDiceRollOpenRef = useRef(isDiceRollOpen);
  isDiceRollOpenRef.current = isDiceRollOpen;

  // Manter ref sincronizada
  useEffect(() => {
    unitsRef.current = units;
  }, [units]);

  // Handler para atalhos de teclado (ESC = menu pausa, Espaço = finalizar turno)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPauseMenuOpen) {
        setIsPauseMenuOpen(true);
      }
      // Espaço finaliza o turno se for meu turno e tenho unidade selecionada
      if (e.key === " " && battle && user) {
        e.preventDefault(); // Evitar scroll da página
        const isMyTurn = battle.currentPlayerId === user.id;
        const myUnit = units.find((u) => u.ownerId === user.id && u.isAlive);
        if (isMyTurn && myUnit && myUnit.hasStartedAction) {
          console.log(
            "%c[ArenaBattleView] ⌨️ Espaço pressionado - Finalizando turno",
            "color: #f59e0b; font-weight: bold;"
          );
          endAction(myUnit.id);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPauseMenuOpen, battle, user, units, endAction]);

  // Resetar flag de auto-end quando muda de turno
  useEffect(() => {
    autoEndTriggeredRef.current = false;
    cameraCenteredRef.current = null; // Permitir centralizar novamente no novo turno
  }, [battle?.currentPlayerId, battle?.round]);

  // Auto-selecionar a unidade do turno atual quando muda de turno ou monta
  // E guiar câmera para ela APENAS UMA VEZ no início do turno
  const beginActionCalledRef = useRef<string | null>(null); // Rastreia se beginAction já foi chamado para este turno

  useEffect(() => {
    if (!battle || !user) return;

    const isMyTurnNow = battle.currentPlayerId === user.id;

    // Reset do ref quando não é mais meu turno
    if (!isMyTurnNow) {
      beginActionCalledRef.current = null;
      return;
    }

    // Encontrar minha unidade viva do turno atual
    const myAliveUnit = units.find((u) => u.ownerId === user.id && u.isAlive);
    if (!myAliveUnit) return;

    // SEMPRE selecionar minha unidade quando é meu turno
    setSelectedUnitId(myAliveUnit.id);

    // Guiar câmera para a unidade selecionada APENAS UMA VEZ por turno
    // Usa a combinação currentPlayerId+round como chave para detectar novo turno
    const turnKey = `${battle.currentPlayerId}-${battle.round}`;
    if (cameraCenteredRef.current !== turnKey) {
      cameraCenteredRef.current = turnKey;
      // Pequeno delay para garantir que o canvas está pronto
      setTimeout(() => {
        canvasRef.current?.centerOnUnit(myAliveUnit.id);
      }, 100);
    }

    // Se ainda não há unidade ativa E esta unidade não iniciou ação → iniciar
    // Usar o turnKey para evitar chamar múltiplas vezes no mesmo turno
    const hasNoActiveUnit = !battle.activeUnitId;
    const shouldBeginAction =
      hasNoActiveUnit &&
      !myAliveUnit.hasStartedAction &&
      myAliveUnit.movesLeft === 0 &&
      myAliveUnit.actionsLeft === 0 &&
      beginActionCalledRef.current !== turnKey;

    if (shouldBeginAction) {
      console.log(
        `[ArenaBattleView] 🎬 Auto-iniciando ação para ${myAliveUnit.name} (turnKey: ${turnKey})`
      );
      beginActionCalledRef.current = turnKey;
      // Pequeno delay para garantir que o estado está sincronizado
      setTimeout(() => {
        beginAction(myAliveUnit.id);
      }, 50);
    }
  }, [
    battle?.currentPlayerId,
    battle?.round,
    battle?.activeUnitId,
    user?.id,
    units,
    beginAction,
  ]);

  // Auto-encerrar turno quando movimentos E ações acabarem
  // Usa debounce para evitar finalização prematura após skills que restauram movimento (ex: Disparada)
  useEffect(() => {
    // Limpar timer anterior se houver
    if (autoEndTimerRef.current) {
      clearTimeout(autoEndTimerRef.current);
      autoEndTimerRef.current = null;
    }

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
      // Usar debounce para dar tempo de respostas do servidor (ex: Disparada restaura movimento)
      autoEndTimerRef.current = setTimeout(() => {
        // Não encerrar se a animação do dado ainda está ativa
        if (isDiceRollOpenRef.current) {
          console.log(
            "%c[ArenaBattleView] ⏳ Aguardando animação do dado terminar antes de auto-encerrar",
            "color: #f59e0b; font-weight: bold;"
          );
          return;
        }

        // Verificar novamente após o delay usando ref para estado atualizado
        const currentUnits = unitsRef.current;
        const currentUnit = currentUnits.find(
          (u) => u.ownerId === user.id && u.isAlive
        );
        if (
          currentUnit &&
          currentUnit.hasStartedAction &&
          currentUnit.movesLeft === 0 &&
          currentUnit.actionsLeft === 0
        ) {
          console.log(
            "%c[ArenaBattleView] ✅ Movimentos e ações esgotados - Auto-encerrar turno",
            "color: #22c55e; font-weight: bold;"
          );
          autoEndTriggeredRef.current = true;
          endAction(currentUnit.id);
        }
      }, 600); // 600ms de debounce para dar tempo do servidor responder
    }

    // Cleanup
    return () => {
      if (autoEndTimerRef.current) {
        clearTimeout(autoEndTimerRef.current);
        autoEndTimerRef.current = null;
      }
    };
  }, [battle?.currentPlayerId, user?.id, units, endAction]);

  // Quando o dice roll fecha, verificar se deve auto-encerrar turno
  useEffect(() => {
    if (isDiceRollOpen) return; // Só processar quando fecha
    if (!battle || !user || autoEndTriggeredRef.current) return;

    const isMyTurnNow = battle.currentPlayerId === user.id;
    if (!isMyTurnNow) return;

    const myUnit = units.find((u) => u.ownerId === user.id && u.isAlive);
    if (!myUnit) return;

    // Verificar se deve auto-encerrar
    if (
      myUnit.hasStartedAction &&
      myUnit.movesLeft === 0 &&
      myUnit.actionsLeft === 0
    ) {
      console.log(
        "%c[ArenaBattleView] ✅ Dice roll fechou - Auto-encerrar turno",
        "color: #22c55e; font-weight: bold;"
      );
      autoEndTriggeredRef.current = true;
      endAction(myUnit.id);
    }
  }, [isDiceRollOpen, battle?.currentPlayerId, user?.id, units, endAction]);

  // Resetar lock de movimento quando unidade termina de mover OU quando há erro
  useEffect(() => {
    // Resetar lock quando movesLeft muda (movimento foi processado)
    isMovingRef.current = false;
  }, [units]);

  // Resetar lock de movimento quando há erro (ex: colisão com obstáculo)
  useEffect(() => {
    if (arenaError) {
      isMovingRef.current = false;
    }
  }, [arenaError]);

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

      // Calcular direção para sprite (baseado no movimento horizontal)
      const deltaX = newX - selectedUnit.posX;
      const spriteDirection: SpriteDirection = deltaX < 0 ? "left" : "right";
      setUnitDirection({ unitId: selectedUnit.id, direction: spriteDirection });

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
          activeUnitId: battle.activeUnitId,
        }
      );
      setSelectedUnitId(unit.id);
      setPendingAction(null); // Limpa ação pendente ao trocar unidade

      // Se é meu turno E não há unidade ativa ainda E esta unidade não começou ação
      // → iniciar ação desta unidade
      const hasNoActiveUnit = !battle.activeUnitId;
      const hasNotStarted = !unit.hasStartedAction && unit.movesLeft === 0;
      if (isMyTurn && hasNoActiveUnit && hasNotStarted) {
        console.log(
          "%c[ArenaBattleView] ▶️ Iniciando ação da unidade (primeira do turno)",
          "color: #f59e0b;",
          { unitId: unit.id }
        );
        beginAction(unit.id);
      } else if (
        isMyTurn &&
        battle.activeUnitId &&
        battle.activeUnitId !== unit.id
      ) {
        console.log(
          "%c[ArenaBattleView] 👁️ Apenas visualizando (outra unidade já está ativa)",
          "color: #8b5cf6;",
          { unitId: unit.id, activeUnitId: battle.activeUnitId }
        );
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

    // Calcular direção baseado no clique (apenas left/right para sprite)
    const deltaX = x - selectedUnit.posX;
    const clickDirection: SpriteDirection = deltaX < 0 ? "left" : "right";
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
              pendingAction={pendingAction}
            />
          </div>
        </div>

        {/* UnitPanel - Painel lateral direito */}
        <UnitPanel
          selectedUnit={selectedUnit ?? null}
          activeUnitId={battle.activeUnitId}
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

      {/* Chat de Batalha - Abre com Enter */}
      <BattleChat
        battleId={battle.battleId}
        currentUnitId={battle.activeUnitId}
        units={units}
        currentUserId={user.id}
      />
    </div>
  );
};
