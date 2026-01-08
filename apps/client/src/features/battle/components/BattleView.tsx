import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { useBattle } from "../hooks/useBattle";
import { useAuth } from "../../auth";
import {
  BattleCanvas,
  type SpriteDirection,
  type BattleCanvasRef,
} from "./canvas";
import {
  UnitPanel,
  BattleResultModal,
  BattleHeader,
  PauseMenu,
  TargetSelectionNotification,
} from "./battle";
import { TurnNotification } from "./shared";
import { FullScreenLoading } from "@/components/FullScreenLoading";
import { useChatStore } from "../../../stores";
import { useChat } from "../../chat";
import { ChatBox } from "../../chat/components/ChatBox";
import type { BattleUnit } from "../../../../../shared/types/battle.types";
import {
  getSpellByCode,
  findSkillByCode,
  isCommonAction,
} from "../../../../../shared/data/abilities.data";
import { resolveDynamicValue } from "../../../../../shared/types/ability.types";
import { getFullMovementInfo } from "../../../../../shared/utils/engagement.utils";
import {
  isValidSkillTarget,
  isValidSpellTarget,
  isValidSpellPosition,
} from "../../../../../shared/utils/ability-validation";
import { useTargeting } from "../hooks/useTargeting";
import { colyseusService } from "../../../services/colyseus.service";
import {
  isPlayerControllable,
  getControllableUnits,
} from "../utils/unit-control";
import {
  useHotkey,
  useMovementKeys,
  useEnterKey,
} from "../../../hooks/useHotkey";
import { useQTE, QTEOverlay } from "../../qte";

/**
 * BattleView - Wrapper com ChatProvider
 */
export const BattleView: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    state: { battle, isInBattle, winnerId },
  } = useBattle();

  // Se não está em batalha e não tem resultado, redireciona para dashboard
  useEffect(() => {
    if (!isInBattle && !winnerId && !battle) {
      navigate("/dashboard", { replace: true });
    }
  }, [isInBattle, winnerId, battle, navigate]);

  // Precisa do battleId para o ChatProvider
  if (!battle || !user) {
    return <FullScreenLoading message="Preparando a Batalha..." />;
  }

  return <BattleViewInner battleId={battle.battleId} />;
};

/**
 * BattleViewInner - Conteúdo da batalha
 */
const BattleViewInner: React.FC<{ battleId: string }> = ({ battleId }) => {
  const { user } = useAuth();
  const activeBubbles = useChatStore((s) => s.activeBubbles);
  const setContext = useChatStore((s) => s.setContext);
  const loadHistory = useChatStore((s) => s.loadHistory);
  const reset = useChatStore((s) => s.reset);
  const canvasRef = useRef<BattleCanvasRef>(null);

  // Configura o contexto do chat para BATTLE
  useEffect(() => {
    setContext("BATTLE", battleId);
    loadHistory();
    return () => {
      reset();
    };
  }, [battleId, setContext, loadHistory, reset]);

  const {
    state: {
      battle,
      battleResult,
      units,
      rematchPending,
      opponentWantsRematch,
      error: battleError,
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
  } = useBattle();

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null); // Ação aguardando alvo
  const [hoveredCell, setHoveredCell] = useState<{
    x: number;
    y: number;
  } | null>(null); // Célula sob o mouse (para targeting)
  const [unitDirection, setUnitDirection] = useState<{
    unitId: string;
    direction: SpriteDirection;
  } | null>(null);
  const [isPauseMenuOpen, setIsPauseMenuOpen] = useState(false);
  const [isRoundStart, setIsRoundStart] = useState(false); // Indica se é início de rodada
  const [showDelayedBattleResult, setShowDelayedBattleResult] = useState(false); // Delay para mostrar modal de vitória
  const [beginActionCalledFor, setBeginActionCalledFor] = useState<
    string | null
  >(null); // Rastreia se beginAction já foi chamado para este turno
  const isMovingRef = useRef<boolean>(false); // Lock para evitar cliques rápidos
  const cameraCenteredRef = useRef<string | null>(null); // Controla se já centralizou a câmera neste turno
  const lastRoundRef = useRef<number | null>(null); // Rastreia a última rodada para detectar mudança

  // Hook do QTE (Quick Time Event)
  const {
    state: qteState,
    isLocalResponder: isQTEResponder,
    respondToQTE,
    isQTEVisualActive,
  } = useQTE({
    battleId,
    localPlayerId: user?.id ?? null,
  });

  // Encontrar nomes das unidades do QTE
  const qteAttackerUnit = useMemo(() => {
    if (!qteState.activeQTE?.attackerId) return null;
    return units.find((u) => u.id === qteState.activeQTE?.attackerId) ?? null;
  }, [qteState.activeQTE?.attackerId, units]);

  const qteResponderUnit = useMemo(() => {
    if (!qteState.activeQTE?.responderId) return null;
    // O responder pode ser o defensor (targetId diferente do attackerId)
    return units.find((u) => u.id === qteState.activeQTE?.targetId) ?? null;
  }, [qteState.activeQTE?.responderId, qteState.activeQTE?.targetId, units]);

  // Ouvir eventos de combate para disparar animações e centralizar câmera
  useEffect(() => {
    // Handler para ataque - anima atacante (Sword) e alvo (Damage)
    // Também centraliza a câmera no alvo se estiver visível
    const handleUnitAttacked = (data: {
      attackerUnitId: string;
      targetUnitId: string | null;
      missed?: boolean;
    }) => {
      // Centralizar câmera no alvo se estiver na visão do jogador
      if (data.targetUnitId && canvasRef.current) {
        canvasRef.current.centerOnUnitIfVisible(data.targetUnitId);
      }

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

        // Shake da câmera quando uma unidade do jogador receber ou causar dano visível
        const attackerUnit = units.find((u) => u.id === data.attackerUnitId);
        const targetUnit = units.find((u) => u.id === data.targetUnitId);
        const isPlayerInvolved =
          attackerUnit?.ownerId === user?.id ||
          targetUnit?.ownerId === user?.id;
        const isOtherVisible =
          attackerUnit?.ownerId === user?.id
            ? canvasRef.current?.isUnitVisible(data.targetUnitId!)
            : canvasRef.current?.isUnitVisible(data.attackerUnitId);

        if (isPlayerInvolved && isOtherVisible) {
          setTimeout(() => {
            canvasRef.current?.shake(5, 150);
          }, 200);
        }
      }
    };

    // Handler para movimento de unidade - centraliza câmera na nova posição se estiver visível
    const handleUnitMoved = (data: {
      unitId: string;
      toX: number;
      toY: number;
    }) => {
      // Centralizar câmera na nova posição se estiver na visão do jogador
      if (canvasRef.current) {
        canvasRef.current.centerOnPositionIfVisible(data.toX, data.toY);
      }
    };

    // Handler para skill usada - centraliza câmera no alvo se houver
    const handleSkillUsed = (data: {
      casterUnitId: string;
      targetUnitId?: string | null;
      skillCode: string;
    }) => {
      // Centralizar câmera no alvo se estiver na visão do jogador
      if (data.targetUnitId && canvasRef.current) {
        canvasRef.current.centerOnUnitIfVisible(data.targetUnitId);
      }
    };

    // Handler para spell cast - centraliza câmera no alvo se houver
    const handleSpellCast = (data: {
      casterUnitId: string;
      targetUnitId?: string | null;
      spellCode: string;
    }) => {
      // Centralizar câmera no alvo se estiver na visão do jogador
      if (data.targetUnitId && canvasRef.current) {
        canvasRef.current.centerOnUnitIfVisible(data.targetUnitId);
      }
    };

    // Handler para erros - reseta lock de movimento imediatamente
    const handleBattleError = () => {
      isMovingRef.current = false;
    };

    colyseusService.on("battle:unit_attacked", handleUnitAttacked);
    colyseusService.on("battle:unit_moved", handleUnitMoved);
    colyseusService.on("battle:skill_used", handleSkillUsed);
    colyseusService.on("battle:spell_cast", handleSpellCast);
    colyseusService.on("battle:error", handleBattleError);

    return () => {
      colyseusService.off("battle:unit_attacked", handleUnitAttacked);
      colyseusService.off("battle:unit_moved", handleUnitMoved);
      colyseusService.off("battle:skill_used", handleSkillUsed);
      colyseusService.off("battle:spell_cast", handleSpellCast);
      colyseusService.off("battle:error", handleBattleError);
    };
  }, [units, user]);

  // Handler para ESC - abrir menu de pausa
  useHotkey(
    "escape",
    () => {
      if (!isPauseMenuOpen) {
        setIsPauseMenuOpen(true);
      }
    },
    { ignoreInputs: false }
  );

  // Handler para Espaço - finalizar turno
  useHotkey(
    "space",
    () => {
      if (!battle || !user) return;
      const isMyTurn = battle.currentPlayerId === user.id;
      const myUnit = units.find(
        (u) => isPlayerControllable(u, user.id) && u.isAlive
      );
      if (isMyTurn && myUnit && myUnit.hasStartedAction) {
        console.log(
          "%c[BattleView] ⌨️ Espaço pressionado - Finalizando turno",
          "color: #f59e0b; font-weight: bold;"
        );
        endAction(myUnit.id);
      }
    },
    { ignoreInputs: true }
  );

  // Resetar flags quando muda de turno
  useEffect(() => {
    // Resetar flags de controle
    cameraCenteredRef.current = null;

    // Limpar ação pendente e tracking de beginAction (agendado para evitar cascade)
    queueMicrotask(() => {
      setPendingAction(null);
      setBeginActionCalledFor(null);
    });
  }, [battle?.currentPlayerId, battle?.round]);

  // Detectar se é início de rodada (para informar TurnNotification)
  useEffect(() => {
    if (!battle) return;

    const roundChanged =
      lastRoundRef.current !== null && lastRoundRef.current !== battle.round;
    const isFirstRound = lastRoundRef.current === null;

    lastRoundRef.current = battle.round;
    queueMicrotask(() => {
      setIsRoundStart(roundChanged || isFirstRound);
    });
  }, [battle]);

  // Delay para mostrar o modal de vitória (ms)
  const BATTLE_RESULT_DELAY = 2000;

  // Delay para mostrar o modal de vitória
  useEffect(() => {
    if (battleResult) {
      const timer = setTimeout(() => {
        setShowDelayedBattleResult(true);
      }, BATTLE_RESULT_DELAY);
      return () => clearTimeout(timer);
    } else {
      queueMicrotask(() => {
        setShowDelayedBattleResult(false);
      });
    }
  }, [battleResult]);

  // Auto-selecionar a unidade do turno atual quando muda de turno ou monta
  // E guiar câmera para ela APENAS UMA VEZ no início do turno
  useEffect(() => {
    if (!battle || !user) return;

    const isMyTurnNow = battle.currentPlayerId === user.id;
    const turnKey = `${battle.currentPlayerId}-${battle.round}`;

    // Encontrar minhas unidades vivas (exceto SUMMON/MONSTER)
    const myAliveUnits = getControllableUnits(units, user.id);

    // Se não é meu turno, limpar state de tracking
    if (!isMyTurnNow) {
      if (beginActionCalledFor !== null) {
        queueMicrotask(() => {
          setBeginActionCalledFor(null);
        });
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
          `[BattleView] 🎯 Auto-selecionando única unidade: ${myUnit.name}`
        );
        queueMicrotask(() => {
          setSelectedUnitId(myUnit.id);
        });
      }

      // Guiar câmera APENAS UMA VEZ por turno
      if (cameraCenteredRef.current !== turnKey) {
        cameraCenteredRef.current = turnKey;
        setTimeout(() => {
          canvasRef.current?.centerOnUnit(myUnit.id);
        }, 100);
      }

      // Iniciar ação se ainda não iniciou
      // Verificar se a unidade ativa é a minha e se ainda não chamei beginAction
      const isMyActiveUnit = battle.activeUnitId === myUnit.id;
      const unitNotStarted = !myUnit.hasStartedAction;
      const notCalledYet = beginActionCalledFor !== turnKey;

      if (isMyActiveUnit && unitNotStarted && notCalledYet) {
        console.log(`[BattleView] 🎬 Auto-iniciando ação para ${myUnit.name}`);
        queueMicrotask(() => {
          setBeginActionCalledFor(turnKey);
        });
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
  }, [battle, user, units, beginAction, selectedUnitId, beginActionCalledFor]);

  // Auto-encerrar turno quando movimentos E ações acabarem
  // Usa countdown visual de 3 segundos antes de auto-encerrar
  // Efeito para iniciar countdown quando condições de auto-end são atendidas
  // Resetar lock de movimento quando unidade termina de mover OU quando há erro
  useEffect(() => {
    // Resetar lock quando movesLeft muda (movimento foi processado)
    isMovingRef.current = false;
  }, [units]);

  // Resetar lock de movimento quando há erro (ex: colisão com obstáculo)
  useEffect(() => {
    if (battleError) {
      isMovingRef.current = false;
    }
  }, [battleError]);

  // Handler para centralizar mapa em uma unidade E selecioná-la (chamado pelo BattleHeader)
  const handleInitiativeUnitClick = useCallback(
    (unit: BattleUnit) => {
      // Selecionar a unidade se for do jogador (controlável)
      if (user && isPlayerControllable(unit, user.id)) {
        setSelectedUnitId(unit.id);
        // Limpar ação pendente ao trocar de unidade
        setPendingAction(null);
        // Sempre centralizar câmera na unidade do jogador
        canvasRef.current?.centerOnUnit(unit.id);
      } else {
        // Para unidades inimigas, só centralizar se estiver na visão do jogador
        canvasRef.current?.centerOnUnitIfVisible(unit.id);
      }
    },
    [user]
  );

  // === VARIÁVEIS DERIVADAS (antes dos early returns para usar nos hooks) ===
  const isMyTurn = battle?.currentPlayerId === user?.id;
  const selectedUnit = units.find((u) => u.id === selectedUnitId);
  const myUnits = user ? getControllableUnits(units, user.id) : [];

  // Hook de targeting - calcula preview de células selecionáveis e afetadas
  // Chamado ANTES dos early returns para seguir as regras de hooks
  const { targetingPreview } = useTargeting({
    selectedUnit,
    pendingAction,
    hoveredCell,
    units,
    gridConfig: battle
      ? {
          width: battle.config.grid.width,
          height: battle.config.grid.height,
          obstacles: battle.config.map?.obstacles || [],
        }
      : { width: 0, height: 0, obstacles: [] },
  });

  // Atualizar direção do sprite quando estiver em modo de mira
  useEffect(() => {
    if (!selectedUnit || !targetingPreview?.direction) return;

    // Converter TargetingDirection para SpriteDirection (left/right)
    const dir = targetingPreview.direction;
    let spriteDir: SpriteDirection;

    // EAST, NORTHEAST, SOUTHEAST = right
    // WEST, NORTHWEST, SOUTHWEST = left
    // NORTH, SOUTH = manter direção atual ou default right
    if (dir === "EAST" || dir === "NORTHEAST" || dir === "SOUTHEAST") {
      spriteDir = "right";
    } else if (dir === "WEST" || dir === "NORTHWEST" || dir === "SOUTHWEST") {
      spriteDir = "left";
    } else {
      // Para NORTH/SOUTH, manter a direção atual se existir
      return;
    }

    const unitId = selectedUnit.id;
    queueMicrotask(() => {
      setUnitDirection({ unitId, direction: spriteDir });
    });
  }, [selectedUnit, targetingPreview?.direction]);

  // Unidade ativa do jogador (para passar pro TurnNotification)
  const myActiveUnit = user
    ? units.find((u) => isPlayerControllable(u, user.id) && u.isAlive)
    : undefined;

  // Preview de área para spells e skills de área (legado - mantido para compatibilidade)
  const areaPreview = useMemo(() => {
    if (!pendingAction || !selectedUnit) return null;

    const casterPos = { x: selectedUnit.posX, y: selectedUnit.posY };

    // Verificar se é uma spell de área
    if (pendingAction.startsWith("spell:")) {
      const spellCode = pendingAction.replace("spell:", "");
      const spell = getSpellByCode(spellCode);

      if (spell?.areaSize) {
        // Resolver rangeDistance dinamicamente
        const rangeDistance = spell.rangeDistance
          ? resolveDynamicValue(spell.rangeDistance, selectedUnit)
          : undefined;

        return {
          size:
            typeof spell.areaSize === "number"
              ? spell.areaSize
              : resolveDynamicValue(spell.areaSize, selectedUnit),
          color: spell.color || "#ff6b35",
          centerOnSelf: spell.range === "SELF",
          rangeDistance,
          casterPos,
        };
      }
      return null;
    }

    // Verificar se é uma skill de área (não é ação comum)
    if (!isCommonAction(pendingAction)) {
      const skill = findSkillByCode(pendingAction);

      if (skill?.areaSize) {
        // Resolver rangeDistance dinamicamente
        const rangeDistance = skill.rangeDistance
          ? resolveDynamicValue(skill.rangeDistance, selectedUnit)
          : undefined;

        return {
          size:
            typeof skill.areaSize === "number"
              ? skill.areaSize
              : resolveDynamicValue(skill.areaSize, selectedUnit),
          color: skill.color || "#4ade80",
          centerOnSelf: skill.range === "SELF",
          rangeDistance,
          casterPos,
        };
      }
    }

    return null;
  }, [pendingAction, selectedUnit]);

  // Determinar meu kingdom e oponentes (suporta múltiplos jogadores)
  const myKingdom = battle?.kingdoms.find((k) => k.ownerId === user?.id);
  const opponentKingdoms = battle?.kingdoms.filter(
    (k) => k.ownerId !== user?.id
  );
  // Para compatibilidade com UI existente, pegar primeiro oponente
  const opponentKingdom = opponentKingdoms?.[0];

  // === MOVIMENTAÇÃO COM WASD ===
  const handleKeyboardMove = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      // Bloquear se já há movimento em andamento
      if (isMovingRef.current) return;

      // Guards para battle e user
      if (!battle || !user) return;

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
          "%c[BattleView] ⌨️ Movimento WASD",
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
    [selectedUnit, isMyTurn, user, units, moveUnit, battle]
  );

  // Teclas WASD para movimento usando react-hotkeys-hook
  useMovementKeys(
    {
      onUp: () => handleKeyboardMove("up"),
      onDown: () => handleKeyboardMove("down"),
      onLeft: () => handleKeyboardMove("left"),
      onRight: () => handleKeyboardMove("right"),
    },
    { ignoreInputs: true }
  );

  // Wrapper para executar skills/ações do UnitPanel
  // Movido para ANTES dos early returns para seguir as regras de hooks
  const handleExecuteSkillAction = useCallback(
    (skillCode: string, unitId: string) => {
      const isCommon = isCommonAction(skillCode);

      console.log(
        `%c[BattleView] 🎯 Executando ${
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

  // === EARLY RETURNS (após todos os hooks) ===

  // Se só temos battleResult (sem battle), mostrar apenas o modal de resultado
  if (!battle && battleResult && user) {
    return (
      <div className="min-h-screen bg-cosmos-void flex items-center justify-center">
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
    return <FullScreenLoading message="Preparando a Batalha..." />;
  }

  const handleUnitClick = (unit: BattleUnit) => {
    console.log(
      "%c[BattleView] 🎯 Clique em unidade",
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

    // Se há uma spell de área pendente (targetType: POSITION), tratar como clique de célula
    // Isso permite usar spells de área em posições ocupadas por unidades
    if (pendingAction?.startsWith("spell:") && selectedUnit && isMyTurn) {
      const spellCode = pendingAction.replace("spell:", "");
      const spell = getSpellByCode(spellCode);

      if (
        spell &&
        (spell.targetType === "POSITION" || spell.targetType === "GROUND") &&
        spell.areaSize
      ) {
        console.log(
          "%c[BattleView] 🔮 Spell de área: delegando para handleCellClick",
          "color: #a855f7;",
          { spellCode, position: { x: unit.posX, y: unit.posY } }
        );
        handleCellClick(unit.posX, unit.posY);
        return;
      }
    }

    // Se há uma skill de área pendente (range: AREA com areaSize), tratar como clique de célula
    if (
      pendingAction &&
      !pendingAction.startsWith("spell:") &&
      !isCommonAction(pendingAction) &&
      selectedUnit &&
      isMyTurn
    ) {
      const skillDef = findSkillByCode(pendingAction);

      if (skillDef?.range === "AREA" && skillDef.areaSize) {
        console.log(
          "%c[BattleView] ✨ Skill de área: delegando para handleCellClick",
          "color: #fbbf24;",
          { skillCode: pendingAction, position: { x: unit.posX, y: unit.posY } }
        );
        handleCellClick(unit.posX, unit.posY);
        return;
      }
    }

    // Se há uma ação pendente aguardando alvo
    if (pendingAction === "ATTACK" && selectedUnit && isMyTurn) {
      const dx = Math.abs(unit.posX - selectedUnit.posX);
      const dy = Math.abs(unit.posY - selectedUnit.posY);

      // Chebyshev distance: permite diagonais (8 direções)
      if (Math.max(dx, dy) === 1) {
        console.log(
          "%c[BattleView] ⚔️ Atacando alvo!",
          "color: #ef4444; font-weight: bold;",
          { targetId: unit.id, targetName: unit.name }
        );
        attackUnit(selectedUnit.id, { x: unit.posX, y: unit.posY });
        setPendingAction(null); // Limpa ação pendente
      } else {
        console.log(
          "%c[BattleView] ❌ Alvo fora de alcance",
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
        (spell.targetType === "UNIT" || spell.targetType === "ALL")
      ) {
        // Usar validação centralizada
        if (isValidSpellTarget(selectedUnit, spell, unit)) {
          console.log(
            "%c[BattleView] 🔮 Conjurando spell em unidade!",
            "color: #a855f7; font-weight: bold;",
            { spellCode, targetId: unit.id, targetName: unit.name }
          );
          castSpell(selectedUnit.id, spellCode, unit.id);
          setPendingAction(null);
        } else {
          console.log(
            "%c[BattleView] ❌ Alvo inválido para spell",
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
            "%c[BattleView] ✨ Executando skill em unidade!",
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
            "%c[BattleView] ❌ Alvo inválido para skill",
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

          if (spell && spell.targetType === "UNIT") {
            console.log(
              "%c[BattleView] 🔮 Conjurando spell em si mesmo!",
              "color: #a855f7; font-weight: bold;",
              { spellCode, unitId: unit.id, unitName: unit.name }
            );
            castSpell(unit.id, spellCode, unit.id);
            setPendingAction(null);
            return;
          }
        }
        // Verificar se é skill UNIT
        else if (pendingAction !== "ATTACK") {
          const skillDef = findSkillByCode(pendingAction);

          if (skillDef && skillDef.targetType === "UNIT") {
            console.log(
              "%c[BattleView] ✨ Executando skill em si mesmo!",
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
          "%c[BattleView] 🔄 Desselecionando unidade (toggle)",
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
          "%c[BattleView] 🔄 Desselecionando unidade (toggle)",
          "color: #f59e0b;",
          { unitId: unit.id }
        );
        setSelectedUnitId(null);
        setPendingAction(null);
        return;
      }

      console.log(
        "%c[BattleView] ✅ Selecionando minha unidade",
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
          "%c[BattleView] ▶️ Iniciando/Reativando ação da unidade",
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
          "%c[BattleView] 👁️ Apenas visualizando (outra unidade já está ativa)",
          "color: #8b5cf6;",
          { unitId: unit.id, activeUnitId: battle.activeUnitId }
        );
      }
    }
  };

  const handleCellClick = (x: number, y: number) => {
    console.log(
      "%c[BattleView] 🗺️ Clique em célula",
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
        "%c[BattleView] ⏳ Movimento em andamento, ignorando clique",
        "color: #f59e0b;"
      );
      return;
    }

    if (!selectedUnit || !isMyTurn) {
      console.log(
        "%c[BattleView] ⚠️ Clique em célula vazia - desselecionando",
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
        "%c[BattleView] ⚠️ Unidade não está ativa - ignorando clique",
        "color: #f59e0b;",
        { selectedUnitId: selectedUnit.id, activeUnitId: battle.activeUnitId }
      );
      return;
    }

    // === SISTEMA DE MIRA DIRECIONAL ===
    // Se há uma ação pendente com targeting preview, confirmar na célula apontada
    if (
      pendingAction &&
      targetingPreview &&
      targetingPreview.isValidTarget &&
      targetingPreview.affectedCells.length > 0
    ) {
      // Usar a primeira célula afetada como alvo (ou todas para ações de área)
      const targetCell = targetingPreview.affectedCells[0];

      // Verificar se é ATTACK (ação comum)
      if (pendingAction === "ATTACK" || pendingAction === "attack") {
        // Verificar se há uma unidade ou obstáculo na célula alvo
        const targetUnit = units.find(
          (u) => u.isAlive && u.posX === targetCell.x && u.posY === targetCell.y
        );
        const targetObstacle = battle.config.map?.obstacles?.find(
          (o: { posX: number; posY: number; destroyed?: boolean }) =>
            !o.destroyed && o.posX === targetCell.x && o.posY === targetCell.y
        );

        console.log(
          "%c[BattleView] 🎯 Confirmando ataque direcional!",
          "color: #ef4444; font-weight: bold;",
          {
            targetCell,
            hasUnit: !!targetUnit,
            hasObstacle: !!targetObstacle,
          }
        );

        // Executar ataque - mesmo que não haja alvo, a ação é gasta
        attackUnit(selectedUnit.id, { x: targetCell.x, y: targetCell.y });
        setPendingAction(null);
        return;
      }

      // Se é uma spell
      if (pendingAction.startsWith("spell:")) {
        const spellCode = pendingAction.replace("spell:", "");

        // Verificar se há unidade alvo
        const targetUnit = units.find(
          (u) => u.isAlive && u.posX === targetCell.x && u.posY === targetCell.y
        );

        console.log(
          "%c[BattleView] 🔮 Confirmando spell direcional!",
          "color: #a855f7; font-weight: bold;",
          { spellCode, targetCell, hasUnit: !!targetUnit }
        );

        castSpell(selectedUnit.id, spellCode, targetUnit?.id, {
          x: targetCell.x,
          y: targetCell.y,
        });
        setPendingAction(null);
        return;
      }

      // Se é uma skill (não ação comum)
      if (!isCommonAction(pendingAction)) {
        const targetUnit = units.find(
          (u) => u.isAlive && u.posX === targetCell.x && u.posY === targetCell.y
        );

        console.log(
          "%c[BattleView] ✨ Confirmando skill direcional!",
          "color: #fbbf24; font-weight: bold;",
          { skillCode: pendingAction, targetCell, hasUnit: !!targetUnit }
        );

        executeAction("use_skill", selectedUnit.id, {
          skillCode: pendingAction,
          casterUnitId: selectedUnit.id,
          targetUnitId: targetUnit?.id,
          targetPosition: { x: targetCell.x, y: targetCell.y },
        });
        setPendingAction(null);
        return;
      }
    }

    // Se há uma spell pendente que targetiza posição (fallback para sistema antigo)
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
            "%c[BattleView] 🔮 Conjurando spell em posição!",
            "color: #a855f7; font-weight: bold;",
            { spellCode, position: { x, y } }
          );
          castSpell(selectedUnit.id, spellCode, undefined, { x, y });
          setPendingAction(null);
        } else {
          console.log(
            "%c[BattleView] ❌ Posição inválida para spell",
            "color: #ef4444;",
            { spellCode, position: { x, y } }
          );
        }
        return;
      }
    }

    // Se há uma skill de área pendente (range AREA com areaSize)
    if (
      pendingAction &&
      !pendingAction.startsWith("spell:") &&
      !isCommonAction(pendingAction) &&
      selectedUnit
    ) {
      const skillDef = findSkillByCode(pendingAction);

      // Skills de área podem ser usadas clicando em qualquer posição válida
      if (skillDef?.range === "AREA" && skillDef.areaSize) {
        // Verificar se está dentro do alcance
        const distance =
          Math.abs(x - selectedUnit.posX) + Math.abs(y - selectedUnit.posY);
        // Usar rangeDistance se disponível, senão padrão 4
        const maxRange = skillDef.rangeDistance
          ? resolveDynamicValue(skillDef.rangeDistance, selectedUnit)
          : 4;

        if (distance <= maxRange) {
          console.log(
            "%c[BattleView] ✨ Executando skill de área em posição!",
            "color: #fbbf24; font-weight: bold;",
            { skillCode: pendingAction, position: { x, y } }
          );
          executeAction("use_skill", selectedUnit.id, {
            skillCode: pendingAction,
            casterUnitId: selectedUnit.id,
            targetPosition: { x, y },
          });
          setPendingAction(null);
          return;
        } else {
          console.log(
            "%c[BattleView] ❌ Posição fora do alcance para skill de área",
            "color: #ef4444;",
            { skillCode: pendingAction, distance, maxRange }
          );
        }
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
        "%c[BattleView] 🚶 Tentando mover unidade",
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
        console.log("%c[BattleView] 🚫 Caminho bloqueado!", "color: #ef4444;");
        return;
      }

      if (moveInfo.totalCost <= selectedUnit.movesLeft) {
        if (moveInfo.hasEngagementPenalty) {
          console.log(
            "%c[BattleView] ⚠️ Movimento com penalidade de engajamento!",
            "color: #f59e0b;",
            { engagementCost: moveInfo.engagementCost }
          );
        }
        console.log("%c[BattleView] ✅ Movimento válido!", "color: #22c55e;");
        isMovingRef.current = true; // Lock para evitar cliques rápidos
        moveUnit(selectedUnit.id, x, y);
      } else {
        console.log(
          "%c[BattleView] ❌ Custo de movimento muito alto",
          "color: #ef4444;",
          { totalCost: moveInfo.totalCost, movesLeft: selectedUnit.movesLeft }
        );
      }
    } else {
      console.log(
        "%c[BattleView] ❌ Sem movimentos restantes",
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
      "%c[BattleView] 🪨 Clique em obstáculo",
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
          "%c[BattleView] ⚔️ Atacando obstáculo!",
          "color: #ef4444; font-weight: bold;",
          { obstacleId: obstacle.id }
        );
        attackUnit(selectedUnit.id, { x: obstacle.posX, y: obstacle.posY });
        setPendingAction(null);
      } else {
        console.log(
          "%c[BattleView] ❌ Obstáculo fora de alcance",
          "color: #ef4444;"
        );
      }
    }
  };

  const handleEndAction = () => {
    console.log(
      "%c[BattleView] 🏁 Finalizando ação",
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
      "%c[BattleView] 🏳️ Rendendo...",
      "color: #ef4444; font-weight: bold;"
    );
    setIsPauseMenuOpen(false);
    surrender();
  };

  return (
    <div className="h-screen w-screen bg-cosmos-void flex flex-col overflow-hidden">
      {/* Menu de Pausa */}
      <PauseMenu
        isOpen={isPauseMenuOpen}
        onClose={() => setIsPauseMenuOpen(false)}
        onSurrender={handleSurrender}
      />

      {/* Canvas do Grid - Área principal (tela cheia) */}
      <div className="w-full h-full bg-surface-900  border border-surface-500/30 shadow-cosmic relative">
        <BattleCanvas
          ref={canvasRef}
          battle={battle}
          units={units}
          currentUserId={user.id}
          selectedUnitId={selectedUnitId}
          activeUnitId={battle.activeUnitId}
          onUnitClick={handleUnitClick}
          onCellClick={handleCellClick}
          onObstacleClick={handleObstacleClick}
          onRightClick={() => setPendingAction(null)}
          onCellHover={setHoveredCell}
          unitDirection={unitDirection}
          pendingAction={pendingAction}
          activeBubbles={activeBubbles}
          spellAreaPreview={areaPreview}
          targetingPreview={targetingPreview}
        />

        {/* BattleHeader - Overlay na parte superior (dentro do Canvas) */}
        <BattleHeader
          battle={battle}
          units={units}
          currentUserId={user.id}
          selectedUnitId={selectedUnitId ?? undefined}
          onUnitClick={handleInitiativeUnitClick}
          onEndTurn={handleEndAction}
          canEndTurn={isMyTurn && !!selectedUnit}
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
        />
      </div>

      {/* Modal de Resultado da Batalha (com delay de 1s) */}
      {showDelayedBattleResult && battleResult && (
        <BattleResultModal
          result={battleResult}
          units={battleResult.finalUnits}
          isWinner={battleResult.winnerId === user.id}
          myKingdomName={myKingdom?.kingdomName ?? "Meu Reino"}
          opponentKingdomName={opponentKingdom?.kingdomName ?? "Oponente"}
          myUserId={user.id}
          onRematch={requestRematch}
          onLeave={dismissBattleResult}
          rematchPending={rematchPending}
          opponentWantsRematch={opponentWantsRematch}
          vsBot={battleResult.vsBot}
        />
      )}

      {/* QTE Overlay - Quick Time Event para ataques */}
      {qteState.activeQTE && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto">
            <QTEOverlay
              config={qteState.activeQTE}
              onResponse={respondToQTE}
              isResponder={isQTEResponder}
              isVisualActive={isQTEVisualActive}
              responderName={qteResponderUnit?.name ?? "Unidade"}
              attackerName={qteAttackerUnit?.name ?? "Inimigo"}
              externalResult={qteState.result?.grade ?? null}
            />
          </div>
        </div>
      )}

      {/* Notificação de Turno (Início e Auto-End) */}
      <TurnNotification
        currentPlayerId={battle.currentPlayerId}
        myUserId={user.id}
        round={battle.round}
        isRoundStart={isRoundStart}
        currentPlayerKingdomName={
          isMyTurn
            ? myKingdom?.kingdomName ?? "Meu Reino"
            : opponentKingdom?.kingdomName ?? "Oponente"
        }
        myUnitHasStartedAction={myActiveUnit?.hasStartedAction ?? false}
        myUnitMovesLeft={myActiveUnit?.movesLeft ?? 0}
        myUnitActionsLeft={myActiveUnit?.actionsLeft ?? 0}
        myUnitAttacksLeft={myActiveUnit?.attacksLeftThisTurn ?? 0}
        onEndAction={handleEndAction}
      />

      {/* Notificação de Seleção de Alvo */}
      <TargetSelectionNotification
        pendingAction={pendingAction}
        onCancel={() => setPendingAction(null)}
      />

      {/* Chat de Batalha - Abre com Enter (escondido quando modal de resultado está aberto) */}
      {!showDelayedBattleResult && (
        <BattleChatUI
          currentUnitId={
            selectedUnitId || battle.activeUnitId || myUnits[0]?.id
          }
          selectedUnitId={selectedUnitId}
        />
      )}
    </div>
  );
};

/**
 * Componente interno do Chat (sem Provider, usado dentro do BattleViewInner)
 */
const BattleChatUI: React.FC<{
  currentUnitId?: string | null;
  selectedUnitId?: string | null;
}> = ({ currentUnitId, selectedUnitId }) => {
  const { state, openChat, closeChat, toggleChat } = useChat();

  // Toggle chat com Enter usando react-hotkeys-hook
  useEnterKey(toggleChat, {
    enabled: !state.isOpen,
    ignoreInputs: true,
  });

  if (!state.isOpen) {
    return (
      <div className="fixed bottom-32 left-4 z-50">
        <button
          onClick={openChat}
          className="
            flex items-center gap-2 px-3 py-1.5
            bg-cosmos-deep/80 backdrop-blur-sm
            border border-surface-500/30 rounded-lg
            text-astral-dim hover:text-astral-chrome
            hover:border-stellar-amber/30
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
        selectedUnitId={selectedUnitId || undefined}
        variant="compact"
        placeholder="Mensagem ou /comando..."
        maxHeight="150px"
        title="Chat de Batalha"
        onClose={closeChat}
        enableCommands={true}
      />
    </div>
  );
};
