/**
 * HitStop System - Sistema de "Juice" para impactos de combate
 *
 * Quando uma unidade recebe dano, este sistema coordena:
 * 1. Freeze Frame - Congela a tela por alguns milissegundos
 * 2. Screen Shake - Tremor da câmera proporcional ao dano
 * 3. Impact Particles - Explosão de partículas no ponto de impacto
 *
 * Todos os efeitos são sincronizados para todos os jogadores via eventos do servidor.
 */

// =============================================================================
// TIPOS
// =============================================================================

export interface HitStopConfig {
  /** Duração do freeze frame em ms (padrão: 50ms) */
  freezeDuration: number;
  /** Intensidade do shake (1-10, padrão: 5) */
  shakeIntensity: number;
  /** Duração do shake em ms (padrão: 150ms) */
  shakeDuration: number;
  /** Número de partículas a spawnar (padrão: 8) */
  particleCount: number;
  /** Cor primária das partículas */
  particleColor: string;
  /** Cor secundária (flash) */
  flashColor: string;
}

export interface ImpactParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  rotation: number;
  rotationSpeed: number;
  shape: "circle" | "star" | "slash";
}

export interface HitStopEvent {
  /** ID único do evento */
  id: string;
  /** Posição X do impacto (em células) */
  cellX: number;
  /** Posição Y do impacto (em células) */
  cellY: number;
  /** Dano causado (para escalar efeitos) */
  damage: number;
  /** HP máximo do alvo (para calcular proporção) */
  maxHp: number;
  /** Timestamp de início */
  startTime: number;
  /** Configuração do efeito */
  config: HitStopConfig;
  /** Se é crítico */
  isCritical: boolean;
}

export interface HitStopState {
  /** Se o jogo está congelado */
  isFrozen: boolean;
  /** Eventos ativos */
  activeEvents: HitStopEvent[];
  /** Partículas ativas */
  particles: ImpactParticle[];
  /** Offset de shake atual */
  shakeOffset: { x: number; y: number };
  /** Flash overlay alpha */
  flashAlpha: number;
}

// =============================================================================
// CONFIGURAÇÕES PADRÃO
// =============================================================================

const DEFAULT_CONFIG: HitStopConfig = {
  freezeDuration: 50,
  shakeIntensity: 5,
  shakeDuration: 150,
  particleCount: 8,
  particleColor: "#ffffff",
  flashColor: "#ff6666",
};

const CRITICAL_CONFIG: HitStopConfig = {
  freezeDuration: 100,
  shakeIntensity: 10,
  shakeDuration: 250,
  particleCount: 16,
  particleColor: "#ffff00",
  flashColor: "#ff0000",
};

// Cores de partículas por tipo de dano
const PARTICLE_COLORS = {
  physical: ["#ffffff", "#ffcccc", "#ff9999"],
  magical: ["#9999ff", "#cc99ff", "#ff99ff"],
  fire: ["#ff6600", "#ffcc00", "#ff3300"],
  ice: ["#66ccff", "#99ffff", "#ffffff"],
  critical: ["#ffff00", "#ffcc00", "#ff9900"],
};

// =============================================================================
// CLASSE PRINCIPAL
// =============================================================================

export class HitStopSystem {
  private state: HitStopState = {
    isFrozen: false,
    activeEvents: [],
    particles: [],
    shakeOffset: { x: 0, y: 0 },
    flashAlpha: 0,
  };

  private cellSize: number = 40;
  private nextParticleId: number = 0;
  private freezeEndTime: number = 0;
  private shakeEndTime: number = 0;
  private onShake?: (intensity: number, duration: number) => void;

  /**
   * Configura o tamanho da célula para converter coordenadas
   */
  setCellSize(size: number): void {
    this.cellSize = size;
  }

  /**
   * Registra callback para shake externo (CameraController)
   */
  setShakeCallback(
    callback: (intensity: number, duration: number) => void
  ): void {
    this.onShake = callback;
  }

  /**
   * Dispara um evento de Hit Stop
   */
  trigger(
    cellX: number,
    cellY: number,
    damage: number,
    maxHp: number,
    isCritical: boolean = false
  ): void {
    const damagePercent = maxHp > 0 ? damage / maxHp : 0.1;

    // Escalar efeitos baseado na porcentagem de dano
    const scaleFactor = Math.min(1, damagePercent * 3); // Max effect at 33% damage

    const baseConfig = isCritical ? CRITICAL_CONFIG : DEFAULT_CONFIG;
    const config: HitStopConfig = {
      ...baseConfig,
      freezeDuration: Math.round(
        baseConfig.freezeDuration * (0.5 + scaleFactor * 0.5)
      ),
      shakeIntensity: Math.round(
        baseConfig.shakeIntensity * (0.5 + scaleFactor * 0.5)
      ),
      particleCount: Math.round(
        baseConfig.particleCount * (0.5 + scaleFactor * 0.5)
      ),
    };

    const event: HitStopEvent = {
      id: `hit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      cellX,
      cellY,
      damage,
      maxHp,
      startTime: performance.now(),
      config,
      isCritical,
    };

    this.state.activeEvents.push(event);

    // Iniciar freeze
    this.freezeEndTime = Math.max(
      this.freezeEndTime,
      event.startTime + config.freezeDuration
    );
    this.state.isFrozen = true;

    // Disparar shake externo
    if (this.onShake) {
      this.onShake(config.shakeIntensity, config.shakeDuration);
    }
    this.shakeEndTime = Math.max(
      this.shakeEndTime,
      event.startTime + config.shakeDuration
    );

    // Spawnar partículas
    this.spawnImpactParticles(event);

    // Flash overlay
    this.state.flashAlpha = isCritical ? 0.3 : 0.15;
  }

  /**
   * Spawna partículas de impacto
   */
  private spawnImpactParticles(event: HitStopEvent): void {
    const centerX = (event.cellX + 0.5) * this.cellSize;
    const centerY = (event.cellY + 0.5) * this.cellSize;

    const colors = event.isCritical
      ? PARTICLE_COLORS.critical
      : PARTICLE_COLORS.physical;

    for (let i = 0; i < event.config.particleCount; i++) {
      // Ângulo distribuído em círculo com variação
      const baseAngle = (i / event.config.particleCount) * Math.PI * 2;
      const angle = baseAngle + (Math.random() - 0.5) * 0.5;

      // Velocidade com variação
      const speed = 100 + Math.random() * 150;

      // Escolher shape
      const shapes: Array<"circle" | "star" | "slash"> = [
        "circle",
        "star",
        "slash",
      ];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];

      const particle: ImpactParticle = {
        id: `p_${this.nextParticleId++}`,
        x: centerX + (Math.random() - 0.5) * 10,
        y: centerY + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        life: 0,
        maxLife: 300 + Math.random() * 200,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
        shape,
      };

      this.state.particles.push(particle);
    }

    // Adicionar algumas partículas especiais para críticos
    if (event.isCritical) {
      // Partículas de "estrelas" maiores
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const particle: ImpactParticle = {
          id: `p_${this.nextParticleId++}`,
          x: centerX,
          y: centerY,
          vx: Math.cos(angle) * 200,
          vy: Math.sin(angle) * 200,
          size: 12 + Math.random() * 8,
          color: "#ffff00",
          alpha: 1,
          life: 0,
          maxLife: 400,
          rotation: 0,
          rotationSpeed: 15,
          shape: "star",
        };
        this.state.particles.push(particle);
      }
    }
  }

  /**
   * Atualiza o sistema (chamar a cada frame)
   * @returns true se há efeitos ativos (precisa re-render)
   */
  update(deltaTime: number): boolean {
    const now = performance.now();

    // Atualizar freeze
    if (this.state.isFrozen && now >= this.freezeEndTime) {
      this.state.isFrozen = false;
    }

    // Atualizar shake offset interno
    if (now < this.shakeEndTime) {
      const remaining = this.shakeEndTime - now;
      const intensity = (remaining / 150) * 5; // Decay
      this.state.shakeOffset = {
        x: (Math.random() - 0.5) * intensity * 2,
        y: (Math.random() - 0.5) * intensity * 2,
      };
    } else {
      this.state.shakeOffset = { x: 0, y: 0 };
    }

    // Atualizar flash
    if (this.state.flashAlpha > 0) {
      this.state.flashAlpha = Math.max(
        0,
        this.state.flashAlpha - deltaTime * 0.003
      );
    }

    // Atualizar partículas
    const dtSeconds = deltaTime / 1000;
    this.state.particles = this.state.particles.filter((p) => {
      p.life += deltaTime;
      if (p.life >= p.maxLife) return false;

      const lifeProgress = p.life / p.maxLife;

      // Física
      p.x += p.vx * dtSeconds;
      p.y += p.vy * dtSeconds;

      // Fricção e gravidade
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.vy += 200 * dtSeconds; // Gravidade leve

      // Rotação
      p.rotation += p.rotationSpeed * dtSeconds;

      // Fade out
      p.alpha = 1 - lifeProgress;

      // Shrink
      p.size *= 0.99;

      return true;
    });

    // Limpar eventos antigos
    this.state.activeEvents = this.state.activeEvents.filter(
      (e) => now - e.startTime < 1000
    );

    return (
      this.state.isFrozen ||
      this.state.particles.length > 0 ||
      this.state.flashAlpha > 0 ||
      now < this.shakeEndTime
    );
  }

  /**
   * Renderiza partículas e efeitos no canvas
   */
  render(ctx: CanvasRenderingContext2D): void {
    // Renderizar partículas
    for (const p of this.state.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      switch (p.shape) {
        case "circle":
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
          break;

        case "star":
          this.drawStar(ctx, 0, 0, 5, p.size / 2, p.size / 4, p.color);
          break;

        case "slash":
          ctx.beginPath();
          ctx.moveTo(-p.size / 2, -p.size / 4);
          ctx.lineTo(p.size / 2, p.size / 4);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.lineCap = "round";
          ctx.stroke();
          break;
      }

      ctx.restore();
    }
  }

  /**
   * Renderiza o flash overlay (chamar após todo o resto)
   */
  renderFlashOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    if (this.state.flashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = this.state.flashAlpha;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  /**
   * Desenha uma estrela
   */
  private drawStar(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    spikes: number,
    outerRadius: number,
    innerRadius: number,
    color: string
  ): void {
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);

    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(
        cx + Math.cos(rot) * outerRadius,
        cy + Math.sin(rot) * outerRadius
      );
      rot += step;
      ctx.lineTo(
        cx + Math.cos(rot) * innerRadius,
        cy + Math.sin(rot) * innerRadius
      );
      rot += step;
    }

    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  /**
   * Retorna se o jogo deve pausar animações (freeze frame)
   */
  isFrozen(): boolean {
    return this.state.isFrozen;
  }

  /**
   * Retorna offset de shake interno
   */
  getShakeOffset(): { x: number; y: number } {
    return this.state.shakeOffset;
  }

  /**
   * Retorna se há efeitos ativos
   */
  hasActiveEffects(): boolean {
    return (
      this.state.isFrozen ||
      this.state.particles.length > 0 ||
      this.state.flashAlpha > 0
    );
  }

  /**
   * Limpa todos os efeitos
   */
  clear(): void {
    this.state = {
      isFrozen: false,
      activeEvents: [],
      particles: [],
      shakeOffset: { x: 0, y: 0 },
      flashAlpha: 0,
    };
  }
}

// =============================================================================
// SINGLETON PARA USO GLOBAL
// =============================================================================

let hitStopInstance: HitStopSystem | null = null;

export function getHitStopSystem(): HitStopSystem {
  if (!hitStopInstance) {
    hitStopInstance = new HitStopSystem();
  }
  return hitStopInstance;
}

export function resetHitStopSystem(): void {
  if (hitStopInstance) {
    hitStopInstance.clear();
  }
  hitStopInstance = null;
}
