/**
 * Tipos para o sistema de trajetória de projéteis
 */

/** Tipos de projéteis disponíveis */
export type ProjectileType =
  | "ARROW" // Ataque físico à distância (arco)
  | "MELEE" // Ataque corpo-a-corpo (linha curta)
  | "FIREBALL" // Bola de fogo (spell)
  | "ICE" // Projétil de gelo
  | "LIGHTNING" // Raio/relâmpago
  | "MAGIC" // Projétil mágico genérico
  | "PROJECTILE"; // Projétil genérico

/** Configuração visual de cada tipo de projétil */
export interface ProjectileConfig {
  /** Cor principal do projétil */
  color: string;
  /** Cor secundária (trail/glow) */
  trailColor: string;
  /** Tamanho do projétil em pixels */
  size: number;
  /** Velocidade em células por segundo */
  speed: number;
  /** Se deixa rastro */
  hasTrail: boolean;
  /** Comprimento do rastro (em pixels) */
  trailLength: number;
  /** Se tem partículas */
  hasParticles: boolean;
  /** Se tem efeito de glow */
  hasGlow: boolean;
  /** Intensidade do glow */
  glowIntensity: number;
  /** Rotação do projétil (em graus por segundo) */
  rotationSpeed: number;
  /** Se o projétil pulsa */
  pulses: boolean;
  /** Frequência do pulso */
  pulseFrequency: number;
}

/** Projétil ativo em animação */
export interface ActiveProjectile {
  /** ID único do projétil */
  id: string;
  /** Tipo do projétil */
  type: ProjectileType;
  /** Posição inicial (grid) */
  startPos: { x: number; y: number };
  /** Posição final (grid) */
  endPos: { x: number; y: number };
  /** Timestamp de início da animação */
  startTime: number;
  /** Duração total da animação em ms */
  duration: number;
  /** ID do caster (para referência) */
  casterId?: string;
  /** ID do alvo (para referência) */
  targetId?: string;
  /** Callback quando a animação terminar */
  onComplete?: () => void;
  /** Se é um projétil de área (explode no final) */
  isAreaProjectile?: boolean;
  /** Tamanho da explosão (se área) */
  explosionSize?: number;
}

/** Partícula do rastro do projétil */
export interface TrailParticle {
  x: number;
  y: number;
  alpha: number;
  size: number;
  createdAt: number;
}

/** Props para o componente ProjectileTrajectory */
export interface ProjectileTrajectoryProps {
  /** Canvas context para desenhar */
  ctx: CanvasRenderingContext2D;
  /** Tamanho da célula em pixels */
  cellSize: number;
  /** Projéteis ativos para renderizar */
  projectiles: ActiveProjectile[];
  /** Tempo atual da animação (para sincronização) */
  animationTime: number;
}
