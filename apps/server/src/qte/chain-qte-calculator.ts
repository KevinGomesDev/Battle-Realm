// server/src/qte/chain-qte-calculator.ts
// Calculadora de Chain QTE (QTEs em cascata/playlist)
// Usado para skills como Chain Lightning, Omnislash, Meteor Shower

import type { BattleUnit } from "@boundless/shared/types/battle.types";
import type {
  ChainQTEConfig,
  ChainQTEStep,
  ChainQTEType,
  ChainFailMode,
  ChainStepDifficulty,
} from "@boundless/shared/qte";
import {
  QTE_FUTURE_DELAY,
  CHAIN_DIFFICULTY_CONFIG,
  CHAIN_COMBO_MULTIPLIERS,
} from "@boundless/shared/qte";

import {
  calculateQTEDuration,
  calculateShakeIntensity,
  calculateHitZoneSize,
} from "./qte-calculator";

/**
 * Gera um ID único para Chain QTE
 */
export function generateChainQTEId(): string {
  return "chain-" + Math.random().toString(36).substring(2, 15);
}

// =============================================================================
// CÁLCULOS DE STEP
// =============================================================================

/**
 * Calcula a dificuldade de um step baseado no índice
 * Passos posteriores são mais difíceis
 */
export function calculateStepDifficulty(
  stepIndex: number,
  totalSteps: number
): ChainStepDifficulty {
  const progress = stepIndex / (totalSteps - 1 || 1);

  if (progress < 0.33) return "EASY";
  if (progress < 0.66) return "MEDIUM";
  return "HARD";
}

/**
 * Calcula o offset de tempo para um step
 * Considera tempo de "viagem" visual entre alvos
 */
export function calculateStepOffset(
  stepIndex: number,
  previousStepEndTime: number,
  fromPosition: { x: number; y: number },
  toPosition: { x: number; y: number },
  travelSpeedMs: number = 100 // ms por célula
): number {
  if (stepIndex === 0) return 0;

  // Distância Manhattan entre posições
  const distance =
    Math.abs(toPosition.x - fromPosition.x) +
    Math.abs(toPosition.y - fromPosition.y);

  // Tempo de viagem + pequeno buffer
  const travelTime = distance * travelSpeedMs;

  return previousStepEndTime + travelTime + 100; // +100ms de buffer visual
}

/**
 * Calcula multiplicador de combo para um step
 */
export function calculateComboMultiplier(
  consecutiveHits: number,
  consecutivePerfects: number
): number {
  const baseBonus = consecutiveHits * CHAIN_COMBO_MULTIPLIERS.PER_HIT;
  const perfectBonus =
    consecutivePerfects * CHAIN_COMBO_MULTIPLIERS.PERFECT_BONUS;

  return Math.min(
    1.0 + baseBonus + perfectBonus,
    CHAIN_COMBO_MULTIPLIERS.MAX_COMBO
  );
}

// =============================================================================
// GERAÇÃO DE CHAIN QTE
// =============================================================================

/**
 * Parâmetros para gerar Chain QTE
 */
export interface GenerateChainQTEParams {
  /** Tipo de Chain QTE */
  chainType: ChainQTEType;

  /** ID da batalha */
  battleId: string;

  /** ID do jogador que executa */
  playerId: string;

  /** Unidade que lança a skill */
  caster: BattleUnit;

  /** Alvos em ordem (já pré-calculados) */
  targets: BattleUnit[];

  /** Dano base por alvo */
  baseDamagePerTarget: number;

  /** Se é ataque mágico */
  isMagicAttack: boolean;

  /** Modo de falha */
  failMode: ChainFailMode;

  /** Skill ou spell code */
  skillCode?: string;
  spellCode?: string;

  /** Nome da ação para UI */
  actionName: string;

  /** Tempo atual do servidor */
  serverTime: number;

  /** Cor da linha de trajetória */
  trajectoryColor?: string;
}

/**
 * Gera configuração completa de Chain QTE
 * O servidor pré-calcula todos os passos e envia de uma vez
 */
export function generateChainQTE(
  params: GenerateChainQTEParams
): ChainQTEConfig {
  const {
    chainType,
    battleId,
    playerId,
    caster,
    targets,
    baseDamagePerTarget,
    isMagicAttack,
    failMode,
    skillCode,
    spellCode,
    actionName,
    serverTime,
    trajectoryColor = "#fbbf24",
  } = params;

  const steps: ChainQTEStep[] = [];
  let cumulativeOffset = 0;
  let previousPosition = { x: caster.posX, y: caster.posY };

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const difficulty = calculateStepDifficulty(i, targets.length);
    const diffConfig = CHAIN_DIFFICULTY_CONFIG[difficulty];

    // Calcular offset (tempo de viagem + duração do step anterior)
    const offset = calculateStepOffset(
      i,
      cumulativeOffset,
      previousPosition,
      { x: target.posX, y: target.posY },
      150 // 150ms por célula de distância
    );

    // Ajustar duração baseado nos atributos
    const duration = calculateQTEDuration(caster.speed, target.speed);
    const adjustedDuration = Math.min(
      Math.max(diffConfig.duration, duration - 200),
      diffConfig.duration + 200
    );

    // Calcular shake
    const attackerPower = isMagicAttack ? caster.focus : caster.combat;
    const defenderDefense = isMagicAttack ? target.will : target.resistance;
    const shakeIntensity = calculateShakeIntensity(
      attackerPower,
      defenderDefense
    );

    // Ajustar zonas pela dificuldade
    let hitZoneSize = calculateHitZoneSize(caster.focus, target.speed);
    hitZoneSize = Math.min(hitZoneSize, diffConfig.hitZoneSize);

    const perfectZoneSize = Math.round(hitZoneSize * 0.3);

    // Combo multiplier aumenta a cada step (incentiva acertar toda a corrente)
    const comboMultiplier = 1.0 + i * 0.1;

    steps.push({
      stepIndex: i,
      targetId: target.id,
      targetName: target.name,
      targetPosition: { x: target.posX, y: target.posY },
      offsetMs: offset,
      duration: adjustedDuration,
      difficulty,
      hitZoneSize,
      perfectZoneSize,
      shakeIntensity,
      validInputs: ["E"],
      baseDamage: baseDamagePerTarget,
      comboMultiplier,
    });

    cumulativeOffset = offset + adjustedDuration;
    previousPosition = { x: target.posX, y: target.posY };
  }

  // Calcular duração total
  const lastStep = steps[steps.length - 1];
  const totalDuration = lastStep.offsetMs + lastStep.duration;

  // Timestamp base (quando começa)
  const serverBaseTime = serverTime + QTE_FUTURE_DELAY;

  // Construir linha de trajetória para visualização
  const trajectoryPoints = [
    { x: caster.posX, y: caster.posY },
    ...targets.map((t) => ({ x: t.posX, y: t.posY })),
  ];

  return {
    chainId: generateChainQTEId(),
    chainType,
    battleId,
    playerId,
    casterId: caster.id,
    skillCode,
    spellCode,
    actionName,
    failMode,
    serverBaseTime,
    steps,
    totalDuration,
    isMagicAttack,
    trajectoryLine: {
      points: trajectoryPoints,
      color: trajectoryColor,
    },
  };
}

// =============================================================================
// HELPERS PARA SKILLS ESPECÍFICAS
// =============================================================================

/**
 * Gera Chain QTE para Chain Lightning
 * Raio que salta entre inimigos
 */
export function generateChainLightningQTE(
  battleId: string,
  playerId: string,
  caster: BattleUnit,
  targets: BattleUnit[],
  baseDamage: number,
  serverTime: number
): ChainQTEConfig {
  return generateChainQTE({
    chainType: "OFFENSIVE",
    battleId,
    playerId,
    caster,
    targets,
    baseDamagePerTarget: baseDamage,
    isMagicAttack: true,
    failMode: "COMBO", // Erro zera combo, mas continua
    skillCode: "CHAIN_LIGHTNING",
    actionName: "Chain Lightning",
    serverTime,
    trajectoryColor: "#60a5fa", // Azul elétrico
  });
}

/**
 * Gera Chain QTE para Omnislash
 * Múltiplos hits rápidos no mesmo alvo ou área
 */
export function generateOmnislashQTE(
  battleId: string,
  playerId: string,
  caster: BattleUnit,
  target: BattleUnit,
  hitCount: number,
  baseDamagePerHit: number,
  serverTime: number
): ChainQTEConfig {
  // Para Omnislash, o alvo é o mesmo para todos os hits
  const targets = Array(hitCount).fill(target);

  return generateChainQTE({
    chainType: "FOCUSED",
    battleId,
    playerId,
    caster,
    targets,
    baseDamagePerTarget: baseDamagePerHit,
    isMagicAttack: false,
    failMode: "CONTINUE", // Continua mesmo errando
    skillCode: "OMNISLASH",
    actionName: "Omnislash",
    serverTime,
    trajectoryColor: "#ef4444", // Vermelho
  });
}

/**
 * Gera Chain QTE para Meteor Shower (defesa)
 * Múltiplos meteoros caindo em sequência
 */
export function generateMeteorShowerDefenseQTE(
  battleId: string,
  playerId: string,
  defender: BattleUnit,
  impactCount: number,
  baseDamagePerImpact: number,
  serverTime: number
): ChainQTEConfig {
  // Para defesa, todos os impactos são no mesmo local
  const targets = Array(impactCount).fill(defender);

  return generateChainQTE({
    chainType: "DEFENSIVE",
    battleId,
    playerId,
    caster: defender, // Defensor como "caster" neste contexto
    targets,
    baseDamagePerTarget: baseDamagePerImpact,
    isMagicAttack: true,
    failMode: "CONTINUE", // Cada falha = dano
    skillCode: "METEOR_SHOWER_DEFENSE",
    actionName: "Defender Meteoros",
    serverTime,
    trajectoryColor: "#f97316", // Laranja
  });
}
