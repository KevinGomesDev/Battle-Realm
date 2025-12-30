import React, { useState, useEffect, useCallback, useRef } from "react";
import { useArena } from "../hooks/useArena";
import { useAuth } from "../../auth";
import { ArenaBattleCanvas } from "./ArenaBattleCanvas";
import { BattleResultModal } from "./BattleResultModal";
import type { ArenaUnit } from "../types/arena.types";

// Definições de tooltips para CONDIÇÕES
const CONDITIONS_INFO: Record<
  string,
  { icon: string; name: string; description: string }
> = {
  GRAPPLED: {
    icon: "🤼",
    name: "Agarrado",
    description:
      "A unidade não pode se mover ou usar disparada enquanto estiver agarrada.",
  },
  DODGING: {
    icon: "🌀",
    name: "Esquivando",
    description:
      "Postura defensiva. Ataques têm 50% de chance de errar esta unidade.",
  },
  PROTECTED: {
    icon: "🛡️",
    name: "Protegido",
    description: "O próximo dano recebido é reduzido em 5 pontos.",
  },
  STUNNED: {
    icon: "💫",
    name: "Atordoado",
    description: "Movimentação reduzida em 2 células neste turno.",
  },
  FROZEN: {
    icon: "❄️",
    name: "Congelado",
    description: "A unidade não pode realizar nenhuma ação.",
  },
  BURNING: {
    icon: "🔥",
    name: "Queimando",
    description: "Recebe 3 de dano no início de cada turno.",
  },
  SLOWED: {
    icon: "🐌",
    name: "Lentidão",
    description: "Movimentação reduzida pela metade.",
  },
  HELP_NEXT: {
    icon: "🤝",
    name: "Assistência",
    description: "Próximo ataque ou ação recebe bônus de aliado.",
  },
  DERRUBADA: {
    icon: "⬇️",
    name: "Derrubado",
    description: "A unidade está no chão e tem Acuidade reduzida a 0.",
  },
  ELETRIFICADA: {
    icon: "⚡",
    name: "Eletrificado",
    description: "Acuidade é dobrada enquanto durar o efeito.",
  },
  CONGELADA: {
    icon: "🧊",
    name: "Congelado (Acuidade)",
    description: "Acuidade é reduzida ao mínimo (1).",
  },
};

// Componente de Progresso Circular (HP e Proteção)
const CircularProgress: React.FC<{
  current: number;
  max: number;
  color: string;
  bgColor?: string;
  size?: number;
  strokeWidth?: number;
  label: string;
  icon: string;
  tooltip: string;
}> = ({
  current,
  max,
  color,
  bgColor = "#374151",
  size = 72,
  strokeWidth = 6,
  label,
  icon,
  tooltip,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const strokeDashoffset = circumference * (1 - percentage);

  return (
    <div
      className="relative inline-flex flex-col items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {/* Center content - positioned relative to SVG */}
      <div
        className="absolute flex flex-col items-center justify-center"
        style={{
          top: 0,
          left: 0,
          width: size,
          height: size,
        }}
      >
        <span className="text-sm leading-none">{icon}</span>
        <span className="text-parchment-light font-bold text-[11px] leading-tight">
          {current}/{max}
        </span>
      </div>
      {/* Label */}
      <span className="text-parchment-dark text-[10px] mt-1">{label}</span>
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-[200] bottom-full left-1/2 -translate-x-1/2 mb-2 w-36 p-2 bg-citadel-obsidian border border-metal-iron rounded-lg shadow-lg">
          <p className="text-parchment-aged text-xs leading-relaxed text-center">
            {tooltip}
          </p>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-citadel-obsidian border-r border-b border-metal-iron"></div>
        </div>
      )}
    </div>
  );
};

// Componente de Bolinhas de Movimento
const MovementDots: React.FC<{ total: number; remaining: number }> = ({
  total,
  remaining,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex flex-wrap gap-0.5 max-w-[60px] justify-center cursor-help h-5 items-center">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-colors duration-300 ${
              i < remaining
                ? "bg-blue-400 shadow-[0_0_4px_rgba(96,165,250,0.6)]"
                : "bg-gray-600"
            }`}
          />
        ))}
      </div>
      {showTooltip && (
        <div className="absolute z-[200] bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 p-2 bg-citadel-obsidian border border-metal-iron rounded-lg shadow-lg">
          <p className="text-parchment-light font-bold text-xs mb-1">
            🚶 Movimentos
          </p>
          <p className="text-parchment-aged text-[10px] leading-relaxed">
            Cada bolinha azul representa 1 célula de movimento. Mover gasta
            movimentos. Use WASD ou clique no mapa.
          </p>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-citadel-obsidian border-r border-b border-metal-iron"></div>
        </div>
      )}
    </div>
  );
};

// Componente de Quadrados de Ações
const ActionSquares: React.FC<{ total: number; remaining: number }> = ({
  total,
  remaining,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex gap-0.5 justify-center cursor-help h-5 items-center">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-sm transition-colors duration-300 ${
              i < remaining
                ? "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]"
                : "bg-gray-600"
            }`}
          />
        ))}
      </div>
      {showTooltip && (
        <div className="absolute z-[200] bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 p-2 bg-citadel-obsidian border border-metal-iron rounded-lg shadow-lg">
          <p className="text-parchment-light font-bold text-xs mb-1">
            ⚡ Ações
          </p>
          <p className="text-parchment-aged text-[10px] leading-relaxed">
            Cada quadrado verde é 1 ação disponível. Atacar, esquivar, disparar
            e conjurar consomem ações.
          </p>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-citadel-obsidian border-r border-b border-metal-iron"></div>
        </div>
      )}
    </div>
  );
};

// Componente de Marcas (Scars)
const ScarMarks: React.FC<{ current: number; max: number }> = ({
  current,
  max,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex gap-1 justify-center cursor-help h-5 items-center">
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            className={`text-base leading-none transition-all duration-300 ${
              i < current
                ? "text-red-500 drop-shadow-[0_0_3px_rgba(239,68,68,0.8)]"
                : "text-gray-600 opacity-50"
            }`}
          >
            ╳
          </div>
        ))}
      </div>
      {showTooltip && (
        <div className="absolute z-[200] bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-citadel-obsidian border border-metal-iron rounded-lg shadow-lg">
          <p className="text-parchment-light font-bold text-xs mb-1">
            💀 Marcas de Ação
          </p>
          <p className="text-parchment-aged text-[10px] leading-relaxed">
            Recebe 1 marca ao finalizar o turno.
            <br />
            <span className="text-amber-400 font-semibold">
              Com 3 marcas:
            </span>{" "}
            Perde 5 HP e recebe 1 ação extra.
          </p>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-citadel-obsidian border-r border-b border-metal-iron"></div>
        </div>
      )}
    </div>
  );
};

// Componente de Badge de Condição
const ConditionBadge: React.FC<{ condition: string }> = ({ condition }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const info = CONDITIONS_INFO[condition] || {
    icon: "❓",
    name: condition,
    description: "Condição desconhecida.",
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 bg-war-blood/30 border border-war-crimson/50 rounded text-war-ember cursor-help">
        <span>{info.icon}</span>
        <span>{info.name}</span>
      </span>
      {showTooltip && (
        <div className="absolute z-[200] bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-citadel-obsidian border border-metal-iron rounded-lg shadow-lg">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-base">{info.icon}</span>
            <span className="text-parchment-light font-bold text-xs">
              {info.name}
            </span>
          </div>
          <p className="text-parchment-aged text-[10px] leading-relaxed">
            {info.description}
          </p>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-citadel-obsidian border-r border-b border-metal-iron"></div>
        </div>
      )}
    </div>
  );
};

// Definições de ações disponíveis para renderização dinâmica
const ACTIONS_INFO: Record<
  string,
  {
    icon: string;
    name: string;
    description: string;
    color: string;
    requiresTarget?: boolean;
  }
> = {
  attack: {
    icon: "⚔️",
    name: "Atacar",
    description: "Ataca unidade adjacente. Clique para selecionar alvo.",
    color: "red",
    requiresTarget: true,
  },
  dash: {
    icon: "💨",
    name: "Disparada",
    description: "Gasta 1 ação. Adiciona movimentos extras igual à Acuidade.",
    color: "amber",
  },
  dodge: {
    icon: "🌀",
    name: "Esquiva",
    description:
      "Gasta 1 ação. Ataques têm 50% de chance de errar até o próximo turno.",
    color: "cyan",
  },
  protect: {
    icon: "🛡️",
    name: "Proteger",
    description: "Gasta 1 ação. Reduz o próximo dano recebido em 5.",
    color: "emerald",
  },
  cast: {
    icon: "✨",
    name: "Conjurar",
    description: "Gasta 1 ação. Usa uma magia ou habilidade especial.",
    color: "purple",
  },
  help: {
    icon: "🤝",
    name: "Ajudar",
    description:
      "Gasta 1 ação. Dá vantagem ao próximo ataque de aliado adjacente.",
    color: "sky",
  },
  knockdown: {
    icon: "⬇️",
    name: "Derrubar",
    description: "Gasta 1 ação. Tenta derrubar o inimigo adjacente.",
    color: "orange",
    requiresTarget: true,
  },
  grab: {
    icon: "🤼",
    name: "Agarrar",
    description: "Gasta 1 ação. Agarra unidade adjacente, impedindo movimento.",
    color: "rose",
    requiresTarget: true,
  },
  throw: {
    icon: "🎯",
    name: "Arremessar",
    description: "Gasta 1 ação. Arremessa objeto ou unidade agarrada.",
    color: "indigo",
    requiresTarget: true,
  },
  flee: {
    icon: "🏃",
    name: "Fugir",
    description: "Gasta 1 ação. Tenta escapar do combate.",
    color: "gray",
  },
  disarm: {
    icon: "✋",
    name: "Desarmar",
    description: "Gasta 1 ação. Tenta desarmar o inimigo.",
    color: "yellow",
    requiresTarget: true,
  },
};

// Definições de tooltips para atributos
const ATTRIBUTE_TOOLTIPS: Record<
  string,
  { icon: string; name: string; description: string }
> = {
  combat: {
    icon: "⚔️",
    name: "Combate",
    description:
      "Determina o poder de ataque físico. Cada ponto adiciona 1d6 ao dano.",
  },
  acuity: {
    icon: "👁️",
    name: "Acuidade",
    description:
      "Determina a movimentação e percepção. Define quantas células pode mover por turno.",
  },
  focus: {
    icon: "🎯",
    name: "Foco",
    description:
      "Poder mágico e precisão. Usado para ataques mágicos e habilidades especiais.",
  },
  armor: {
    icon: "🛡️",
    name: "Armadura",
    description:
      "Proteção física. Proteção = Armadura × 2. Absorve dano antes do HP.",
  },
  vitality: {
    icon: "❤️",
    name: "Vitalidade",
    description: "Resistência vital. HP Máximo = Vitalidade × 2.",
  },
  damageReduction: {
    icon: "🔰",
    name: "Redução de Dano",
    description:
      "Reduz o dano recebido por um valor fixo. Aplicado após a proteção.",
  },
};

// Componente de Tooltip para atributos (hover-based)
const AttributeTooltip: React.FC<{
  attribute: string;
  value: number;
}> = ({ attribute, value }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const info = ATTRIBUTE_TOOLTIPS[attribute];
  if (!info) return null;

  return (
    <div
      className="relative group"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="bg-citadel-slate/50 rounded p-1.5 text-center w-full hover:bg-citadel-slate/70 transition-colors cursor-help">
        <span className="text-parchment-dark block text-xs">{info.icon}</span>
        <p className="text-parchment-light font-bold text-sm">{value}</p>
      </div>
      {showTooltip && (
        <div className="absolute z-[200] bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-citadel-obsidian border border-metal-iron rounded-lg shadow-lg">
          <div className="flex items-center gap-1 mb-1">
            <span>{info.icon}</span>
            <span className="text-parchment-light font-bold text-xs">
              {info.name}
            </span>
          </div>
          <p className="text-parchment-aged text-xs leading-relaxed">
            {info.description}
          </p>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-citadel-obsidian border-r border-b border-metal-iron"></div>
        </div>
      )}
    </div>
  );
};

/**
 * ArenaBattleView - Tela completa de batalha da Arena
 * Inclui o grid canvas, painel de unidade, controles e logs
 */
export const ArenaBattleView: React.FC = () => {
  const { user } = useAuth();
  const {
    state: {
      battle,
      battleResult,
      units,
      logs,
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
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null); // Ação aguardando alvo
  const [turnTimer, setTurnTimer] = useState<number>(30); // Timer de 30 segundos
  const logTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoEndTriggeredRef = useRef<boolean>(false); // Evita múltiplos auto-ends

  // Auto-fechar log após 5 segundos sem interação
  const handleLogInteraction = useCallback(() => {
    if (logTimeoutRef.current) {
      clearTimeout(logTimeoutRef.current);
    }
    setIsLogOpen(true);
    logTimeoutRef.current = setTimeout(() => {
      setIsLogOpen(false);
    }, 5000);
  }, []);

  // Limpar timeout ao desmontar
  useEffect(() => {
    return () => {
      if (logTimeoutRef.current) {
        clearTimeout(logTimeoutRef.current);
      }
    };
  }, []);

  // Auto-selecionar a unidade do turno atual quando muda de turno ou monta
  useEffect(() => {
    if (!battle || !user) return;

    const isMyTurnNow = battle.currentPlayerId === user.id;
    if (isMyTurnNow) {
      // Encontrar minha unidade viva do turno atual
      const myAliveUnit = units.find((u) => u.ownerId === user.id && u.isAlive);
      if (myAliveUnit) {
        // SEMPRE selecionar minha unidade quando é meu turno
        setSelectedUnitId(myAliveUnit.id);
        // Se a unidade ainda não iniciou ação, iniciar
        if (!myAliveUnit.hasStartedAction && myAliveUnit.movesLeft === 0) {
          beginAction(myAliveUnit.id);
        }
      }
    }
  }, [battle?.currentPlayerId, battle?.round, user?.id, units, beginAction]);

  // Timer de 30 segundos para auto-skip turn
  useEffect(() => {
    if (!battle || !user) return;

    const isMyTurnNow = battle.currentPlayerId === user.id;

    // Resetar timer quando muda de turno
    setTurnTimer(30);
    autoEndTriggeredRef.current = false;

    if (!isMyTurnNow) {
      // Não é meu turno, limpar timer
      if (turnTimerRef.current) {
        clearInterval(turnTimerRef.current);
        turnTimerRef.current = null;
      }
      return;
    }

    // Iniciar timer de 30 segundos
    turnTimerRef.current = setInterval(() => {
      setTurnTimer((prev) => {
        if (prev <= 1) {
          // Tempo acabou - auto-skip
          if (!autoEndTriggeredRef.current) {
            autoEndTriggeredRef.current = true;
            const myUnit = units.find(
              (u) => u.ownerId === user.id && u.isAlive
            );
            if (myUnit) {
              console.log(
                "%c[ArenaBattleView] ⏰ TEMPO ESGOTADO - Auto-skip turn",
                "color: #f59e0b; font-weight: bold;"
              );
              endAction(myUnit.id);
            }
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (turnTimerRef.current) {
        clearInterval(turnTimerRef.current);
        turnTimerRef.current = null;
      }
    };
  }, [battle?.currentPlayerId, battle?.round, user?.id, units, endAction]);

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
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-parchment-dark">Carregando batalha...</p>
      </div>
    );
  }

  const isMyTurn = battle.currentPlayerId === user.id;
  const selectedUnit = units.find((u) => u.id === selectedUnitId);
  const myUnits = units.filter((u) => u.ownerId === user.id && u.isAlive);
  const enemyUnits = units.filter((u) => u.ownerId !== user.id && u.isAlive);

  // Unidade do turno atual
  const currentTurnUnit = units.find(
    (u) => u.ownerId === battle.currentPlayerId && u.isAlive
  );

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

      let newX = selectedUnit.posX;
      let newY = selectedUnit.posY;

      switch (direction) {
        case "up":
          newY = Math.max(0, selectedUnit.posY - 1);
          break;
        case "down":
          newY = Math.min(19, selectedUnit.posY + 1);
          break;
        case "left":
          newX = Math.max(0, selectedUnit.posX - 1);
          break;
        case "right":
          newX = Math.min(19, selectedUnit.posX + 1);
          break;
      }

      // Verificar se a célula está ocupada
      const occupied = units.some(
        (u) => u.posX === newX && u.posY === newY && u.isAlive
      );

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
        moveUnit(selectedUnit.id, newX, newY);
      }
    },
    [selectedUnit, isMyTurn, user.id, units, moveUnit]
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

      if (dx <= 1 && dy <= 1 && dx + dy <= 1) {
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

    if (!selectedUnit || !isMyTurn) {
      console.log(
        "%c[ArenaBattleView] ⚠️ Movimento inválido - sem unidade ou não é meu turno",
        "color: #f59e0b;"
      );
      return;
    }

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
      "%c[ArenaBattleView] 🏳️ Tentando se render...",
      "color: #ef4444; font-weight: bold;"
    );
    if (confirm("Tem certeza que deseja se render? Você perderá a batalha.")) {
      console.log(
        "%c[ArenaBattleView] ✅ Confirmado - rendendo!",
        "color: #ef4444; font-size: 14px;"
      );
      surrender();
    } else {
      console.log(
        "%c[ArenaBattleView] ❌ Rendição cancelada",
        "color: #f59e0b;"
      );
    }
  };

  return (
    <div className="h-screen w-screen bg-citadel-obsidian flex flex-col overflow-hidden">
      {/* Header da Batalha - Fixo no topo */}
      <div className="flex-shrink-0 flex items-center justify-between bg-citadel-slate/50 border-b border-metal-iron px-4 py-2">
        {/* Meu Reino */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-b from-blue-600 to-blue-800 rounded-lg border-2 border-metal-iron flex items-center justify-center">
            <span className="text-xl">👑</span>
          </div>
          <div>
            <p
              className="text-parchment-light font-bold text-sm"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              {myKingdom.name}
            </p>
            <p className="text-green-400 text-xs">
              {myUnits.length} unidade{myUnits.length !== 1 ? "s" : ""} viva
              {myUnits.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Centro - Round e Turno */}
        <div className="text-center flex items-center gap-4">
          {/* Round */}
          <div className="bg-citadel-obsidian/60 px-3 py-1 rounded border border-metal-iron">
            <span className="text-parchment-aged text-xs">Round</span>
            <span className="text-parchment-light font-bold text-lg ml-2">
              {battle.round}
            </span>
          </div>

          {/* Timer - Só quando é meu turno */}
          {isMyTurn && (
            <div
              className={`px-3 py-1 rounded border ${
                turnTimer <= 10
                  ? "bg-red-900/60 border-red-500 animate-pulse"
                  : turnTimer <= 20
                  ? "bg-amber-900/60 border-amber-500"
                  : "bg-citadel-obsidian/60 border-metal-iron"
              }`}
            >
              <span className="text-parchment-aged text-xs">⏰</span>
              <span
                className={`font-bold text-lg ml-2 ${
                  turnTimer <= 10
                    ? "text-red-400"
                    : turnTimer <= 20
                    ? "text-amber-400"
                    : "text-parchment-light"
                }`}
              >
                {turnTimer}s
              </span>
            </div>
          )}

          {/* Separador */}
          <p className="text-2xl font-bold text-war-crimson">⚔️</p>

          {/* Unidade do Turno */}
          <div className="flex flex-col items-center">
            <span className="text-parchment-dark text-xs">Turno de</span>
            <span
              className={`font-bold text-sm ${
                isMyTurn ? "text-green-400" : "text-red-400"
              }`}
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              {currentTurnUnit?.name || "???"}
            </span>
          </div>
        </div>

        {/* Reino Oponente */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p
              className="text-parchment-light font-bold text-sm"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              {opponentKingdom.name}
            </p>
            <p className="text-war-ember text-xs">
              {enemyUnits.length} unidade{enemyUnits.length !== 1 ? "s" : ""}{" "}
              viva{enemyUnits.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="w-10 h-10 bg-gradient-to-b from-red-600 to-red-800 rounded-lg border-2 border-metal-iron flex items-center justify-center">
            <span className="text-xl">⚔️</span>
          </div>
        </div>
      </div>

      {/* Área Principal - Flex grow para preencher */}
      <div className="flex-1 flex min-h-0">
        {/* Canvas do Grid - Área principal */}
        <div className="flex-1 p-2 min-w-0">
          <div className="w-full h-full bg-citadel-granite rounded-xl border-4 border-metal-iron shadow-stone-raised">
            <ArenaBattleCanvas
              battle={battle}
              units={units}
              currentUserId={user.id}
              selectedUnitId={selectedUnitId}
              onUnitClick={handleUnitClick}
              onCellClick={handleCellClick}
            />
          </div>
        </div>

        {/* Sidebar - Fixa à direita */}
        <div className="w-80 xl:w-96 flex-shrink-0 p-2 flex flex-col gap-2 overflow-y-auto">
          {/* Painel da Unidade Selecionada */}
          {selectedUnit ? (
            <div className="bg-citadel-granite rounded-xl border-2 border-metal-iron p-3 shadow-stone-raised flex-shrink-0">
              {/* Header com nome */}
              <h3
                className="text-parchment-light font-bold text-base mb-3 border-b border-metal-rust/30 pb-2 truncate text-center"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {selectedUnit.name}
              </h3>

              {/* HP e Proteção - Círculos lado a lado */}
              <div className="flex justify-center gap-4 mb-3">
                <CircularProgress
                  current={selectedUnit.currentHp}
                  max={selectedUnit.maxHp}
                  color={
                    selectedUnit.currentHp / selectedUnit.maxHp > 0.6
                      ? "#4ade80"
                      : selectedUnit.currentHp / selectedUnit.maxHp > 0.3
                      ? "#fbbf24"
                      : "#ef4444"
                  }
                  label="HP"
                  icon="❤️"
                  tooltip="Pontos de Vida. Quando chegar a 0, a unidade morre. HP Máximo = Vitalidade × 2."
                />
                <CircularProgress
                  current={selectedUnit.protection}
                  max={selectedUnit.armor * 2}
                  color={selectedUnit.protectionBroken ? "#6b7280" : "#60a5fa"}
                  label="Proteção"
                  icon="🛡️"
                  tooltip="Escudo que absorve dano antes do HP. Proteção = Armadura × 2. Se quebrar, não regenera na batalha."
                />
              </div>

              {/* Atributos - Grid com tooltips hover */}
              <div className="grid grid-cols-5 gap-1 mb-3">
                <AttributeTooltip
                  attribute="combat"
                  value={selectedUnit.combat}
                />
                <AttributeTooltip
                  attribute="acuity"
                  value={selectedUnit.acuity}
                />
                <AttributeTooltip
                  attribute="focus"
                  value={selectedUnit.focus}
                />
                <AttributeTooltip
                  attribute="armor"
                  value={selectedUnit.armor}
                />
                <AttributeTooltip
                  attribute="vitality"
                  value={selectedUnit.vitality}
                />
              </div>

              {/* Ações, Movimentos e Marcas - Visual Reformulado */}
              <div className="border-t border-metal-iron/30 pt-3 mb-3">
                <div className="grid grid-cols-3 gap-2">
                  {/* Ações - Quadrados Verdes (1º) */}
                  <div className="flex flex-col items-center">
                    <ActionSquares
                      total={1}
                      remaining={selectedUnit.actionsLeft}
                    />
                    <span className="text-parchment-dark text-[10px] mt-1">
                      Ações
                    </span>
                  </div>
                  {/* Movimentos - Bolinhas Azuis (2º) */}
                  <div className="flex flex-col items-center">
                    <MovementDots
                      total={Math.max(
                        selectedUnit.movesLeft,
                        selectedUnit.acuity
                      )}
                      remaining={selectedUnit.movesLeft}
                    />
                    <span className="text-parchment-dark text-[10px] mt-1">
                      Movimentos
                    </span>
                  </div>
                  {/* Marcas - Scars Vermelhas (3º) */}
                  <div className="flex flex-col items-center">
                    <ScarMarks current={selectedUnit.actionMarks} max={3} />
                    <span className="text-parchment-dark text-[10px] mt-1">
                      Marcas
                    </span>
                  </div>
                </div>
              </div>

              {/* Condições - Bloco dedicado com tooltips */}
              {selectedUnit.conditions.length > 0 && (
                <div className="border-t border-metal-iron/30 pt-3 mb-3">
                  <h4 className="text-parchment-dark text-xs mb-2 font-semibold flex items-center gap-1">
                    <span>⚠️</span> Condições Ativas
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedUnit.conditions.map((cond, i) => (
                      <ConditionBadge key={i} condition={cond} />
                    ))}
                  </div>
                </div>
              )}

              {/* Lista de Ações Disponíveis - Blocos Compactos */}
              {isMyTurn && selectedUnit.ownerId === user.id && (
                <div className="border-t border-metal-iron/30 pt-3">
                  <h4 className="text-parchment-dark text-xs mb-2 font-semibold flex items-center gap-1">
                    <span>⚡</span> Ações
                    {pendingAction && (
                      <span className="ml-auto text-amber-400 text-[10px] animate-pulse">
                        Selecione um alvo...
                      </span>
                    )}
                  </h4>

                  {/* Grid de Ações Dinâmico baseado em selectedUnit.actions */}
                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {selectedUnit.actions
                      ?.filter((actionKey) => actionKey !== "move") // Move não é listado como ação
                      .map((actionKey) => {
                        const actionInfo = ACTIONS_INFO[actionKey];
                        if (!actionInfo) return null; // Ação desconhecida

                        const isTargetAction = actionInfo.requiresTarget;
                        const isActive = pendingAction === actionKey;
                        const colorClasses: Record<
                          string,
                          { active: string; normal: string }
                        > = {
                          red: {
                            active:
                              "bg-red-700/60 border-red-400 ring-2 ring-red-400/50",
                            normal:
                              "bg-red-900/40 border-red-500/50 hover:bg-red-800/60",
                          },
                          amber: {
                            active:
                              "bg-amber-700/60 border-amber-400 ring-2 ring-amber-400/50",
                            normal:
                              "bg-amber-900/40 border-amber-500/50 hover:bg-amber-800/60",
                          },
                          cyan: {
                            active:
                              "bg-cyan-700/60 border-cyan-400 ring-2 ring-cyan-400/50",
                            normal:
                              "bg-cyan-900/40 border-cyan-500/50 hover:bg-cyan-800/60",
                          },
                          emerald: {
                            active:
                              "bg-emerald-700/60 border-emerald-400 ring-2 ring-emerald-400/50",
                            normal:
                              "bg-emerald-900/40 border-emerald-500/50 hover:bg-emerald-800/60",
                          },
                          purple: {
                            active:
                              "bg-purple-700/60 border-purple-400 ring-2 ring-purple-400/50",
                            normal:
                              "bg-purple-900/40 border-purple-500/50 hover:bg-purple-800/60",
                          },
                          sky: {
                            active:
                              "bg-sky-700/60 border-sky-400 ring-2 ring-sky-400/50",
                            normal:
                              "bg-sky-900/40 border-sky-500/50 hover:bg-sky-800/60",
                          },
                          orange: {
                            active:
                              "bg-orange-700/60 border-orange-400 ring-2 ring-orange-400/50",
                            normal:
                              "bg-orange-900/40 border-orange-500/50 hover:bg-orange-800/60",
                          },
                          rose: {
                            active:
                              "bg-rose-700/60 border-rose-400 ring-2 ring-rose-400/50",
                            normal:
                              "bg-rose-900/40 border-rose-500/50 hover:bg-rose-800/60",
                          },
                          indigo: {
                            active:
                              "bg-indigo-700/60 border-indigo-400 ring-2 ring-indigo-400/50",
                            normal:
                              "bg-indigo-900/40 border-indigo-500/50 hover:bg-indigo-800/60",
                          },
                          gray: {
                            active:
                              "bg-gray-600/60 border-gray-400 ring-2 ring-gray-400/50",
                            normal:
                              "bg-gray-800/40 border-gray-600/50 hover:bg-gray-700/60",
                          },
                          yellow: {
                            active:
                              "bg-yellow-700/60 border-yellow-400 ring-2 ring-yellow-400/50",
                            normal:
                              "bg-yellow-900/40 border-yellow-500/50 hover:bg-yellow-800/60",
                          },
                        };
                        const color =
                          colorClasses[actionInfo.color] || colorClasses.gray;

                        return (
                          <div key={actionKey} className="relative group">
                            <button
                              onClick={() => {
                                if (selectedUnit.actionsLeft <= 0) return;
                                if (isTargetAction) {
                                  // Ação que requer alvo: ativar modo de seleção
                                  setPendingAction(isActive ? null : actionKey);
                                } else {
                                  // Ação imediata
                                  executeAction(actionKey, selectedUnit.id);
                                }
                              }}
                              disabled={selectedUnit.actionsLeft <= 0}
                              className={`w-full p-1.5 rounded-lg border-2 text-center transition-all ${
                                isActive
                                  ? color.active
                                  : selectedUnit.actionsLeft > 0
                                  ? `${color.normal} cursor-pointer`
                                  : "bg-gray-800/40 border-gray-600/30 opacity-50 cursor-not-allowed"
                              }`}
                            >
                              <span className="text-lg block">
                                {actionInfo.icon}
                              </span>
                              <span className="text-parchment-light text-[10px] font-semibold block">
                                {actionInfo.name}
                              </span>
                            </button>
                            <div className="absolute z-[200] bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 p-2 bg-citadel-obsidian border border-metal-iron rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              <p className="text-parchment-light font-bold text-[10px] mb-0.5">
                                {actionInfo.icon} {actionInfo.name}
                              </p>
                              <p className="text-parchment-aged text-[9px]">
                                {actionInfo.description}
                              </p>
                              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-1.5 h-1.5 bg-citadel-obsidian border-r border-b border-metal-iron"></div>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Cancelar ação pendente */}
                  {pendingAction && (
                    <button
                      onClick={() => setPendingAction(null)}
                      className="w-full mb-2 py-1.5 bg-gray-700/50 border border-gray-600 rounded text-parchment-dark text-xs hover:bg-gray-600/50 transition-colors"
                    >
                      ✕ Cancelar{" "}
                      {pendingAction === "attack" ? "Ataque" : pendingAction}
                    </button>
                  )}

                  {/* Finalizar Turno - Botão */}
                  <button
                    onClick={handleEndAction}
                    className="w-full py-2 bg-gradient-to-b from-amber-600 to-amber-800 border-2 border-amber-500 rounded-lg text-parchment-light text-sm font-bold hover:from-amber-500 hover:to-amber-700 transition-all flex items-center justify-center gap-2"
                  >
                    <span>⏭️</span>
                    <span>Finalizar Turno</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-citadel-granite rounded-xl border-2 border-metal-iron p-3 shadow-stone-raised flex-shrink-0">
              <p className="text-parchment-dark text-center text-xs">
                Selecione uma unidade para ver detalhes
              </p>
            </div>
          )}

          {/* Logs de Batalha - Retrátil */}
          <div
            className="bg-citadel-granite rounded-xl border-2 border-metal-iron shadow-stone-raised flex-shrink-0 overflow-hidden transition-all duration-300"
            onMouseEnter={handleLogInteraction}
            onMouseMove={handleLogInteraction}
          >
            {/* Header do Log - Sempre visível */}
            <button
              onClick={() => {
                setIsLogOpen(!isLogOpen);
                if (!isLogOpen) handleLogInteraction();
              }}
              className="w-full flex items-center justify-between p-3 hover:bg-citadel-slate/30 transition-colors"
            >
              <h3 className="text-parchment-light font-bold text-xs flex items-center gap-2">
                📜 Log de Batalha
                {logs.length > 0 && (
                  <span className="bg-metal-iron/50 text-parchment-dark px-1.5 py-0.5 rounded text-[10px]">
                    {logs.length}
                  </span>
                )}
              </h3>
              <span
                className={`text-parchment-dark text-xs transition-transform duration-300 ${
                  isLogOpen ? "rotate-180" : ""
                }`}
              >
                ▼
              </span>
            </button>

            {/* Conteúdo do Log - Expansível */}
            <div
              className={`transition-all duration-300 ease-in-out ${
                isLogOpen ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="px-3 pb-3 overflow-y-auto max-h-40 space-y-1">
                {logs.length === 0 ? (
                  <p className="text-parchment-dark text-xs">
                    Aguardando ações...
                  </p>
                ) : (
                  logs
                    .slice(-15)
                    .reverse()
                    .map((log) => (
                      <p
                        key={log.id}
                        className="text-parchment-aged text-xs border-b border-metal-iron/20 pb-1"
                      >
                        {log.message}
                      </p>
                    ))
                )}
              </div>
            </div>
          </div>

          {/* Botão de Rendição */}
          <button
            onClick={handleSurrender}
            className="flex-shrink-0 w-full py-2 bg-gradient-to-b from-war-crimson to-war-blood border-2 border-war-ember rounded-lg text-parchment-light text-sm font-bold hover:from-war-ember hover:to-war-crimson transition-all"
          >
            🏳️ Render-se
          </button>
        </div>
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
