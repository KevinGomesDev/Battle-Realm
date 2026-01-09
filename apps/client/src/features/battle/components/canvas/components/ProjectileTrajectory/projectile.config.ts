/**
 * Configurações visuais para cada tipo de projétil
 */

import type { ProjectileConfig, ProjectileType } from "./projectile.types";

/** Configurações padrão para cada tipo de projétil */
export const PROJECTILE_CONFIGS: Record<ProjectileType, ProjectileConfig> = {
  // Ataque físico à distância (arco)
  ARROW: {
    color: "#8B4513", // Marrom (madeira)
    trailColor: "rgba(139, 69, 19, 0.3)",
    size: 8,
    speed: 12, // Rápido
    hasTrail: true,
    trailLength: 30,
    hasParticles: false,
    hasGlow: false,
    glowIntensity: 0,
    rotationSpeed: 0, // Flecha não rotaciona
    pulses: false,
    pulseFrequency: 0,
  },

  // Ataque corpo-a-corpo (slash visual)
  MELEE: {
    color: "#C0C0C0", // Prata
    trailColor: "rgba(192, 192, 192, 0.5)",
    size: 12,
    speed: 20, // Muito rápido
    hasTrail: true,
    trailLength: 20,
    hasParticles: true,
    hasGlow: true,
    glowIntensity: 0.3,
    rotationSpeed: 720, // Rotação rápida (2 voltas por segundo)
    pulses: false,
    pulseFrequency: 0,
  },

  // Bola de fogo
  FIREBALL: {
    color: "#FF4500", // Laranja avermelhado
    trailColor: "rgba(255, 100, 0, 0.6)",
    size: 14,
    speed: 8, // Mais lento para efeito dramático
    hasTrail: true,
    trailLength: 50,
    hasParticles: true,
    hasGlow: true,
    glowIntensity: 0.8,
    rotationSpeed: 180,
    pulses: true,
    pulseFrequency: 8, // Pulsa 8 vezes por segundo
  },

  // Projétil de gelo
  ICE: {
    color: "#00BFFF", // Azul gelo
    trailColor: "rgba(135, 206, 250, 0.5)",
    size: 10,
    speed: 10,
    hasTrail: true,
    trailLength: 40,
    hasParticles: true,
    hasGlow: true,
    glowIntensity: 0.5,
    rotationSpeed: 90,
    pulses: true,
    pulseFrequency: 4,
  },

  // Raio/relâmpago
  LIGHTNING: {
    color: "#FFFF00", // Amarelo brilhante
    trailColor: "rgba(255, 255, 100, 0.7)",
    size: 6,
    speed: 25, // Extremamente rápido
    hasTrail: true,
    trailLength: 60,
    hasParticles: true,
    hasGlow: true,
    glowIntensity: 1.0,
    rotationSpeed: 0,
    pulses: true,
    pulseFrequency: 20, // Pisca muito rápido
  },

  // Projétil mágico genérico
  MAGIC: {
    color: "#9932CC", // Roxo escuro
    trailColor: "rgba(153, 50, 204, 0.5)",
    size: 10,
    speed: 10,
    hasTrail: true,
    trailLength: 35,
    hasParticles: true,
    hasGlow: true,
    glowIntensity: 0.6,
    rotationSpeed: 120,
    pulses: true,
    pulseFrequency: 6,
  },

  // Projétil genérico (fallback)
  PROJECTILE: {
    color: "#FFFFFF",
    trailColor: "rgba(255, 255, 255, 0.4)",
    size: 8,
    speed: 10,
    hasTrail: true,
    trailLength: 25,
    hasParticles: false,
    hasGlow: false,
    glowIntensity: 0,
    rotationSpeed: 0,
    pulses: false,
    pulseFrequency: 0,
  },
};

/**
 * Mapeia códigos de ability para tipos de projétil
 */
export const ABILITY_TO_PROJECTILE: Record<string, ProjectileType> = {
  // Ataques
  ATTACK: "MELEE",
  RANGED_ATTACK: "ARROW",
  BOW_SHOT: "ARROW",

  // Spells de fogo
  FIRE: "FIREBALL",
  FIREBALL: "FIREBALL",
  METEOR: "FIREBALL",
  FLAME_STRIKE: "FIREBALL",

  // Spells de gelo
  ICE_BOLT: "ICE",
  FROST: "ICE",
  BLIZZARD: "ICE",
  FREEZE: "ICE",

  // Spells de raio
  LIGHTNING: "LIGHTNING",
  THUNDER: "LIGHTNING",
  SHOCK: "LIGHTNING",
  CHAIN_LIGHTNING: "LIGHTNING",

  // Spells mágicos genéricos
  MAGIC_MISSILE: "MAGIC",
  ARCANE_BOLT: "MAGIC",
  ENERGY_BLAST: "MAGIC",
};

/**
 * Obtém o tipo de projétil para uma ability
 */
export function getProjectileType(abilityCode: string): ProjectileType {
  return ABILITY_TO_PROJECTILE[abilityCode] || "PROJECTILE";
}

/**
 * Obtém a configuração de um tipo de projétil
 */
export function getProjectileConfig(type: ProjectileType): ProjectileConfig {
  return PROJECTILE_CONFIGS[type] || PROJECTILE_CONFIGS.PROJECTILE;
}

/**
 * Calcula a duração da animação baseado na distância e velocidade
 */
export function calculateProjectileDuration(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  speed: number
): number {
  const distance = Math.sqrt(
    Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)
  );
  // Velocidade em células por segundo, retorna duração em ms
  // Mínimo de 200ms para que a animação seja visível
  return Math.max(200, (distance / speed) * 1000);
}
