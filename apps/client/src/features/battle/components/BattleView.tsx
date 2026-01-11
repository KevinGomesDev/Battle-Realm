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
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import { findAbilityByCode } from "@boundless/shared/data/abilities.data";
import {
  canUseDash,
  hasDashingCondition,
} from "@boundless/shared/data/conditions.data";
import { resolveDynamicValue } from "@boundless/shared/types/ability.types";
import { getFullMovementInfo } from "@boundless/shared/utils/engagement.utils";
import {
  hasLineOfSight,
  obstaclesToBlockers,
  unitsToBlockers,
} from "@boundless/shared/utils/line-of-sight.utils";
import { isValidAbilityPosition } from "@boundless/shared/utils/ability-validation";
import { useTargeting } from "../hooks/useTargeting";
import { colyseusService } from "../../../services/colyseus.service";
import { useBattleStore } from "../../../stores/battleStore";
import {
  isPlayerControllable,
  isUnitDisabled,
  getControllableUnits,
} from "../utils/unit-control";
import { useHotkey, useEnterKey } from "../../../hooks/useHotkey";
import { useMovementController } from "../hooks/useMovementController";
import {
  type PendingAbility,
  createPendingAbility,
} from "../types/pending-ability.types";
import type { UnitHotbarConfig } from "@boundless/shared/types/hotbar.types";
import {
  getUnitSizeDefinition,
  getObstacleDimension,
  type UnitSize,
  type ObstacleSize,
} from "@boundless/shared/config";

/**
 * BattleView - Componente principal da batalha
 */
export const BattleView: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    state: { battle, isInBattle, winnerId, isLoading },
  } = useBattle();

  // Se não está em batalha ou tem resultado, redireciona para dashboard
  // MAS aguarda tempo suficiente para reconexão completar
  useEffect(() => {
    // Se está carregando (reconectando), não redireciona
    if (isLoading) {
      console.log("[BattleView] Aguardando reconexão...");
      return;
    }

    // Se está em batalha ou tem resultado, não redireciona
    if (isInBattle || winnerId || battle) {
      return;
    }

    // Verificar também o colyseusService para evitar redirecionamento prematuro
    if (colyseusService.isInBattle()) {
      console.log(
        "[BattleView] colyseusService ainda em batalha, aguardando..."
      );
      return;
    }

    // Aguarda 2 segundos para dar tempo da reconexão completar
    console.log(
      "[BattleView] Nenhuma batalha detectada, aguardando 2s antes de redirecionar..."
    );
    const timer = setTimeout(() => {
      // Verificar novamente antes de redirecionar
      const currentState = useBattleStore.getState();
      if (
        !currentState.isInBattle &&
        !currentState.isLoading &&
        !colyseusService.isInBattle()
      ) {
        console.log("[BattleView] Redirecionando para dashboard");
        navigate("/dashboard", { replace: true });
      } else {
        console.log("[BattleView] Cancelando redirect - batalha detectada");
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [isInBattle, winnerId, battle, isLoading, navigate]);

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
    executeAbility,
    surrender,
    requestRematch,
    dismissBattleResult,
  } = useBattle();

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [pendingAbility, setPendingAbility] = useState<PendingAbility | null>(
    null
  ); // Ability aguardando alvo

  // Hotbars por unidade (armazenado localmente, depois será sincronizado com server)
  const [unitHotbars, setUnitHotbars] = useState<
    Record<string, UnitHotbarConfig>
  >({});

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
  // Ref para movimento pendente após disparada automática
  const pendingDashMoveRef = useRef<{ x: number; y: number } | null>(null);
  // Ref para manter units atualizado nos handlers de eventos Colyseus
  const unitsRef = useRef<BattleUnit[]>(units);
  useEffect(() => {
    unitsRef.current = units;
  }, [units]);

  // === CÉLULAS VISÍVEIS - Fog of War ===
  // Calcula quais células são visíveis baseado no visionRange das unidades aliadas
  const visibleCells = useMemo((): Set<string> => {
    if (!user?.id || !battle) return new Set();

    const visible = new Set<string>();
    const GRID_WIDTH = battle.config.grid.width;
    const GRID_HEIGHT = battle.config.grid.height;
    const OBSTACLES = battle.config.map.obstacles || [];

    // Obter todas as unidades aliadas vivas
    const myUnits = units.filter((u) => u.ownerId === user.id && u.isAlive);

    // Se não tem unidades, mostrar tudo (fallback)
    if (myUnits.length === 0) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        for (let y = 0; y < GRID_HEIGHT; y++) {
          visible.add(`${x},${y}`);
        }
      }
      return visible;
    }

    // Preparar bloqueadores para cálculo de Line of Sight
    const obstacleBlockers = obstaclesToBlockers(
      OBSTACLES.map((obs) => ({
        posX: obs.posX,
        posY: obs.posY,
        destroyed: obs.destroyed,
        size: obs.size,
      }))
    );

    // Unidades inimigas vivas bloqueiam visão
    const enemyUnits = units.filter((u) => u.ownerId !== user.id && u.isAlive);
    const unitBlockers = unitsToBlockers(
      enemyUnits.map((u) => ({
        id: u.id,
        posX: u.posX,
        posY: u.posY,
        isAlive: u.isAlive,
        size: u.size,
      })),
      []
    );

    const allBlockers = [...obstacleBlockers, ...unitBlockers];

    // Para cada unidade aliada, calcular células visíveis
    myUnits.forEach((unit) => {
      const visionRange = unit.visionRange ?? 10;
      const unitSize = unit.size ?? "NORMAL";
      const dimension =
        unitSize === "NORMAL"
          ? 1
          : unitSize === "LARGE"
          ? 2
          : unitSize === "HUGE"
          ? 4
          : 8;

      for (let dx = 0; dx < dimension; dx++) {
        for (let dy = 0; dy < dimension; dy++) {
          const unitCellX = unit.posX + dx;
          const unitCellY = unit.posY + dy;

          for (let vx = -visionRange; vx <= visionRange; vx++) {
            for (let vy = -visionRange; vy <= visionRange; vy++) {
              if (Math.abs(vx) + Math.abs(vy) <= visionRange) {
                const targetX = unitCellX + vx;
                const targetY = unitCellY + vy;

                if (
                  targetX >= 0 &&
                  targetX < GRID_WIDTH &&
                  targetY >= 0 &&
                  targetY < GRID_HEIGHT
                ) {
                  const cellKey = `${targetX},${targetY}`;
                  if (visible.has(cellKey)) continue;

                  if (
                    hasLineOfSight(
                      unitCellX,
                      unitCellY,
                      targetX,
                      targetY,
                      allBlockers
                    )
                  ) {
                    visible.add(cellKey);
                  }
                }
              }
            }
          }
        }
      }
    });

    return visible;
  }, [user?.id, battle, units]);

  // Ouvir eventos de combate para disparar animações e centralizar câmera
  useEffect(() => {
    // Handler para ataque - anima atacante (Sword) e alvo (Damage)
    // Também centraliza a câmera no alvo se estiver visível
    const handleUnitAttacked = (data: {
      attackerUnitId: string;
      targetUnitId: string | null;
      missed?: boolean;
      finalDamage?: number;
      damage?: number;
      targetDefeated?: boolean;
    }) => {
      const attackerUnit = unitsRef.current.find(
        (u) => u.id === data.attackerUnitId
      );
      const targetUnit = data.targetUnitId
        ? unitsRef.current.find((u) => u.id === data.targetUnitId)
        : null;

      // Centralizar câmera no alvo se estiver na visão do jogador
      if (data.targetUnitId && canvasRef.current) {
        canvasRef.current.centerOnUnitIfVisible(data.targetUnitId);
      }

      // Animação de ataque no atacante
      if (canvasRef.current && data.attackerUnitId) {
        canvasRef.current.playAnimation(data.attackerUnitId, "Sword_1");
      }

      // Calcular se é crítico (dano alto proporcionalmente)
      const damageDealt = data.finalDamage ?? data.damage ?? 0;
      const targetMaxHp = targetUnit?.maxHp ?? 100;
      const isCritical = damageDealt >= targetMaxHp * 0.25;

      // Disparar projétil se houver atacante e alvo
      if (attackerUnit && targetUnit && canvasRef.current) {
        canvasRef.current.fireProjectile({
          abilityCode: "ATTACK",
          startX: attackerUnit.posX,
          startY: attackerUnit.posY,
          endX: targetUnit.posX,
          endY: targetUnit.posY,
          casterId: attackerUnit.id,
          targetId: targetUnit.id,
          onComplete: () => {
            // Animação de dano no alvo após projétil chegar
            if (!data.missed && data.targetUnitId && canvasRef.current) {
              canvasRef.current.playAnimation(data.targetUnitId, "Damage");

              // Hit Stop - Freeze + Shake + Partículas (SÓ se visível para o jogador)
              const isTargetVisible = canvasRef.current.isUnitVisible(
                data.targetUnitId
              );
              if (targetUnit && isTargetVisible) {
                canvasRef.current.triggerHitStop(
                  targetUnit.posX,
                  targetUnit.posY,
                  damageDealt,
                  targetMaxHp,
                  isCritical
                );
              }
            }
          },
        });
      } else if (!data.missed && data.targetUnitId && canvasRef.current) {
        // Fallback se não conseguir disparar projétil
        const isTargetVisible = canvasRef.current.isUnitVisible(
          data.targetUnitId
        );

        setTimeout(() => {
          if (canvasRef.current) {
            canvasRef.current.playAnimation(data.targetUnitId!, "Damage");

            // Hit Stop no fallback também (SÓ se visível)
            if (targetUnit && isTargetVisible) {
              canvasRef.current.triggerHitStop(
                targetUnit.posX,
                targetUnit.posY,
                damageDealt,
                targetMaxHp,
                isCritical
              );
            }
          }
        }, 200);
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
      targetPosition?: { x: number; y: number };
      impactPoint?: { x: number; y: number };
      skillCode: string;
      isAreaAbility?: boolean;
      affectedCells?: Array<{ x: number; y: number }>;
    }) => {
      const casterUnit = unitsRef.current.find(
        (u) => u.id === data.casterUnitId
      );
      // Usar impactPoint se disponível, senão targetPosition
      const targetPos = data.impactPoint ?? data.targetPosition;

      // Disparar projétil se houver caster e posição alvo
      if (casterUnit && targetPos && canvasRef.current) {
        // Calcular tamanho da explosão baseado nas células afetadas
        const explosionSize = data.affectedCells?.length
          ? Math.ceil(Math.sqrt(data.affectedCells.length))
          : undefined;

        canvasRef.current.fireProjectile({
          abilityCode: data.skillCode,
          startX: casterUnit.posX,
          startY: casterUnit.posY,
          endX: targetPos.x,
          endY: targetPos.y,
          casterId: casterUnit.id,
          isAreaProjectile: data.isAreaAbility,
          explosionSize,
        });
      }
    };

    // Handler para erros - reseta lock de movimento imediatamente
    const handleBattleError = () => {
      isMovingRef.current = false;
    };

    // Handler para dodge - anima movimento de esquiva
    const handleUnitDodged = (data: {
      unitId: string;
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
    }) => {
      if (canvasRef.current) {
        canvasRef.current.animateMovement(
          data.unitId,
          data.fromX,
          data.fromY,
          data.toX,
          data.toY
        );
      }
    };

    // Handler para projétil lançado - dispara animação visual
    const handleProjectileLaunched = (data: {
      casterUnitId: string;
      skillCode: string;
      targetPosition?: { x: number; y: number };
      impactPoint?: { x: number; y: number };
      targetId?: string;
    }) => {
      const casterUnit = unitsRef.current.find(
        (u) => u.id === data.casterUnitId
      );
      const targetPos = data.impactPoint ?? data.targetPosition;

      if (casterUnit && targetPos && canvasRef.current) {
        canvasRef.current.fireProjectile({
          abilityCode: data.skillCode,
          startX: casterUnit.posX,
          startY: casterUnit.posY,
          endX: targetPos.x,
          endY: targetPos.y,
          casterId: casterUnit.id,
          targetId: data.targetId,
          isAreaProjectile: true,
        });
      }
    };

    // === NOVO SISTEMA DE PROJÉTEIS ===
    // Handlers para eventos do ProjectileHandler do servidor
    const handleProjectileStart = (data: {
      projectileId: string;
      abilityId: string;
      casterId: string;
      origin: { x: number; y: number };
      destination: { x: number; y: number };
      path: Array<{ x: number; y: number }>;
    }) => {
      console.log("[BattleView] 🚀 projectile:start recebido", data);
      if (canvasRef.current) {
        canvasRef.current.fireProjectile({
          abilityCode: data.abilityId,
          startX: data.origin.x,
          startY: data.origin.y,
          endX: data.destination.x,
          endY: data.destination.y,
          casterId: data.casterId,
          isAreaProjectile: true,
        });
      }
    };

    const handleProjectileIntercept = (data: {
      projectileId: string;
      unitId: string;
      unitName: string;
      position: { x: number; y: number };
    }) => {
      console.log("[BattleView] ⚡ projectile:intercept recebido", data);
      // Interceptação de projétil - unidade será atingida
    };

    const handleProjectileDodge = (data: {
      projectileId: string;
      unitId: string;
      dodged: boolean;
      newPosition?: { x: number; y: number };
    }) => {
      console.log("[BattleView] 🏃 projectile:dodge recebido", data);
      // Animação de esquiva pode ser adicionada aqui
    };

    const handleProjectileImpact = (data: {
      projectileId: string;
      position: { x: number; y: number };
      affectedUnits: string[];
    }) => {
      console.log("[BattleView] 💥 projectile:impact recebido", data);
      // Animação de explosão será tratada pelo sistema de projéteis do canvas
    };

    const handleProjectileFinish = (data: {
      projectileId: string;
      reason: string;
      finalPosition: { x: number; y: number };
    }) => {
      console.log("[BattleView] ✅ projectile:finish recebido", data);
    };

    colyseusService.on("battle:unit_attacked", handleUnitAttacked);
    colyseusService.on("battle:unit_moved", handleUnitMoved);
    colyseusService.on("battle:skill_used", handleSkillUsed);
    colyseusService.on("battle:error", handleBattleError);
    colyseusService.on("battle:unit_dodged", handleUnitDodged);
    colyseusService.on("battle:projectile_launched", handleProjectileLaunched);
    // Novos eventos de projétil
    colyseusService.on("battle:projectile:start", handleProjectileStart);
    colyseusService.on(
      "battle:projectile:intercept",
      handleProjectileIntercept
    );
    colyseusService.on("battle:projectile:dodge", handleProjectileDodge);
    colyseusService.on("battle:projectile:impact", handleProjectileImpact);
    colyseusService.on("battle:projectile:finish", handleProjectileFinish);

    return () => {
      colyseusService.off("battle:unit_attacked", handleUnitAttacked);
      colyseusService.off("battle:unit_moved", handleUnitMoved);
      colyseusService.off("battle:skill_used", handleSkillUsed);
      colyseusService.off("battle:error", handleBattleError);
      colyseusService.off("battle:unit_dodged", handleUnitDodged);
      colyseusService.off(
        "battle:projectile_launched",
        handleProjectileLaunched
      );
      // Novos eventos de projétil
      colyseusService.off("battle:projectile:start", handleProjectileStart);
      colyseusService.off(
        "battle:projectile:intercept",
        handleProjectileIntercept
      );
      colyseusService.off("battle:projectile:dodge", handleProjectileDodge);
      colyseusService.off("battle:projectile:impact", handleProjectileImpact);
      colyseusService.off("battle:projectile:finish", handleProjectileFinish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // unitsRef usado para evitar stale closures

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

    // Limpar ability pendente e tracking de beginAction (agendado para evitar cascade)
    queueMicrotask(() => {
      setPendingAbility(null);
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

    console.log("[BattleView] Auto-select check:", {
      battleCurrentPlayerId: battle.currentPlayerId,
      userId: user.id,
      isMyTurnNow,
      turnKey,
    });

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
      pendingDashMoveRef.current = null; // Limpar movimento pendente de dash em caso de erro
    }
  }, [battleError]);

  // Handler para centralizar mapa em uma unidade E selecioná-la (chamado pelo BattleHeader)
  const handleInitiativeUnitClick = useCallback(
    (unit: BattleUnit) => {
      // Selecionar a unidade se for do jogador (controlável)
      if (user && isPlayerControllable(unit, user.id)) {
        setSelectedUnitId(unit.id);
        // Limpar ability pendente ao trocar de unidade
        setPendingAbility(null);
        // Sempre centralizar câmera na unidade do jogador
        canvasRef.current?.centerOnUnit(unit.id);
      } else {
        // Para unidades inimigas, só centralizar se estiver na visão do jogador
        canvasRef.current?.centerOnUnitIfVisible(unit.id);
      }
    },
    [user]
  );

  // Callback para verificar se uma unidade está visível (exposto para BattleHeader)
  const isUnitVisibleForHeader = useCallback((unitId: string): boolean => {
    return canvasRef.current?.isUnitVisible(unitId) ?? false;
  }, []);

  // === VARIÁVEIS DERIVADAS (antes dos early returns para usar nos hooks) ===
  const isMyTurn = battle?.currentPlayerId === user?.id;
  const selectedUnit = units.find((u) => u.id === selectedUnitId);
  const myUnits = user ? getControllableUnits(units, user.id) : [];

  // Efeito para executar movimento pendente após disparada automática
  useEffect(() => {
    if (!selectedUnit || !pendingDashMoveRef.current) return;

    // Verificar se a unidade agora tem a condição DASHING
    if (hasDashingCondition(selectedUnit.conditions)) {
      const pendingMove = pendingDashMoveRef.current;
      pendingDashMoveRef.current = null; // Limpar antes de executar para evitar loops

      console.log(
        "%c[BattleView] 💨 Executando movimento após disparada!",
        "color: #22d3ee; font-weight: bold;",
        {
          targetPosition: pendingMove,
          movesLeft: selectedUnit.movesLeft,
        }
      );

      // Executar movimento para a posição alvo
      moveUnit(selectedUnit.id, pendingMove.x, pendingMove.y);
    }
  }, [selectedUnit, moveUnit]);

  // Hook de targeting - calcula preview de células selecionáveis e afetadas
  // Chamado ANTES dos early returns para seguir as regras de hooks
  const { targetingPreview } = useTargeting({
    selectedUnit,
    pendingAbility,
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

  // Preview de área para abilities de área
  // Usa targetingPattern.coordinates para calcular área
  const areaPreview = useMemo(() => {
    if (!pendingAbility || !selectedUnit) return null;

    const { ability } = pendingAbility;
    const pattern = ability.targetingPattern;

    // Verificar se tem pattern com coordenadas (área)
    if (!pattern || !pattern.coordinates || pattern.coordinates.length === 0) {
      return null;
    }

    const casterPos = { x: selectedUnit.posX, y: selectedUnit.posY };

    // Calcular tamanho da área baseado nas coordenadas do pattern
    const maxOffset = pattern.coordinates.reduce((max, coord) => {
      return Math.max(max, Math.abs(coord.x), Math.abs(coord.y));
    }, 0);
    const size = maxOffset * 2 + 1; // Converter offset para tamanho (ex: offset 1 = 3x3)

    // Resolver maxRange do pattern
    const maxRange = pattern.maxRange
      ? resolveDynamicValue(pattern.maxRange, selectedUnit)
      : undefined;

    // Verificar se é SELF (origin CASTER sem coords ou apenas 0,0)
    const isSelf =
      pattern.origin === "CASTER" &&
      (pattern.coordinates.length === 0 ||
        (pattern.coordinates.length === 1 &&
          pattern.coordinates[0].x === 0 &&
          pattern.coordinates[0].y === 0));

    return {
      size,
      color: ability.color || "#4ade80",
      centerOnSelf: isSelf,
      maxRange,
      casterPos,
    };
  }, [pendingAbility, selectedUnit]);

  // Preview de linha para abilities com PATTERNS.SINGLE (alvo único a distância)
  // Mostra linha do caster até o alvo, limitada pelo maxRange
  const singleTargetLinePreview = useMemo(() => {
    if (!pendingAbility || !selectedUnit) return null;

    const { ability } = pendingAbility;
    const pattern = ability.targetingPattern;

    // Verificar se é um pattern SINGLE (uma única coordenada em {0,0})
    const isSinglePattern =
      pattern?.coordinates?.length === 1 &&
      pattern.coordinates[0].x === 0 &&
      pattern.coordinates[0].y === 0;

    if (!isSinglePattern) return null;

    // Verificar se tem maxRange > 1 (para mostrar linha apenas em habilidades à distância)
    const maxRange = pattern?.maxRange
      ? resolveDynamicValue(pattern.maxRange, selectedUnit)
      : 1;

    // Não mostrar linha para melee (range 1)
    if (maxRange <= 1) return null;

    return {
      from: { x: selectedUnit.posX, y: selectedUnit.posY },
      maxRange,
      color: ability.color || "rgba(0, 255, 255, 0.8)",
    };
  }, [pendingAbility, selectedUnit]);

  // Determinar meu kingdom e oponentes (suporta múltiplos jogadores)
  const myKingdom = battle?.kingdoms.find((k) => k.ownerId === user?.id);
  const opponentKingdoms = battle?.kingdoms.filter(
    (k) => k.ownerId !== user?.id
  );
  // Para compatibilidade com UI existente, pegar primeiro oponente
  const opponentKingdom = opponentKingdoms?.[0];

  // === MOVIMENTAÇÃO FLUIDA COM WASD (movimento contínuo) ===
  useMovementController({
    selectedUnit,
    isMyTurn,
    currentUserId: user?.id ?? null,
    enabled: !isPauseMenuOpen && !pendingAbility,
    units,
    obstacles: battle?.config.map.obstacles ?? [],
    gridWidth: battle?.config.grid.width ?? 0,
    gridHeight: battle?.config.grid.height ?? 0,
    visibleCells,
    onDirectionChange: (unitId, direction) => {
      setUnitDirection({ unitId, direction });
    },
    onMove: (unitId, toX, toY) => {
      isMovingRef.current = true;
      moveUnit(unitId, toX, toY);
    },
    // Client-side prediction: anima ANTES do servidor confirmar
    onAnimateMove: (unitId, fromX, fromY, toX, toY) => {
      canvasRef.current?.animateMovement(unitId, fromX, fromY, toX, toY);
    },
  });

  // Handler para selecionar uma ability (quando clica em ação que requer alvo)
  const handleSelectAbility = useCallback((abilityCode: string) => {
    const ability = findAbilityByCode(abilityCode);
    if (!ability) {
      console.error(`[BattleView] Ability não encontrada: ${abilityCode}`);
      return;
    }

    const pending = createPendingAbility(ability);
    setPendingAbility(pending);

    console.log(
      "%c[BattleView] 🎯 Ability selecionada, aguardando alvo",
      "color: #f59e0b; font-weight: bold;",
      { abilityCode, ability: ability.name }
    );
  }, []);

  // Handler para atualizar hotbar de uma unidade
  const handleUpdateHotbar = useCallback(
    (unitId: string, newHotbar: UnitHotbarConfig) => {
      setUnitHotbars((prev) => ({
        ...prev,
        [unitId]: newHotbar,
      }));

      // Enviar para o servidor para persistir
      colyseusService.sendToBattle("battle:update_hotbar", {
        unitId,
        hotbar: newHotbar,
      });

      console.log(
        "%c[BattleView] 📊 Hotbar atualizada",
        "color: #a855f7; font-weight: bold;",
        { unitId, hotbar: newHotbar }
      );
    },
    []
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
        pendingAbility: pendingAbility?.code,
      }
    );

    // Se há uma ability de área pendente, tratar como clique de célula
    if (pendingAbility && selectedUnit && isMyTurn) {
      const ability = pendingAbility.ability;
      const hasAreaPattern =
        ability.targetingPattern?.coordinates &&
        ability.targetingPattern.coordinates.length > 1;

      // Área = pattern com múltiplas coordenadas
      if (hasAreaPattern) {
        console.log(
          "%c[BattleView] 🔮 Ability de área: delegando para handleCellClick",
          "color: #a855f7;",
          {
            abilityCode: pendingAbility.code,
            position: { x: unit.posX, y: unit.posY },
          }
        );
        handleCellClick(unit.posX, unit.posY);
        return;
      }
    }

    // Se há uma ação de ATTACK pendente
    if (pendingAbility?.type === "ATTACK" && selectedUnit && isMyTurn) {
      const dx = Math.abs(unit.posX - selectedUnit.posX);
      const dy = Math.abs(unit.posY - selectedUnit.posY);

      // Chebyshev distance: permite diagonais (8 direções)
      if (Math.max(dx, dy) === 1) {
        console.log(
          "%c[BattleView] ⚔️ Atacando alvo!",
          "color: #ef4444; font-weight: bold;",
          { targetId: unit.id, targetName: unit.name }
        );
        attackUnit(selectedUnit.id, { x: unit.posX, y: unit.posY }, unit.id);
        setPendingAbility(null);
      } else {
        console.log(
          "%c[BattleView] ❌ Alvo fora de alcance",
          "color: #ef4444;"
        );
      }
      return;
    }

    // Se há uma ability pendente, enviar apenas a posição da célula clicada
    // O servidor é responsável por encontrar as unidades afetadas
    if (
      pendingAbility &&
      pendingAbility.type === "ABILITY" &&
      selectedUnit &&
      isMyTurn
    ) {
      console.log(
        "%c[BattleView] ✨ Executando ability na célula da unidade!",
        "color: #a855f7; font-weight: bold;",
        {
          abilityCode: pendingAbility.code,
          targetPosition: { x: unit.posX, y: unit.posY },
        }
      );
      executeAbility(selectedUnit.id, pendingAbility.code, {
        x: unit.posX,
        y: unit.posY,
      });
      setPendingAbility(null);
      return;
    }

    // Comportamento padrão: selecionar unidade
    // Só permite selecionar unidades controláveis (não SUMMON/MONSTER)
    if (isPlayerControllable(unit, user.id)) {
      // Verificar se a unidade está desabilitada (DISABLED)
      // Unidades desabilitadas não podem iniciar ação
      const unitIsDisabled = isUnitDisabled(unit);

      // Se clicar na mesma unidade E há uma ability pendente → self-cast (enviar posição)
      if (selectedUnitId === unit.id && pendingAbility && isMyTurn) {
        const ability = pendingAbility.ability;
        const pattern = ability.targetingPattern;

        // Self-cast: origin CASTER ou padrão SINGLE
        const isSingleTarget =
          pattern?.coordinates?.length === 1 &&
          pattern.coordinates[0].x === 0 &&
          pattern.coordinates[0].y === 0;
        const isSelf = pattern?.origin === "CASTER" || isSingleTarget;

        if (isSelf) {
          console.log(
            "%c[BattleView] ✨ Executando ability em si mesmo!",
            "color: #a855f7; font-weight: bold;",
            {
              abilityCode: pendingAbility.code,
              targetPosition: { x: unit.posX, y: unit.posY },
            }
          );
          executeAbility(unit.id, pendingAbility.code, {
            x: unit.posX,
            y: unit.posY,
          });
          setPendingAbility(null);
          return;
        }

        // Se não era ability que aceita self-cast, faz toggle normal
        console.log(
          "%c[BattleView] 🔄 Desselecionando unidade (toggle)",
          "color: #f59e0b;",
          { unitId: unit.id }
        );
        setSelectedUnitId(null);
        setPendingAbility(null);
        return;
      }

      // Toggle: clicar na mesma unidade desseleciona (quando não há pendingAbility)
      if (selectedUnitId === unit.id) {
        console.log(
          "%c[BattleView] 🔄 Desselecionando unidade (toggle)",
          "color: #f59e0b;",
          { unitId: unit.id }
        );
        setSelectedUnitId(null);
        setPendingAbility(null);
        return;
      }

      // Bloquear seleção para iniciar ação se unidade estiver desabilitada
      if (unitIsDisabled) {
        console.log(
          "%c[BattleView] 🚫 Unidade desabilitada não pode ser selecionada para agir",
          "color: #6b7280;",
          { unitId: unit.id, unitName: unit.name }
        );
        // Permite selecionar para visualizar, mas não para agir
        setSelectedUnitId(unit.id);
        setPendingAbility(null);
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
      setPendingAbility(null); // Limpa ability pendente ao trocar unidade

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
        setPendingAbility(null);
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
    // Se há uma ability pendente com targeting preview, confirmar na célula apontada
    if (
      pendingAbility &&
      targetingPreview &&
      targetingPreview.isValidTarget &&
      targetingPreview.affectedCells.length > 0
    ) {
      // Usar a primeira célula afetada como alvo (ou todas para ações de área)
      const targetCell = targetingPreview.affectedCells[0];

      // Verificar se é ATTACK
      if (pendingAbility.type === "ATTACK") {
        // Verificar se há uma unidade na célula alvo (considerando tamanho)
        const targetUnit = units.find((u) => {
          if (!u.isAlive) return false;
          const sizeDef = getUnitSizeDefinition(u.size as UnitSize);
          const dimension = sizeDef.dimension;
          for (let dx = 0; dx < dimension; dx++) {
            for (let dy = 0; dy < dimension; dy++) {
              if (
                u.posX + dx === targetCell.x &&
                u.posY + dy === targetCell.y
              ) {
                return true;
              }
            }
          }
          return false;
        });
        // Verificar se há obstáculo na célula alvo (considerando tamanho)
        const targetObstacle = battle.config.map?.obstacles?.find(
          (o: {
            posX: number;
            posY: number;
            destroyed?: boolean;
            size?: string;
          }) => {
            if (o.destroyed) return false;
            const dimension = getObstacleDimension(
              (o.size || "SMALL") as ObstacleSize
            );
            for (let dx = 0; dx < dimension; dx++) {
              for (let dy = 0; dy < dimension; dy++) {
                if (
                  o.posX + dx === targetCell.x &&
                  o.posY + dy === targetCell.y
                ) {
                  return true;
                }
              }
            }
            return false;
          }
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
        setPendingAbility(null);
        return;
      }

      // Se é uma ability (skill ou spell) - enviar apenas targetPosition
      if (pendingAbility.type === "ABILITY") {
        console.log(
          "%c[BattleView] ✨ Confirmando ability direcional!",
          "color: #a855f7; font-weight: bold;",
          {
            abilityCode: pendingAbility.code,
            targetPosition: { x: targetCell.x, y: targetCell.y },
          }
        );

        executeAbility(selectedUnit.id, pendingAbility.code, {
          x: targetCell.x,
          y: targetCell.y,
        });
        setPendingAbility(null);
        return;
      }
    }

    // Se há uma ability pendente que targetiza posição (pattern de área)
    if (pendingAbility && pendingAbility.type === "ABILITY" && selectedUnit) {
      const ability = pendingAbility.ability;
      const hasAreaPattern =
        ability.targetingPattern?.coordinates &&
        ability.targetingPattern.coordinates.length > 1;

      if (hasAreaPattern) {
        // Usar validação centralizada
        const isValid = isValidAbilityPosition(
          selectedUnit,
          ability,
          { x, y },
          units,
          battle.config.grid.width,
          battle.config.grid.height
        );

        if (isValid) {
          console.log(
            "%c[BattleView] ✨ Executando ability em posição!",
            "color: #a855f7; font-weight: bold;",
            { abilityCode: pendingAbility.code, position: { x, y } }
          );
          executeAbility(selectedUnit.id, pendingAbility.code, { x, y });
          setPendingAbility(null);
        } else {
          console.log(
            "%c[BattleView] ❌ Posição inválida para ability",
            "color: #ef4444;",
            { abilityCode: pendingAbility.code, position: { x, y } }
          );
        }
        return;
      }

      // Skills de área (targetingPattern.type: AREA com coordinates)
      const hasAreaCoordinates =
        ability?.targetingPattern?.coordinates &&
        ability.targetingPattern.coordinates.length > 1;
      if (ability?.targetingPattern?.type === "AREA" && hasAreaCoordinates) {
        // Verificar se está dentro do alcance
        const distance =
          Math.abs(x - selectedUnit.posX) + Math.abs(y - selectedUnit.posY);
        const maxRange = ability.targetingPattern?.maxRange
          ? resolveDynamicValue(ability.targetingPattern.maxRange, selectedUnit)
          : 4;

        if (distance <= maxRange) {
          console.log(
            "%c[BattleView] ✨ Executando ability de área em posição!",
            "color: #fbbf24; font-weight: bold;",
            { abilityCode: pendingAbility.code, position: { x, y } }
          );
          executeAbility(selectedUnit.id, pendingAbility.code, { x, y });
          setPendingAbility(null);
          return;
        } else {
          console.log(
            "%c[BattleView] ❌ Posição fora do alcance para ability de área",
            "color: #ef4444;",
            { abilityCode: pendingAbility.code, distance, maxRange }
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
      // Verificar se a célula está visível (não pode mover para fog of war)
      const cellKey = `${x},${y}`;
      if (!visibleCells.has(cellKey)) {
        console.log(
          "%c[BattleView] 🌫️ Célula não visível (fog of war)!",
          "color: #6b7280;"
        );
        return;
      }

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

      // Verificar se está dentro do range normal de movimento
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
        // Verificar se pode usar disparada automática
        const dashRange = selectedUnit.movesLeft + selectedUnit.speed;
        const canUseDashNow =
          canUseDash(selectedUnit.conditions, selectedUnit.actionsLeft) &&
          !hasDashingCondition(selectedUnit.conditions);

        if (
          canUseDashNow &&
          !moveInfo.isBlocked &&
          moveInfo.totalCost <= dashRange
        ) {
          // Disparada automática! Primeiro executa DASH, depois move
          console.log(
            "%c[BattleView] 💨 Disparada automática ativada!",
            "color: #22d3ee; font-weight: bold;",
            {
              targetPosition: { x, y },
              totalCost: moveInfo.totalCost,
              currentMoves: selectedUnit.movesLeft,
              dashBonus: selectedUnit.speed,
              totalAfterDash: dashRange,
            }
          );

          // Registrar posição alvo para movimento após dash
          pendingDashMoveRef.current = { x, y };
          isMovingRef.current = true;

          // Executar DASH (dispara movimento quando receber confirmação)
          executeAbility(selectedUnit.id, "DASH");
        } else {
          console.log(
            "%c[BattleView] ❌ Custo de movimento muito alto (sem dash disponível)",
            "color: #ef4444;",
            {
              totalCost: moveInfo.totalCost,
              movesLeft: selectedUnit.movesLeft,
              canDash: canUseDashNow,
              dashRange,
            }
          );
        }
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
        pendingAbility: pendingAbility?.code,
      }
    );

    // Se há ação de ataque pendente e estou adjacente (8 direções)
    if (pendingAbility?.type === "ATTACK" && selectedUnit && isMyTurn) {
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
        setPendingAbility(null);
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
          onRightClick={() => setPendingAbility(null)}
          onCellHover={setHoveredCell}
          unitDirection={unitDirection}
          pendingAction={pendingAbility?.code ?? null}
          activeBubbles={activeBubbles}
          abilityAreaPreview={areaPreview}
          targetingPreview={areaPreview ? null : targetingPreview}
          singleTargetLinePreview={singleTargetLinePreview}
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
          isUnitVisible={isUnitVisibleForHeader}
        />

        {/* UnitPanel - Overlay na parte inferior (dentro do Canvas) */}
        <UnitPanel
          selectedUnit={selectedUnit ?? null}
          activeUnitId={battle.activeUnitId}
          isMyTurn={isMyTurn}
          currentUserId={user.id}
          pendingAbility={pendingAbility}
          hotbar={selectedUnit ? unitHotbars[selectedUnit.id] ?? null : null}
          onSelectAbility={handleSelectAbility}
          onUpdateHotbar={handleUpdateHotbar}
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
        />
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
        pendingAction={pendingAbility?.code ?? null}
        onCancel={() => setPendingAbility(null)}
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
