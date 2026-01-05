import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useArena } from "../hooks/useArena";
import { useAuth } from "../../auth";
import {
  ArenaBattleCanvas,
  type SpriteDirection,
  type ArenaBattleCanvasRef,
} from "./canvas";
import {
  UnitPanel,
  BattleResultModal,
  BattleHeader,
  PauseMenu,
} from "./battle";
import { TurnStartModal } from "./shared";
import { FullScreenLoading } from "@/components/FullScreenLoading";
import { ChatProvider, useChat } from "../../chat";
import { ChatBox } from "../../chat/components/ChatBox";
import type { BattleUnit } from "../../../../../shared/types/battle.types";
import { getSpellByCode } from "../../../../../shared/data/spells.data";
import {
  findSkillByCode,
  isCommonAction,
} from "../../../../../shared/data/skills.data";
import { getFullMovementInfo } from "../../../../../shared/utils/engagement.utils";
import {
  getValidSkillTargets,
  isValidSkillTarget,
} from "../../../../../shared/utils/skill-validation";
import {
  isValidSpellTarget,
  isValidSpellPosition,
} from "../../../../../shared/utils/spell-validation";
import { socketService } from "../../../services/socket.service";
import {
  isPlayerControllable,
  getControllableUnits,
} from "../utils/unit-control";

/**
 * ArenaBattleView - Wrapper com ChatProvider
 */
export const ArenaBattleView: React.FC = () => {
  const { user } = useAuth();
  const {
    state: { battle },
  } = useArena();

  // Precisa do battleId para o ChatProvider
  if (!battle || !user) {
    return <FullScreenLoading message="Preparando a arena de batalha..." />;
  }

  return (
    <ChatProvider context="BATTLE" contextId={battle.battleId}>
      <ArenaBattleViewInner />
    </ChatProvider>
  );
};

/**
 * ArenaBattleViewInner - Conteúdo da batalha (dentro do ChatProvider)
 */
const ArenaBattleViewInner: React.FC = () => {
  const { user } = useAuth();
  const { state: chatState } = useChat();
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
    castSpell,
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
  const [showTurnStartModal, setShowTurnStartModal] = useState(false);
  const [isRoundStart, setIsRoundStart] = useState(false); // Indica se é início de rodada
  const [isTurnLocked, setIsTurnLocked] = useState(false); // Trava interações durante o modal de turno
  const [showDelayedBattleResult, setShowDelayedBattleResult] = useState(false); // Delay para mostrar modal de vitória
  const autoEndTriggeredRef = useRef<boolean>(false); // Evita múltiplos auto-ends
  const isMovingRef = useRef<boolean>(false); // Lock para evitar cliques rápidos
  const autoEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Timer para debounce do auto-end
  const turnModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Timer para delay do modal de turno
  const unitsRef = useRef(units); // Ref para acessar units atualizado dentro do setTimeout
  const cameraCenteredRef = useRef<string | null>(null); // Controla se já centralizou a câmera neste turno
  const turnModalShownRef = useRef<string | null>(null); // Controla se já mostrou o modal neste turno
  const lastRoundRef = useRef<number | null>(null); // Rastreia a última rodada para detectar mudança

  // Manter ref sincronizada
  useEffect(() => {
    unitsRef.current = units;
  }, [units]);

  // Ouvir eventos de combate para disparar animações
  useEffect(() => {
    // Handler para ataque - anima atacante (Sword) e alvo (Damage)
    const handleUnitAttacked = (data: {
      attackerUnitId: string;
      targetUnitId: string | null;
      missed?: boolean;
    }) => {
      // Animação de ataque no atacante
      if (canvasRef.current && data.attackerUnitId) {
        canvasRef.current.playAnimation(data.attackerUnitId, "Sword_1");
      }
      // Animação de dano no alvo (se não errou e tem alvo válido)
      if (!data.missed && data.targetUnitId && canvasRef.current) {
        // Pequeno delay para o dano aparecer após o golpe
        setTimeout(() => {
          canvasRef.current?.playAnimation(data.targetUnitId!, "Damage");
        }, 200);
      }
    };

    // Handler para erros - reseta lock de movimento imediatamente
    const handleBattleError = () => {
      isMovingRef.current = false;
    };

    socketService.on("battle:unit_attacked", handleUnitAttacked);
    socketService.on("battle:error", handleBattleError);

    return () => {
      socketService.off("battle:unit_attacked", handleUnitAttacked);
      socketService.off("battle:error", handleBattleError);
    };
  }, []);

  // Handler para atalhos de teclado (ESC = menu pausa, Espaço = finalizar turno)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar se estiver digitando em um input/textarea
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (e.key === "Escape" && !isPauseMenuOpen) {
        setIsPauseMenuOpen(true);
      }
      // Espaço finaliza o turno se for meu turno e tenho unidade selecionada
      // MAS não se estiver digitando no chat
      if (e.key === " " && battle && user && !isTyping) {
        e.preventDefault(); // Evitar scroll da página
        const isMyTurn = battle.currentPlayerId === user.id;
        const myUnit = units.find(
          (u) => isPlayerControllable(u, user.id) && u.isAlive
        );
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
    beginActionCalledRef.current = null; // Resetar para permitir novo beginAction
    // Limpar ação pendente quando o turno muda
    setPendingAction(null);
    // NÃO limpar selectedUnitId aqui - será gerenciado pelo próximo useEffect
  }, [battle?.currentPlayerId, battle?.round]);

  // Mostrar modal de "Turno começou!" quando muda de turno
  // Delay antes de mostrar o modal de início de turno (ms)
  // Isso dá tempo para animações do turno anterior terminarem
  const TURN_MODAL_DELAY = 800;
  // Delay para mostrar o modal de vitória (ms)
  const BATTLE_RESULT_DELAY = 2000;

  useEffect(() => {
    if (!battle || !user) return;

    const turnKey = `${battle.currentPlayerId}-${battle.round}`;

    // Detectar se é início de rodada (rodada mudou)
    const roundChanged =
      lastRoundRef.current !== null && lastRoundRef.current !== battle.round;
    const isFirstRound = lastRoundRef.current === null;

    // Atualizar ref da rodada APÓS detectar mudança
    lastRoundRef.current = battle.round;

    // Mostrar modal se ainda não mostrou neste turno (com delay)
    if (turnModalShownRef.current !== turnKey) {
      turnModalShownRef.current = turnKey;
      setIsRoundStart(roundChanged || isFirstRound);
      setIsTurnLocked(true); // Travar interações durante o modal

      // Cancelar timer anterior se existir
      if (turnModalTimerRef.current) {
        clearTimeout(turnModalTimerRef.current);
      }

      // Delay antes de mostrar o modal (usar ref para evitar cancelamento pelo StrictMode)
      turnModalTimerRef.current = setTimeout(() => {
        setShowTurnStartModal(true);
        turnModalTimerRef.current = null;
      }, TURN_MODAL_DELAY);
    }
  }, [battle?.currentPlayerId, battle?.round, user?.id]);

  // Delay para mostrar o modal de vitória
  useEffect(() => {
    if (battleResult) {
      const timer = setTimeout(() => {
        setShowDelayedBattleResult(true);
      }, BATTLE_RESULT_DELAY);
      return () => clearTimeout(timer);
    } else {
      setShowDelayedBattleResult(false);
    }
  }, [battleResult]);

  // Auto-selecionar a unidade do turno atual quando muda de turno ou monta
  // E guiar câmera para ela APENAS UMA VEZ no início do turno
  // SÓ EXECUTA APÓS O MODAL DE INÍCIO DE TURNO FECHAR (isTurnLocked = false)
  const beginActionCalledRef = useRef<string | null>(null); // Rastreia se beginAction já foi chamado para este turno

  useEffect(() => {
    if (!battle || !user) return;

    // Aguardar o modal de início de turno fechar antes de auto-selecionar
    if (isTurnLocked) return;

    const isMyTurnNow = battle.currentPlayerId === user.id;
    const turnKey = `${battle.currentPlayerId}-${battle.round}`;

    // Encontrar minhas unidades vivas (exceto SUMMON/MONSTER)
    const myAliveUnits = getControllableUnits(units, user.id);

    // Se não é meu turno, limpar seleção (a não ser que queira ver info da unidade)
    if (!isMyTurnNow) {
      beginActionCalledRef.current = null;
      // Limpar seleção quando turno muda para outro jogador
      if (selectedUnitId) {
        const selectedIsEnemy =
          units.find((u) => u.id === selectedUnitId)?.ownerId !== user.id;
        if (!selectedIsEnemy) {
          // Se está selecionada uma unidade minha mas não é meu turno, manter para visualização
        }
      }
      return;
    }

    // === É MEU TURNO ===

    // Se só tem uma unidade viva, sempre selecionar ela
    if (myAliveUnits.length === 1) {
      const myUnit = myAliveUnits[0];

      // Selecionar a unidade
      if (selectedUnitId !== myUnit.id) {
        console.log(
          `[ArenaBattleView] 🎯 Auto-selecionando única unidade: ${myUnit.name}`
        );
        setSelectedUnitId(myUnit.id);
      }

      // Guiar câmera APENAS UMA VEZ por turno
      if (cameraCenteredRef.current !== turnKey) {
        cameraCenteredRef.current = turnKey;
        setTimeout(() => {
          canvasRef.current?.centerOnUnit(myUnit.id);
        }, 100);
      }

      // Iniciar ação se ainda não iniciou
      const hasNoActiveUnit = !battle.activeUnitId;
      const unitNotStarted = !myUnit.hasStartedAction;
      const notCalledYet = beginActionCalledRef.current !== turnKey;

      if (hasNoActiveUnit && unitNotStarted && notCalledYet) {
        console.log(
          `[ArenaBattleView] 🎬 Auto-iniciando ação para ${myUnit.name}`
        );
        beginActionCalledRef.current = turnKey;
        setTimeout(() => {
          beginAction(myUnit.id);
        }, 100);
      }
    } else if (myAliveUnits.length > 1) {
      // Múltiplas unidades - jogador deve escolher
      // Apenas centralizar câmera na primeira se ainda não centralizou
      if (cameraCenteredRef.current !== turnKey) {
        cameraCenteredRef.current = turnKey;
        setTimeout(() => {
          canvasRef.current?.centerOnUnit(myAliveUnits[0].id);
        }, 100);
      }
    }
  }, [
    battle?.currentPlayerId,
    battle?.round,
    battle?.activeUnitId,
    user?.id,
    units,
    beginAction,
    selectedUnitId,
    isTurnLocked,
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

    const myUnit = units.find(
      (u) => isPlayerControllable(u, user.id) && u.isAlive
    );
    if (!myUnit) return;

    // Só verificar se a unidade já começou a ação (tem hasStartedAction)
    // NÃO auto-encerrar se a unidade ainda tem ações (pode usar Dash para recuperar movimento)
    if (
      myUnit.hasStartedAction &&
      myUnit.movesLeft === 0 &&
      myUnit.actionsLeft === 0 &&
      (myUnit.attacksLeftThisTurn ?? 0) === 0
    ) {
      // Usar debounce maior para dar tempo de respostas do servidor (ex: Disparada restaura movimento)
      autoEndTimerRef.current = setTimeout(() => {
        // Verificar novamente após o delay usando ref para estado atualizado
        const currentUnits = unitsRef.current;
        const currentUnit = currentUnits.find(
          (u) => isPlayerControllable(u, user.id) && u.isAlive
        );
        if (
          currentUnit &&
          currentUnit.hasStartedAction &&
          currentUnit.movesLeft === 0 &&
          currentUnit.actionsLeft === 0 &&
          (currentUnit.attacksLeftThisTurn ?? 0) === 0
        ) {
          console.log(
            "%c[ArenaBattleView] ✅ Movimentos e ações esgotados - Auto-encerrar turno",
            "color: #22c55e; font-weight: bold;"
          );
          autoEndTriggeredRef.current = true;
          endAction(currentUnit.id);
        } else {
          console.log(
            "%c[ArenaBattleView] ⏳ Auto-encerrar cancelado - unidade ainda tem recursos",
            "color: #f59e0b; font-weight: bold;",
            {
              movesLeft: currentUnit?.movesLeft,
              actionsLeft: currentUnit?.actionsLeft,
              attacksLeftThisTurn: currentUnit?.attacksLeftThisTurn,
            }
          );
        }
      }, 1000); // 1 segundo de debounce para dar tempo do servidor responder
    }

    // Cleanup
    return () => {
      if (autoEndTimerRef.current) {
        clearTimeout(autoEndTimerRef.current);
        autoEndTimerRef.current = null;
      }
    };
  }, [battle?.currentPlayerId, user?.id, units, endAction]);

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

  // Handler para centralizar mapa em uma unidade (chamado pelo BattleHeader)
  const handleInitiativeUnitClick = useCallback((unit: BattleUnit) => {
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
          vsBot={battleResult.vsBot}
        />
      </div>
    );
  }

  if (!battle || !user) {
    return <FullScreenLoading message="Preparando a arena de batalha..." />;
  }

  const isMyTurn = battle.currentPlayerId === user.id;
  const selectedUnit = units.find((u) => u.id === selectedUnitId);
  const myUnits = getControllableUnits(units, user.id);

  // Calcular unidades destacadas como alvos válidos para skill/spell pendente
  const highlightedUnitIds = useMemo(() => {
    const highlighted = new Set<string>();

    if (!selectedUnit || !pendingAction) return highlighted;

    // Verificar se é uma skill (não é ação comum nem spell)
    const isBasicAction = isCommonAction(pendingAction);
    const isSpell = pendingAction.startsWith("spell:");

    if (isBasicAction || isSpell) return highlighted;

    // É uma skill - buscar definição
    const skill = findSkillByCode(pendingAction);
    if (!skill) return highlighted;

    // Obter alvos válidos
    const validTargets = getValidSkillTargets(selectedUnit, skill, units);
    validTargets.forEach((target) => highlighted.add(target.id));

    // Incluir self se skill permite
    if (skill.targetType === "ALLY" || skill.targetType === "SELF") {
      highlighted.add(selectedUnit.id);
    }

    return highlighted;
  }, [selectedUnit, pendingAction, units]);

  // Determinar meu kingdom e oponentes (suporta múltiplos jogadores)
  const myKingdom = battle.kingdoms.find((k) => k.ownerId === user.id);
  const opponentKingdoms = battle.kingdoms.filter((k) => k.ownerId !== user.id);
  // Para compatibilidade com UI existente, pegar primeiro oponente
  const opponentKingdom = opponentKingdoms[0];

  // === MOVIMENTAÇÃO COM WASD ===
  const handleKeyboardMove = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      // Bloquear durante o modal de início de turno
      if (isTurnLocked) return;

      // Bloquear se já há movimento em andamento
      if (isMovingRef.current) return;

      if (
        !selectedUnit ||
        !isMyTurn ||
        !isPlayerControllable(selectedUnit, user.id)
      )
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

      // Verificar custo de movimento (para movimento de 1 célula, caminho está sempre livre)
      const moveInfo = getFullMovementInfo(
        selectedUnit,
        newX,
        newY,
        units,
        battle.config.map.obstacles || [],
        battle.config.grid.width,
        battle.config.grid.height
      );

      if (
        !occupied &&
        (newX !== selectedUnit.posX || newY !== selectedUnit.posY) &&
        !moveInfo.isBlocked &&
        moveInfo.totalCost <= selectedUnit.movesLeft
      ) {
        console.log(
          "%c[ArenaBattleView] ⌨️ Movimento WASD",
          "color: #22c55e; font-weight: bold;",
          {
            direction,
            from: { x: selectedUnit.posX, y: selectedUnit.posY },
            to: { x: newX, y: newY },
            totalCost: moveInfo.totalCost,
            engagementCost: moveInfo.engagementCost,
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
      battle.config.map.obstacles,
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

  const handleUnitClick = (unit: BattleUnit) => {
    // Bloquear durante o modal de início de turno
    if (isTurnLocked) return;

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
    if (pendingAction === "ATTACK" && selectedUnit && isMyTurn) {
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

    // Se há uma spell pendente aguardando alvo (spell que targetiza unidade)
    if (pendingAction?.startsWith("spell:") && selectedUnit && isMyTurn) {
      const spellCode = pendingAction.replace("spell:", "");
      const spell = getSpellByCode(spellCode);

      if (
        spell &&
        (spell.targetType === "ALLY" ||
          spell.targetType === "ENEMY" ||
          spell.targetType === "ALL")
      ) {
        // Usar validação centralizada
        if (isValidSpellTarget(selectedUnit, spell, unit)) {
          console.log(
            "%c[ArenaBattleView] 🔮 Conjurando spell em unidade!",
            "color: #a855f7; font-weight: bold;",
            { spellCode, targetId: unit.id, targetName: unit.name }
          );
          castSpell(selectedUnit.id, spellCode, unit.id);
          setPendingAction(null);
        } else {
          console.log(
            "%c[ArenaBattleView] ❌ Alvo inválido para spell",
            "color: #ef4444;",
            { spell: spellCode, target: unit.name }
          );
        }
        return;
      }
    }

    // Se há uma skill pendente aguardando alvo (ex: HEAL)
    if (
      pendingAction &&
      !pendingAction.startsWith("spell:") &&
      pendingAction !== "ATTACK" &&
      selectedUnit &&
      isMyTurn
    ) {
      const skillDef = findSkillByCode(pendingAction);

      if (skillDef && skillDef.targetType && skillDef.targetType !== "SELF") {
        // Usar validação centralizada ao invés de cálculo manual
        if (isValidSkillTarget(selectedUnit, skillDef, unit)) {
          console.log(
            "%c[ArenaBattleView] ✨ Executando skill em unidade!",
            "color: #fbbf24; font-weight: bold;",
            {
              skillCode: pendingAction,
              targetId: unit.id,
              targetName: unit.name,
            }
          );
          executeAction("use_skill", selectedUnit.id, {
            skillCode: pendingAction,
            casterUnitId: selectedUnit.id,
            targetUnitId: unit.id,
          });
          setPendingAction(null);
        } else {
          console.log(
            "%c[ArenaBattleView] ❌ Alvo inválido para skill",
            "color: #ef4444;",
            { skill: pendingAction, target: unit.name }
          );
        }
        return;
      }
    }

    // Comportamento padrão: selecionar unidade
    // Só permite selecionar unidades controláveis (não SUMMON/MONSTER)
    if (isPlayerControllable(unit, user.id)) {
      // Se clicar na mesma unidade E há uma ação pendente do tipo ALLY → self-cast
      if (selectedUnitId === unit.id && pendingAction && isMyTurn) {
        // Verificar se é spell ALLY
        if (pendingAction?.startsWith("spell:")) {
          const spellCode = pendingAction.replace("spell:", "");
          const spell = getSpellByCode(spellCode);

          if (spell && spell.targetType === "ALLY") {
            console.log(
              "%c[ArenaBattleView] 🔮 Conjurando spell em si mesmo!",
              "color: #a855f7; font-weight: bold;",
              { spellCode, unitId: unit.id, unitName: unit.name }
            );
            castSpell(unit.id, spellCode, unit.id);
            setPendingAction(null);
            return;
          }
        }
        // Verificar se é skill ALLY
        else if (pendingAction !== "ATTACK") {
          const skillDef = findSkillByCode(pendingAction);

          if (skillDef && skillDef.targetType === "ALLY") {
            console.log(
              "%c[ArenaBattleView] ✨ Executando skill em si mesmo!",
              "color: #fbbf24; font-weight: bold;",
              { skillCode: pendingAction, unitId: unit.id, unitName: unit.name }
            );
            executeAction("use_skill", unit.id, {
              skillCode: pendingAction,
              casterUnitId: unit.id,
              targetUnitId: unit.id,
            });
            setPendingAction(null);
            return;
          }
        }

        // Se não era skill/spell ALLY, faz toggle normal
        console.log(
          "%c[ArenaBattleView] 🔄 Desselecionando unidade (toggle)",
          "color: #f59e0b;",
          { unitId: unit.id }
        );
        setSelectedUnitId(null);
        setPendingAction(null);
        return;
      }

      // Toggle: clicar na mesma unidade desseleciona (quando não há pendingAction)
      if (selectedUnitId === unit.id) {
        console.log(
          "%c[ArenaBattleView] 🔄 Desselecionando unidade (toggle)",
          "color: #f59e0b;",
          { unitId: unit.id }
        );
        setSelectedUnitId(null);
        setPendingAction(null);
        return;
      }

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
      const hasNotStarted = !unit.hasStartedAction;

      // Caso especial: após reconexão, unidade pode ter hasStartedAction mas sem activeUnitId
      const needsReactivation = unit.hasStartedAction && hasNoActiveUnit;

      if (
        isMyTurn &&
        ((hasNoActiveUnit && hasNotStarted) || needsReactivation)
      ) {
        console.log(
          "%c[ArenaBattleView] ▶️ Iniciando/Reativando ação da unidade",
          "color: #f59e0b;",
          { unitId: unit.id, needsReactivation }
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
    // Bloquear durante o modal de início de turno
    if (isTurnLocked) return;

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
        "%c[ArenaBattleView] ⚠️ Clique em célula vazia - desselecionando",
        "color: #f59e0b;"
      );
      // Desselecionar ao clicar fora quando não pode mover
      if (selectedUnitId) {
        setSelectedUnitId(null);
        setPendingAction(null);
      }
      return;
    }

    // Verificar se a unidade selecionada é a unidade ativa (ou aguardando ativação)
    // Se activeUnitId está indefinido mas é minha unidade, permitir ação
    const isActiveOrPending = battle.activeUnitId
      ? selectedUnit.id === battle.activeUnitId
      : selectedUnit.ownerId === user.id;
    if (!isActiveOrPending) {
      console.log(
        "%c[ArenaBattleView] ⚠️ Unidade não está ativa - ignorando clique",
        "color: #f59e0b;",
        { selectedUnitId: selectedUnit.id, activeUnitId: battle.activeUnitId }
      );
      return;
    }

    // Se há uma spell pendente que targetiza posição
    if (pendingAction?.startsWith("spell:") && selectedUnit) {
      const spellCode = pendingAction.replace("spell:", "");
      const spell = getSpellByCode(spellCode);

      if (
        spell &&
        (spell.targetType === "POSITION" || spell.targetType === "GROUND")
      ) {
        // Usar validação centralizada
        const isValidPosition = isValidSpellPosition(
          selectedUnit,
          spell,
          { x, y },
          units,
          battle.config.grid.width,
          battle.config.grid.height
        );

        if (isValidPosition) {
          console.log(
            "%c[ArenaBattleView] 🔮 Conjurando spell em posição!",
            "color: #a855f7; font-weight: bold;",
            { spellCode, position: { x, y } }
          );
          castSpell(selectedUnit.id, spellCode, undefined, { x, y });
          setPendingAction(null);
        } else {
          console.log(
            "%c[ArenaBattleView] ❌ Posição inválida para spell",
            "color: #ef4444;",
            { spellCode, position: { x, y } }
          );
        }
        return;
      }
    }

    // Calcular direção baseado no clique (apenas left/right para sprite)
    const deltaX = x - selectedUnit.posX;
    const clickDirection: SpriteDirection = deltaX < 0 ? "left" : "right";
    setUnitDirection({ unitId: selectedUnit.id, direction: clickDirection });

    // Tentar mover para a célula
    if (selectedUnit.movesLeft > 0) {
      // Calcular informações completas de movimento (incluindo verificação de caminho)
      const moveInfo = getFullMovementInfo(
        selectedUnit,
        x,
        y,
        units,
        battle.config.map.obstacles || [],
        battle.config.grid.width,
        battle.config.grid.height
      );

      console.log(
        "%c[ArenaBattleView] 🚶 Tentando mover unidade",
        "color: #06b6d4;",
        {
          unitId: selectedUnit.id,
          from: { x: selectedUnit.posX, y: selectedUnit.posY },
          to: { x, y },
          baseCost: moveInfo.baseCost,
          engagementCost: moveInfo.engagementCost,
          totalCost: moveInfo.totalCost,
          movesLeft: selectedUnit.movesLeft,
          isBlocked: moveInfo.isBlocked,
          canMove:
            !moveInfo.isBlocked && moveInfo.totalCost <= selectedUnit.movesLeft,
        }
      );

      // Verificar se o caminho está bloqueado
      if (moveInfo.isBlocked) {
        console.log(
          "%c[ArenaBattleView] 🚫 Caminho bloqueado!",
          "color: #ef4444;"
        );
        return;
      }

      if (moveInfo.totalCost <= selectedUnit.movesLeft) {
        if (moveInfo.hasEngagementPenalty) {
          console.log(
            "%c[ArenaBattleView] ⚠️ Movimento com penalidade de engajamento!",
            "color: #f59e0b;",
            { engagementCost: moveInfo.engagementCost }
          );
        }
        console.log(
          "%c[ArenaBattleView] ✅ Movimento válido!",
          "color: #22c55e;"
        );
        isMovingRef.current = true; // Lock para evitar cliques rápidos
        moveUnit(selectedUnit.id, x, y);
      } else {
        console.log(
          "%c[ArenaBattleView] ❌ Custo de movimento muito alto",
          "color: #ef4444;",
          { totalCost: moveInfo.totalCost, movesLeft: selectedUnit.movesLeft }
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

  // Wrapper para executar skills/ações do UnitPanel
  // Agora tudo é tratado como skill (incluindo ações comuns)
  const handleExecuteSkillAction = useCallback(
    (skillCode: string, unitId: string) => {
      const isCommon = isCommonAction(skillCode);

      console.log(
        `%c[ArenaBattleView] 🎯 Executando ${
          isCommon ? "ação comum" : "skill"
        } sem alvo`,
        `color: ${isCommon ? "#10b981" : "#fbbf24"}; font-weight: bold;`,
        { skillCode, unitId, isCommonAction: isCommon }
      );

      // Tudo é enviado como use_skill agora
      executeAction("use_skill", unitId, {
        skillCode,
        casterUnitId: unitId,
        // targetUnitId omitido = self-cast
      });
    },
    [executeAction]
  );

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
    if (pendingAction === "ATTACK" && selectedUnit && isMyTurn) {
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

      {/* Área Principal - Canvas em tela cheia */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Canvas do Grid - Área principal (tela cheia) */}
        <div className="flex-1 p-2 min-w-0">
          <div className="w-full h-full bg-citadel-granite rounded-xl border-4 border-metal-iron shadow-stone-raised relative">
            <ArenaBattleCanvas
              ref={canvasRef}
              battle={battle}
              units={units}
              currentUserId={user.id}
              selectedUnitId={selectedUnitId}
              activeUnitId={battle.activeUnitId}
              onUnitClick={handleUnitClick}
              onCellClick={handleCellClick}
              onObstacleClick={handleObstacleClick}
              unitDirection={unitDirection}
              pendingAction={pendingAction}
              activeBubbles={chatState.activeBubbles}
              highlightedUnitIds={highlightedUnitIds}
            />

            {/* BattleHeader - Overlay na parte superior (dentro do Canvas) */}
            <BattleHeader
              battle={battle}
              units={units}
              currentUserId={user.id}
              selectedUnitId={selectedUnitId ?? undefined}
              onUnitClick={handleInitiativeUnitClick}
            />

            {/* UnitPanel - Overlay na parte inferior (dentro do Canvas) */}
            <UnitPanel
              selectedUnit={selectedUnit ?? null}
              activeUnitId={battle.activeUnitId}
              isMyTurn={isMyTurn}
              currentUserId={user.id}
              pendingAction={pendingAction}
              onSetPendingAction={setPendingAction}
              onExecuteAction={handleExecuteSkillAction}
              onEndAction={handleEndAction}
            />
          </div>
        </div>
      </div>

      {/* Modal de Resultado da Batalha (com delay de 1s) */}
      {showDelayedBattleResult && battleResult && (
        <BattleResultModal
          result={battleResult}
          units={battleResult.finalUnits}
          isWinner={battleResult.winnerId === user.id}
          myKingdomName={myKingdom?.name ?? "Meu Reino"}
          opponentKingdomName={opponentKingdom?.name ?? "Oponente"}
          myUserId={user.id}
          onRematch={requestRematch}
          onLeave={dismissBattleResult}
          rematchPending={rematchPending}
          opponentWantsRematch={opponentWantsRematch}
          vsBot={battleResult.vsBot}
        />
      )}

      {/* Modal de Início de Turno */}
      <TurnStartModal
        isVisible={showTurnStartModal}
        onHide={() => {
          setShowTurnStartModal(false);
          setIsTurnLocked(false); // Destravar interações quando modal fechar
        }}
        round={battle.round}
        isMyTurn={isMyTurn}
        isRoundStart={isRoundStart}
        currentPlayerKingdomName={
          isMyTurn
            ? myKingdom?.name ?? "Meu Reino"
            : opponentKingdom?.name ?? "Oponente"
        }
      />

      {/* Chat de Batalha - Abre com Enter (escondido quando modal de resultado está aberto) */}
      {!showDelayedBattleResult && (
        <BattleChatUI
          currentUnitId={
            selectedUnitId || battle.activeUnitId || myUnits[0]?.id
          }
        />
      )}
    </div>
  );
};

/**
 * Componente interno do Chat (sem Provider, usado dentro do ArenaBattleViewInner)
 */
const BattleChatUI: React.FC<{
  currentUnitId?: string | null;
}> = ({ currentUnitId }) => {
  const { state, openChat, closeChat, toggleChat } = useChat();

  // Handler para tecla Enter
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        toggleChat();
      }
    },
    [toggleChat]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  if (!state.isOpen) {
    return (
      <div className="fixed bottom-32 left-4 z-50">
        <button
          onClick={openChat}
          className="
            flex items-center gap-2 px-3 py-1.5
            bg-citadel-obsidian/80 backdrop-blur-sm
            border border-metal-iron/30 rounded-lg
            text-parchment-dark hover:text-parchment-light
            hover:border-metal-bronze/50
            transition-all text-xs
          "
          title="Pressione Enter para abrir o chat"
        >
          <span>💬</span>
          <span className="hidden sm:inline">Enter para chat</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-32 left-4 z-50 w-72">
      <ChatBox
        currentUnitId={currentUnitId || undefined}
        variant="compact"
        placeholder="Mensagem... (Enter para enviar)"
        maxHeight="150px"
        title="Chat de Batalha"
        onClose={closeChat}
      />
    </div>
  );
};
