// client/src/features/qte/components/CombatTraining.tsx
// Componente de treinamento de combate - QTE mockado com parâmetros aleatórios
// USA A MESMA LÓGICA DO BACKEND (qte-calculator.ts + qte-config.ts)

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { motion, AnimatePresence } from "framer-motion";
import { QTEOverlay } from "./QTEOverlay";
import type { QTEConfig, QTEInput } from "@boundless/shared/qte";
import { QTE_DEFAULT_CONFIG } from "@boundless/shared/qte";

// =============================================================================
// ATRIBUTOS SIMULADOS (para exibição no painel)
// =============================================================================

export interface SimulatedAttributes {
  attacker: {
    name: string;
    combat: number;
    speed: number;
    focus: number;
  };
  defender: {
    name: string;
    resistance: number;
    speed: number;
    focus: number;
    will: number;
  };
}

// =============================================================================
// FUNÇÕES DE CÁLCULO (IDÊNTICAS AO BACKEND - qte-calculator.ts)
// =============================================================================

/**
 * Calcula a duração do QTE baseado no duelo de Speed
 * Atacante mais rápido = QTE mais rápido para o defensor
 * Defensor mais rápido = QTE mais lento (mais tempo para reagir)
 */
function calculateQTEDuration(
  attackerSpeed: number,
  defenderSpeed: number
): number {
  const speedDelta = attackerSpeed - defenderSpeed;
  const duration =
    QTE_DEFAULT_CONFIG.baseDuration -
    speedDelta * QTE_DEFAULT_CONFIG.speedDurationMod;
  return Math.max(100, Math.round(duration));
}

/**
 * Calcula a intensidade do shake baseado no duelo de poder
 * Físico: Combat vs Resistance
 */
function calculateShakeIntensity(
  attackerCombat: number,
  defenderResistance: number
): number {
  const powerDelta = attackerCombat - defenderResistance;
  if (powerDelta <= 0) return 0;
  const intensity =
    QTE_DEFAULT_CONFIG.baseShakeIntensity +
    powerDelta * QTE_DEFAULT_CONFIG.combatShakeMod;
  return Math.min(100, Math.round(intensity));
}

/**
 * Calcula o tamanho da zona de acerto para DEFESA (esquiva)
 * Defensor: Focus aumenta zona (lê melhor o ataque)
 * Atacante: Focus diminui zona (esconde intenção)
 */
function calculateDefenseHitZoneSize(
  defenderFocus: number,
  attackerFocus: number
): number {
  const focusDelta = defenderFocus - attackerFocus;
  const hitZone =
    QTE_DEFAULT_CONFIG.baseHitZone +
    focusDelta * QTE_DEFAULT_CONFIG.focusZoneMod;
  return Math.max(1, Math.round(hitZone));
}

/**
 * Calcula o tamanho da zona de acerto para BLOQUEIO
 * Defensor: Resistance aumenta zona
 * Atacante: Combat diminui zona
 */
function calculateBlockHitZoneSize(
  defenderResistance: number,
  attackerCombat: number
): number {
  const statDelta = defenderResistance - attackerCombat;
  const hitZone =
    QTE_DEFAULT_CONFIG.baseHitZone +
    statDelta * QTE_DEFAULT_CONFIG.focusZoneMod;
  return Math.max(1, Math.round(hitZone));
}

/**
 * Calcula zona perfeita como porcentagem da zona de acerto
 */
function calculatePerfectZoneSize(hitZoneSize: number): number {
  return Math.max(
    1,
    Math.round(hitZoneSize * QTE_DEFAULT_CONFIG.perfectZoneRatio)
  );
}

// =============================================================================
// NOMES ALEATÓRIOS PARA IMERSÃO
// =============================================================================

const ATTACKER_NAMES = [
  "Orc Brutal",
  "Goblin Ardiloso",
  "Esqueleto Guerreiro",
  "Bandido Mascarado",
  "Lobo Alfa",
  "Troll da Montanha",
  "Assassino das Sombras",
  "Cavaleiro Negro",
  "Dragão Jovem",
  "Elemental de Fogo",
];

const DEFENDER_NAMES = [
  "Guerreiro",
  "Paladino",
  "Bárbaro",
  "Ranger",
  "Monge",
  "Cavaleiro",
  "Mercenário",
  "Campeão",
  "Gladiador",
  "Herói",
];

function getRandomName(names: string[]): string {
  return names[Math.floor(Math.random() * names.length)];
}

// =============================================================================
// SISTEMA DE DIFICULDADE
// =============================================================================

export type DifficultyLevel = "easy" | "medium" | "hard" | "nightmare";

interface DifficultyConfig {
  label: string;
  emoji: string;
  attackerBonus: number; // Bonus nos atributos do atacante
  defenderPenalty: number; // Penalidade nos atributos do defensor
  color: string;
}

const DIFFICULTY_CONFIGS: Record<DifficultyLevel, DifficultyConfig> = {
  easy: {
    label: "Fácil",
    emoji: "🟢",
    attackerBonus: -5,
    defenderPenalty: 0,
    color: "bg-green-600 hover:bg-green-700",
  },
  medium: {
    label: "Médio",
    emoji: "🟡",
    attackerBonus: 0,
    defenderPenalty: 0,
    color: "bg-yellow-600 hover:bg-yellow-700",
  },
  hard: {
    label: "Difícil",
    emoji: "🟠",
    attackerBonus: 5,
    defenderPenalty: 3,
    color: "bg-orange-600 hover:bg-orange-700",
  },
  nightmare: {
    label: "Pesadelo",
    emoji: "🔴",
    attackerBonus: 10,
    defenderPenalty: 5,
    color: "bg-red-600 hover:bg-red-700",
  },
};

// =============================================================================
// GERADOR DE ATRIBUTOS ALEATÓRIOS
// =============================================================================

function generateRandomAttributes(
  difficulty: DifficultyLevel
): SimulatedAttributes {
  const config = DIFFICULTY_CONFIGS[difficulty];

  const baseAttacker = {
    combat: Math.floor(Math.random() * 10) + 5,
    speed: Math.floor(Math.random() * 10) + 5,
    focus: Math.floor(Math.random() * 10) + 5,
  };

  const baseDefender = {
    resistance: Math.floor(Math.random() * 10) + 5,
    speed: Math.floor(Math.random() * 10) + 5,
    focus: Math.floor(Math.random() * 10) + 5,
    will: Math.floor(Math.random() * 10) + 5,
  };

  return {
    attacker: {
      name: getRandomName(ATTACKER_NAMES),
      combat: Math.max(1, baseAttacker.combat + config.attackerBonus),
      speed: Math.max(1, baseAttacker.speed + config.attackerBonus),
      focus: Math.max(1, baseAttacker.focus + config.attackerBonus),
    },
    defender: {
      name: getRandomName(DEFENDER_NAMES),
      resistance: Math.max(1, baseDefender.resistance - config.defenderPenalty),
      speed: Math.max(1, baseDefender.speed - config.defenderPenalty),
      focus: Math.max(1, baseDefender.focus - config.defenderPenalty),
      will: Math.max(1, baseDefender.will - config.defenderPenalty),
    },
  };
}

// =============================================================================
// GERADOR DE QTE CONFIG (USA AS FÓRMULAS DO BACKEND)
// =============================================================================

export interface QTEGenerationResult {
  config: QTEConfig;
  attributes: SimulatedAttributes;
  calculations: {
    duration: { formula: string; value: number };
    shakeIntensity: { formula: string; value: number };
    hitZoneSize: { formula: string; value: number };
    perfectZoneSize: { formula: string; value: number };
    blockHitZoneSize: { formula: string; value: number };
    blockPerfectZoneSize: { formula: string; value: number };
  };
}

export function generateRandomQTEConfig(
  difficulty: DifficultyLevel = "medium"
): QTEGenerationResult {
  const attributes = generateRandomAttributes(difficulty);
  const { attacker, defender } = attributes;

  const actionTypes: Array<"ATTACK" | "DODGE" | "BLOCK"> = [
    "ATTACK",
    "DODGE",
    "BLOCK",
  ];
  const actionType =
    actionTypes[Math.floor(Math.random() * actionTypes.length)];

  const directions: Array<"UP" | "DOWN" | "LEFT" | "RIGHT"> = [
    "UP",
    "DOWN",
    "LEFT",
    "RIGHT",
  ];
  const attackDirection =
    directions[Math.floor(Math.random() * directions.length)];

  // Calcular usando as fórmulas do backend
  const duration = calculateQTEDuration(attacker.speed, defender.speed);
  const shakeIntensity = calculateShakeIntensity(
    attacker.combat,
    defender.resistance
  );
  const hitZoneSize = calculateDefenseHitZoneSize(
    defender.focus,
    attacker.focus
  );
  const perfectZoneSize = calculatePerfectZoneSize(hitZoneSize);
  const blockHitZoneSize = calculateBlockHitZoneSize(
    defender.resistance,
    attacker.combat
  );
  const blockPerfectZoneSize = calculatePerfectZoneSize(blockHitZoneSize);

  const now = Date.now();
  const validInputs: Array<"E" | "W" | "A" | "S" | "D"> =
    actionType === "ATTACK" ? ["E"] : ["E", "W", "A", "S", "D"];

  const invalidInputs: Array<"W" | "A" | "S" | "D"> | undefined =
    actionType !== "ATTACK" && attackDirection
      ? [
          attackDirection === "UP"
            ? "W"
            : attackDirection === "DOWN"
            ? "S"
            : attackDirection === "LEFT"
            ? "A"
            : "D",
        ]
      : undefined;

  const config: QTEConfig = {
    qteId: `training-qte-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`,
    actionType,
    battleId: "training-battle",
    responderId: "training-defender",
    responderOwnerId: "training-user",
    attackerId: "training-attacker",
    targetId: "training-defender",
    attackDirection: actionType !== "ATTACK" ? attackDirection : undefined,
    duration,
    shakeIntensity,
    hitZoneSize,
    perfectZoneSize,
    blockHitZoneSize,
    blockPerfectZoneSize,
    startPosition: 0,
    validInputs,
    invalidInputs,
    targetPosition: { x: 5, y: 5 },
    blockedCells: [
      { x: 4, y: 5 },
      { x: 6, y: 5 },
    ],
    createdAt: now,
    serverStartTime: now + 100,
    serverEndTime: now + 100 + duration,
    expiresAt: now + 100 + duration,
  };

  const calculations = {
    duration: {
      formula: `${QTE_DEFAULT_CONFIG.baseDuration} - (${attacker.speed} - ${defender.speed}) × ${QTE_DEFAULT_CONFIG.speedDurationMod}`,
      value: duration,
    },
    shakeIntensity: {
      formula: `${QTE_DEFAULT_CONFIG.baseShakeIntensity} + (${attacker.combat} - ${defender.resistance}) × ${QTE_DEFAULT_CONFIG.combatShakeMod}`,
      value: shakeIntensity,
    },
    hitZoneSize: {
      formula: `${QTE_DEFAULT_CONFIG.baseHitZone} + (${defender.focus} - ${attacker.focus}) × ${QTE_DEFAULT_CONFIG.focusZoneMod}`,
      value: hitZoneSize,
    },
    perfectZoneSize: {
      formula: `${hitZoneSize} × ${QTE_DEFAULT_CONFIG.perfectZoneRatio}`,
      value: perfectZoneSize,
    },
    blockHitZoneSize: {
      formula: `${QTE_DEFAULT_CONFIG.baseHitZone} + (${defender.resistance} - ${attacker.combat}) × ${QTE_DEFAULT_CONFIG.focusZoneMod}`,
      value: blockHitZoneSize,
    },
    blockPerfectZoneSize: {
      formula: `${blockHitZoneSize} × ${QTE_DEFAULT_CONFIG.perfectZoneRatio}`,
      value: blockPerfectZoneSize,
    },
  };

  return { config, attributes, calculations };
}

// =============================================================================
// PROPS
// =============================================================================

interface CombatTrainingProps {
  isOpen: boolean;
  onClose: () => void;
}

// =============================================================================
// ESTADO DO QTE
// =============================================================================

type QTEState = "idle" | "running" | "finished";

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

export const CombatTraining: React.FC<CombatTrainingProps> = ({
  isOpen,
  onClose,
}) => {
  // Configurações persistentes
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("medium");
  const [autoLoop, setAutoLoop] = useState(false);

  // Estado do QTE atual
  const [qteData, setQteData] = useState<QTEGenerationResult | null>(null);
  const [qteState, setQteState] = useState<QTEState>("idle");
  const [qteKey, setQteKey] = useState(0); // Para forçar remontagem apenas do QTEOverlay

  // Estatísticas
  const [stats, setStats] = useState({ perfect: 0, hit: 0, fail: 0 });

  // Tooltips flutuantes em cascata (array para múltiplos resultados)
  const [floatingResults, setFloatingResults] = useState<
    Array<{ id: number; result: "PERFECT" | "HIT" | "FAIL" }>
  >([]);
  const floatingIdRef = useRef(0);

  // NÃO inicializar automaticamente - esperar usuário clicar em "Novo Teste"
  // useEffect removido - o usuário deve dar "play" manualmente

  // Resetar quando fechar
  useEffect(() => {
    if (!isOpen) {
      setQteData(null);
      setQteState("idle");
      setStats({ perfect: 0, hit: 0, fail: 0 });
      setFloatingResults([]);
    }
  }, [isOpen]);

  useHotkeys(
    "Escape",
    () => {
      if (isOpen) onClose();
    },
    { enabled: isOpen },
    [isOpen, onClose]
  );

  // Gerar novo teste com novas configurações
  const startNewTest = useCallback(() => {
    const data = generateRandomQTEConfig(difficulty);
    setQteData(data);
    setQteState("running");
    setQteKey((k) => k + 1);
  }, [difficulty]);

  // Repetir com as mesmas configurações
  const repeatTest = useCallback(() => {
    if (!qteData) return;

    // Regenerar timestamps para o mesmo config
    const now = Date.now();
    const updatedConfig: QTEConfig = {
      ...qteData.config,
      qteId: `training-qte-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      createdAt: now,
      serverStartTime: now + 100,
      serverEndTime: now + 100 + qteData.config.duration,
      expiresAt: now + 100 + qteData.config.duration,
    };

    setQteData({
      ...qteData,
      config: updatedConfig,
    });
    setQteState("running");
    setQteKey((k) => k + 1);
  }, [qteData]);

  const handleResponse = useCallback(
    (input: QTEInput, hitPosition: number) => {
      if (!qteData || qteState !== "running") return;

      const { config } = qteData;
      const hitZoneStart = 50 - config.hitZoneSize / 2;
      const hitZoneEnd = 50 + config.hitZoneSize / 2;
      const perfectZoneStart = 50 - config.perfectZoneSize / 2;
      const perfectZoneEnd = 50 + config.perfectZoneSize / 2;

      const isInHitZone =
        hitPosition >= hitZoneStart && hitPosition <= hitZoneEnd;
      const isInPerfectZone =
        hitPosition >= perfectZoneStart && hitPosition <= perfectZoneEnd;

      let result: "PERFECT" | "HIT" | "FAIL" = "FAIL";
      if (input !== "NONE" && isInPerfectZone) {
        setStats((s) => ({ ...s, perfect: s.perfect + 1 }));
        result = "PERFECT";
      } else if (input !== "NONE" && isInHitZone) {
        setStats((s) => ({ ...s, hit: s.hit + 1 }));
        result = "HIT";
      } else {
        setStats((s) => ({ ...s, fail: s.fail + 1 }));
        result = "FAIL";
      }

      // Adicionar tooltip flutuante em cascata (dura 3 segundos)
      const newId = floatingIdRef.current++;
      setFloatingResults((prev) => [...prev, { id: newId, result }]);
      setTimeout(() => {
        setFloatingResults((prev) => prev.filter((r) => r.id !== newId));
      }, 3000);

      // Marcar como finalizado
      setQteState("finished");

      // Se auto-loop está ativo, iniciar novo após delay
      if (autoLoop) {
        setTimeout(() => {
          startNewTest();
        }, 1500);
      }
    },
    [qteData, qteState, autoLoop, startNewTest]
  );

  if (!isOpen) return null;

  const { config, attributes, calculations } = qteData || {
    config: null,
    attributes: null,
    calculations: null,
  };

  const isFinished = qteState === "finished";

  // Configuração visual do tooltip
  const getFloatingResultConfig = (result: "PERFECT" | "HIT" | "FAIL") => {
    switch (result) {
      case "PERFECT":
        return {
          text: "✨ PERFEITO!",
          color: "text-yellow-400",
          bg: "bg-yellow-900/80",
          border: "border-yellow-500",
        };
      case "HIT":
        return {
          text: "✅ ACERTO!",
          color: "text-green-400",
          bg: "bg-green-900/80",
          border: "border-green-500",
        };
      case "FAIL":
        return {
          text: "❌ FALHOU!",
          color: "text-red-400",
          bg: "bg-red-900/80",
          border: "border-red-500",
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90">
      {/* Tooltips Flutuantes em Cascata - à esquerda do painel de controles */}
      <div className="fixed right-72 bottom-4 z-[60] flex flex-col-reverse gap-2 items-end">
        <AnimatePresence>
          {floatingResults.map((item) => {
            const cfg = getFloatingResultConfig(item.result);
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 50, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 30, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className={`px-4 py-2 rounded-lg border-2 ${cfg.bg} ${cfg.border} shadow-xl`}
              >
                <span
                  className={`text-lg font-bold ${cfg.color} drop-shadow-lg whitespace-nowrap`}
                >
                  {cfg.text}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* QTE Overlay - usa key para forçar remontagem apenas quando necessário */}
      {config && qteState === "running" && (
        <QTEOverlay
          key={qteKey}
          config={config}
          onResponse={handleResponse}
          isResponder={true}
          isVisualActive={true}
          responderName={attributes?.defender.name || "Defensor"}
          attackerName={attributes?.attacker.name || "Atacante"}
          isTrainingMode={true}
        />
      )}

      {/* UI do Training - sempre visível */}
      <div className="fixed inset-0 z-40 pointer-events-none">
        {/* Aviso ESC = SAIR */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto">
          <div className="bg-black/80 px-4 py-2 rounded-lg border border-gray-600">
            <span className="text-gray-300 text-sm">
              <kbd className="px-2 py-1 bg-gray-700 rounded text-white font-mono mr-2">
                ESC
              </kbd>
              = SAIR
            </span>
          </div>
        </div>

        {/* Painel direito - Controles */}
        <motion.div
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-64 pointer-events-auto"
        >
          <div className="bg-black/90 rounded-lg border border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
              <h3 className="text-white font-bold text-sm">⚙️ Controles</h3>
            </div>

            {/* Toggle Auto-Loop */}
            <div className="p-3 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">Auto-Loop</span>
                <button
                  onClick={() => setAutoLoop(!autoLoop)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    autoLoop ? "bg-green-600" : "bg-gray-600"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      autoLoop ? "left-7" : "left-1"
                    }`}
                  />
                </button>
              </div>
              <p className="text-gray-500 text-xs mt-1">
                {autoLoop ? "Loop automático ativo" : "Aguarda ação manual"}
              </p>
            </div>

            {/* Dificuldade */}
            <div className="p-3 border-b border-gray-700">
              <div className="text-gray-300 text-sm mb-2">Dificuldade</div>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(DIFFICULTY_CONFIGS) as DifficultyLevel[]).map(
                  (level) => {
                    const cfg = DIFFICULTY_CONFIGS[level];
                    const isSelected = difficulty === level;
                    return (
                      <button
                        key={level}
                        onClick={() => setDifficulty(level)}
                        className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${
                          isSelected
                            ? `${cfg.color} text-white ring-2 ring-white/50`
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        }`}
                      >
                        {cfg.emoji} {cfg.label}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="p-3 space-y-2">
              <button
                onClick={repeatTest}
                disabled={!qteData || qteState === "running"}
                className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded text-sm font-medium transition-colors"
              >
                🔄 Repetir
              </button>
              <button
                onClick={startNewTest}
                disabled={qteState === "running"}
                className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded text-sm font-medium transition-colors"
              >
                🎲 Novo Teste
              </button>
            </div>
          </div>
        </motion.div>

        {/* Painel lateral de atributos */}
        {attributes && calculations && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-72"
          >
            <div className="bg-black/90 rounded-lg border border-gray-700 overflow-hidden">
              {/* Header */}
              <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
                <h3 className="text-white font-bold text-sm">
                  ⚔️ Atributos do Combate
                </h3>
              </div>

              {/* Atacante */}
              <div className="p-3 border-b border-gray-700">
                <div className="text-red-400 font-semibold text-xs mb-2">
                  🗡️ ATACANTE: {attributes.attacker.name}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-red-900/30 rounded px-2 py-1 text-center">
                    <div className="text-gray-400">Combat</div>
                    <div className="text-red-300 font-bold">
                      {attributes.attacker.combat}
                    </div>
                  </div>
                  <div className="bg-blue-900/30 rounded px-2 py-1 text-center">
                    <div className="text-gray-400">Speed</div>
                    <div className="text-blue-300 font-bold">
                      {attributes.attacker.speed}
                    </div>
                  </div>
                  <div className="bg-purple-900/30 rounded px-2 py-1 text-center">
                    <div className="text-gray-400">Focus</div>
                    <div className="text-purple-300 font-bold">
                      {attributes.attacker.focus}
                    </div>
                  </div>
                </div>
              </div>

              {/* Defensor */}
              <div className="p-3 border-b border-gray-700">
                <div className="text-green-400 font-semibold text-xs mb-2">
                  🛡️ DEFENSOR: {attributes.defender.name}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-orange-900/30 rounded px-2 py-1 text-center">
                    <div className="text-gray-400">Resist</div>
                    <div className="text-orange-300 font-bold">
                      {attributes.defender.resistance}
                    </div>
                  </div>
                  <div className="bg-blue-900/30 rounded px-2 py-1 text-center">
                    <div className="text-gray-400">Speed</div>
                    <div className="text-blue-300 font-bold">
                      {attributes.defender.speed}
                    </div>
                  </div>
                  <div className="bg-purple-900/30 rounded px-2 py-1 text-center">
                    <div className="text-gray-400">Focus</div>
                    <div className="text-purple-300 font-bold">
                      {attributes.defender.focus}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cálculos */}
              <div className="p-3 space-y-2 text-xs">
                <div className="text-yellow-400 font-semibold mb-2">
                  📊 CÁLCULOS (Backend)
                </div>

                {/* Duration */}
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Duração:</span>
                    <span className="text-white font-mono">
                      {calculations.duration.value}ms
                    </span>
                  </div>
                  <div className="text-gray-500 text-[10px] mt-1 font-mono">
                    {calculations.duration.formula}
                  </div>
                </div>

                {/* Hit Zone */}
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Zona Esquiva:</span>
                    <span className="text-green-400 font-mono">
                      {calculations.hitZoneSize.value}%
                    </span>
                  </div>
                  <div className="text-gray-500 text-[10px] mt-1 font-mono">
                    {calculations.hitZoneSize.formula}
                  </div>
                </div>

                {/* Block Zone */}
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Zona Bloqueio:</span>
                    <span className="text-blue-400 font-mono">
                      {calculations.blockHitZoneSize.value}%
                    </span>
                  </div>
                  <div className="text-gray-500 text-[10px] mt-1 font-mono">
                    {calculations.blockHitZoneSize.formula}
                  </div>
                </div>

                {/* Shake */}
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tremor:</span>
                    <span className="text-orange-400 font-mono">
                      {calculations.shakeIntensity.value}
                    </span>
                  </div>
                  <div className="text-gray-500 text-[10px] mt-1 font-mono">
                    {calculations.shakeIntensity.formula}
                  </div>
                </div>

                {/* Config base */}
                <div className="mt-3 pt-2 border-t border-gray-700">
                  <div className="text-gray-500 text-[10px]">
                    Base: {QTE_DEFAULT_CONFIG.baseDuration}ms | Zona:{" "}
                    {QTE_DEFAULT_CONFIG.baseHitZone}% | Perfect:{" "}
                    {QTE_DEFAULT_CONFIG.perfectZoneRatio * 100}%
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Estatísticas + Status */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <div className="bg-black/80 px-6 py-3 rounded-lg border border-gray-600">
            {/* Status - Aguardando início */}
            {qteState === "idle" && !qteData && (
              <div className="text-center mb-3 pb-3 border-b border-gray-700">
                <span className="text-blue-400 text-sm">
                  🎮 Clique em "Novo Teste" para começar!
                </span>
              </div>
            )}

            {/* Status - Finalizado */}
            {isFinished && !autoLoop && (
              <div className="text-center mb-3 pb-3 border-b border-gray-700">
                <span className="text-yellow-400 text-sm">
                  ✨ Teste finalizado! Use os botões à direita para continuar.
                </span>
              </div>
            )}

            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <div className="text-yellow-400 font-bold text-xl">
                  {stats.perfect}
                </div>
                <div className="text-gray-400">Perfeito</div>
              </div>
              <div className="text-center">
                <div className="text-green-400 font-bold text-xl">
                  {stats.hit}
                </div>
                <div className="text-gray-400">Acerto</div>
              </div>
              <div className="text-center">
                <div className="text-red-400 font-bold text-xl">
                  {stats.fail}
                </div>
                <div className="text-gray-400">Falha</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CombatTraining;
