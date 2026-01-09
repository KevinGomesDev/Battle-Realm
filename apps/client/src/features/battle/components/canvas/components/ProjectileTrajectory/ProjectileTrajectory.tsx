/**
 * ProjectileTrajectory - Renderizador de trajetórias de projéteis
 *
 * Componente responsável por desenhar projéteis em movimento no canvas.
 * Suporta diferentes tipos de projéteis com animações únicas.
 *
 * CARACTERÍSTICAS:
 * - Animação suave de movimento
 * - Rastros (trails) configuráveis por tipo
 * - Efeitos de glow e partículas
 * - Rotação e pulsação
 * - Suporte a projéteis de área (explosão no final)
 */

import type { ActiveProjectile, TrailParticle } from "./projectile.types";
import { getProjectileConfig } from "./projectile.config";

/** Props para o renderizador */
export interface ProjectileRendererProps {
  ctx: CanvasRenderingContext2D;
  cellSize: number;
  projectiles: ActiveProjectile[];
  trailParticles: TrailParticle[];
  animationTime: number;
}

/**
 * Função de easing para projéteis rápidos (linear com leve desaceleração)
 */
function easeOutQuad(t: number): number {
  return 1 - Math.pow(1 - t, 2);
}

/**
 * Calcula a posição atual do projétil baseado no progresso
 */
function calculateCurrentPosition(
  projectile: ActiveProjectile,
  progress: number,
  cellSize: number
): { x: number; y: number } {
  const easedProgress = easeOutQuad(progress);

  // Posição em pixels (centro da célula)
  const startX = projectile.startPos.x * cellSize + cellSize / 2;
  const startY = projectile.startPos.y * cellSize + cellSize / 2;
  const endX = projectile.endPos.x * cellSize + cellSize / 2;
  const endY = projectile.endPos.y * cellSize + cellSize / 2;

  return {
    x: startX + (endX - startX) * easedProgress,
    y: startY + (endY - startY) * easedProgress,
  };
}

/**
 * Calcula o ângulo do projétil baseado na direção
 */
function calculateAngle(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): number {
  return Math.atan2(endY - startY, endX - startX);
}

/**
 * Desenha o efeito de glow ao redor do projétil
 */
function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  size: number,
  intensity: number,
  pulse: number
): void {
  const glowSize = size * (2 + intensity) * (0.8 + pulse * 0.4);

  const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
  gradient.addColorStop(0, color);
  gradient.addColorStop(
    0.5,
    color.replace(")", ", 0.3)").replace("rgb", "rgba")
  );
  gradient.addColorStop(1, "transparent");

  ctx.save();
  ctx.globalAlpha = intensity * 0.5;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, glowSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Desenha o rastro do projétil
 */
function drawTrail(
  ctx: CanvasRenderingContext2D,
  projectile: ActiveProjectile,
  currentX: number,
  currentY: number,
  progress: number,
  cellSize: number
): void {
  const config = getProjectileConfig(projectile.type);
  if (!config.hasTrail) return;

  const startX = projectile.startPos.x * cellSize + cellSize / 2;
  const startY = projectile.startPos.y * cellSize + cellSize / 2;

  // Calcular ponto inicial do rastro (não começa do início)
  const trailStartProgress = Math.max(0, progress - 0.3);
  const trailStartX =
    startX + (currentX - startX) * (trailStartProgress / progress || 0);
  const trailStartY =
    startY + (currentY - startY) * (trailStartProgress / progress || 0);

  // Criar gradiente para o rastro
  const gradient = ctx.createLinearGradient(
    trailStartX,
    trailStartY,
    currentX,
    currentY
  );
  gradient.addColorStop(0, "transparent");
  gradient.addColorStop(1, config.trailColor);

  ctx.save();
  ctx.strokeStyle = gradient;
  ctx.lineWidth = config.size * 0.6;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(trailStartX, trailStartY);
  ctx.lineTo(currentX, currentY);
  ctx.stroke();
  ctx.restore();
}

/**
 * Desenha projétil tipo MELEE (slash)
 */
function drawMeleeProjectile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  config: ReturnType<typeof getProjectileConfig>,
  progress: number,
  animationTime: number
): void {
  const rotation = (animationTime * config.rotationSpeed * Math.PI) / 180;
  const size = config.size * (1 + progress * 0.5); // Cresce durante o movimento

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + rotation);

  // Desenha um arco/slash
  ctx.strokeStyle = config.color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.arc(0, 0, size, -Math.PI / 3, Math.PI / 3);
  ctx.stroke();

  // Linha central
  ctx.beginPath();
  ctx.moveTo(-size * 0.3, 0);
  ctx.lineTo(size, 0);
  ctx.stroke();

  ctx.restore();
}

/**
 * Desenha projétil tipo ARROW
 */
function drawArrowProjectile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  config: ReturnType<typeof getProjectileConfig>
): void {
  const size = config.size;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Corpo da flecha
  ctx.strokeStyle = config.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-size * 1.5, 0);
  ctx.lineTo(size * 0.5, 0);
  ctx.stroke();

  // Ponta da flecha
  ctx.fillStyle = "#666666";
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(size * 0.3, -size * 0.3);
  ctx.lineTo(size * 0.3, size * 0.3);
  ctx.closePath();
  ctx.fill();

  // Penas
  ctx.strokeStyle = "#8B0000";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-size * 1.5, 0);
  ctx.lineTo(-size * 1.2, -size * 0.4);
  ctx.moveTo(-size * 1.5, 0);
  ctx.lineTo(-size * 1.2, size * 0.4);
  ctx.stroke();

  ctx.restore();
}

/**
 * Desenha projétil tipo FIREBALL
 */
function drawFireballProjectile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  config: ReturnType<typeof getProjectileConfig>,
  pulse: number,
  animationTime: number
): void {
  const size = config.size * (0.9 + pulse * 0.2);
  const rotation = (animationTime * config.rotationSpeed * Math.PI) / 180;

  // Núcleo
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
  gradient.addColorStop(0, "#FFFF00"); // Centro amarelo
  gradient.addColorStop(0.4, "#FF8C00"); // Laranja
  gradient.addColorStop(0.8, "#FF4500"); // Vermelho-laranja
  gradient.addColorStop(1, "rgba(255, 69, 0, 0.3)");

  ctx.save();

  // Brilho externo
  ctx.shadowColor = config.color;
  ctx.shadowBlur = size * 2;

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();

  // "Chamas" ao redor (ondulações)
  ctx.strokeStyle = "#FF6600";
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const flameAngle = rotation + (i * Math.PI * 2) / 6;
    const flameLength = size * (0.8 + Math.sin(animationTime * 0.01 + i) * 0.3);
    const fx = x + Math.cos(flameAngle) * flameLength;
    const fy = y + Math.sin(flameAngle) * flameLength;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(fx, fy);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Desenha projétil tipo ICE
 */
function drawIceProjectile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  _angle: number,
  config: ReturnType<typeof getProjectileConfig>,
  pulse: number,
  animationTime: number
): void {
  const size = config.size * (0.95 + pulse * 0.1);
  const rotation = (animationTime * config.rotationSpeed * Math.PI) / 180;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  // Cristal de gelo (hexágono alongado)
  const gradient = ctx.createLinearGradient(-size, 0, size, 0);
  gradient.addColorStop(0, "#87CEEB");
  gradient.addColorStop(0.5, "#00BFFF");
  gradient.addColorStop(1, "#87CEEB");

  ctx.fillStyle = gradient;
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 1;

  // Desenhar cristal
  ctx.beginPath();
  ctx.moveTo(size * 1.2, 0);
  ctx.lineTo(size * 0.4, -size * 0.5);
  ctx.lineTo(-size * 0.8, -size * 0.3);
  ctx.lineTo(-size * 1.2, 0);
  ctx.lineTo(-size * 0.8, size * 0.3);
  ctx.lineTo(size * 0.4, size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

/**
 * Desenha projétil tipo LIGHTNING
 */
function drawLightningProjectile(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  progress: number,
  pulse: number,
  cellSize: number
): void {
  // Raio é instantâneo - desenha linha zigzag do início ao ponto atual
  const currentEndX = startX + (endX - startX) * progress;
  const currentEndY = startY + (endY - startY) * progress;

  const segments = 8;
  const amplitude = cellSize * 0.3;

  ctx.save();

  // Glow externo
  ctx.shadowColor = "#FFFF00";
  ctx.shadowBlur = 15 * (0.5 + pulse * 0.5);

  // Linha principal
  ctx.strokeStyle = pulse > 0.5 ? "#FFFFFF" : "#FFFF00";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(startX, startY);

  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    if (t > progress) break;

    const segX = startX + (currentEndX - startX) * (i / segments);
    const segY = startY + (currentEndY - startY) * (i / segments);

    // Adicionar zigzag aleatório (baseado em tempo para animação)
    const offset = Math.sin(i * 123.456 + pulse * 10) * amplitude;
    const perpX = -(endY - startY);
    const perpY = endX - startX;
    const perpLen = Math.sqrt(perpX * perpX + perpY * perpY) || 1;

    const finalX = segX + (perpX / perpLen) * offset;
    const finalY = segY + (perpY / perpLen) * offset;

    ctx.lineTo(finalX, finalY);
  }

  ctx.stroke();

  // Linha secundária mais fina
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

/**
 * Desenha projétil genérico (MAGIC / PROJECTILE)
 */
function drawGenericProjectile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  config: ReturnType<typeof getProjectileConfig>,
  pulse: number
): void {
  const size = config.size * (0.9 + pulse * 0.2);

  ctx.save();

  if (config.hasGlow) {
    ctx.shadowColor = config.color;
    ctx.shadowBlur = size * config.glowIntensity;
  }

  // Esfera principal
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
  gradient.addColorStop(0, "#FFFFFF");
  gradient.addColorStop(0.3, config.color);
  gradient.addColorStop(1, config.trailColor);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Desenha partículas de rastro
 */
function drawTrailParticles(
  ctx: CanvasRenderingContext2D,
  particles: TrailParticle[],
  cellSize: number
): void {
  ctx.save();

  particles.forEach((particle) => {
    const x = particle.x * cellSize + cellSize / 2;
    const y = particle.y * cellSize + cellSize / 2;

    ctx.globalAlpha = particle.alpha * 0.6;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(x, y, particle.size * cellSize * 0.1, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

/**
 * Desenha explosão de área (quando projétil chega ao destino)
 */
function drawExplosion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  progress: number, // 0-1, onde 1 = explosão completa
  cellSize: number
): void {
  // Explosão aparece nos últimos 20% da animação
  const explosionProgress = Math.max(0, (progress - 0.8) / 0.2);
  if (explosionProgress <= 0) return;

  const maxRadius = size * cellSize * 0.4;
  const currentRadius = maxRadius * explosionProgress;
  const alpha = 1 - explosionProgress;

  ctx.save();

  const gradient = ctx.createRadialGradient(x, y, 0, x, y, currentRadius);
  gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
  gradient.addColorStop(
    0.3,
    color.replace(")", `, ${alpha * 0.8})`).replace("rgb", "rgba")
  );
  gradient.addColorStop(1, "transparent");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Renderiza todos os projéteis ativos
 */
export function renderProjectiles(props: ProjectileRendererProps): void {
  const { ctx, cellSize, projectiles, trailParticles, animationTime } = props;

  // Desenhar partículas de rastro primeiro (ficam atrás)
  drawTrailParticles(ctx, trailParticles, cellSize);

  // Desenhar cada projétil
  projectiles.forEach((projectile) => {
    const elapsed = animationTime - projectile.startTime;
    const progress = Math.min(elapsed / projectile.duration, 1);
    const config = getProjectileConfig(projectile.type);

    // Calcular posição atual
    const { x, y } = calculateCurrentPosition(projectile, progress, cellSize);

    // Calcular ângulo
    const startX = projectile.startPos.x * cellSize + cellSize / 2;
    const startY = projectile.startPos.y * cellSize + cellSize / 2;
    const endX = projectile.endPos.x * cellSize + cellSize / 2;
    const endY = projectile.endPos.y * cellSize + cellSize / 2;
    const angle = calculateAngle(startX, startY, endX, endY);

    // Calcular pulso
    const pulse = config.pulses
      ? (Math.sin(
          (animationTime / 1000) * config.pulseFrequency * Math.PI * 2
        ) +
          1) /
        2
      : 0;

    // Desenhar glow (se aplicável)
    if (config.hasGlow) {
      drawGlow(
        ctx,
        x,
        y,
        config.color,
        config.size,
        config.glowIntensity,
        pulse
      );
    }

    // Desenhar rastro
    drawTrail(ctx, projectile, x, y, progress, cellSize);

    // Desenhar projétil baseado no tipo
    switch (projectile.type) {
      case "MELEE":
        drawMeleeProjectile(ctx, x, y, angle, config, progress, animationTime);
        break;

      case "ARROW":
        drawArrowProjectile(ctx, x, y, angle, config);
        break;

      case "FIREBALL":
        drawFireballProjectile(ctx, x, y, config, pulse, animationTime);
        break;

      case "ICE":
        drawIceProjectile(ctx, x, y, angle, config, pulse, animationTime);
        break;

      case "LIGHTNING":
        drawLightningProjectile(
          ctx,
          startX,
          startY,
          endX,
          endY,
          progress,
          pulse,
          cellSize
        );
        break;

      case "MAGIC":
      case "PROJECTILE":
      default:
        drawGenericProjectile(ctx, x, y, config, pulse);
        break;
    }

    // Desenhar explosão (se for projétil de área)
    if (projectile.isAreaProjectile && projectile.explosionSize) {
      drawExplosion(
        ctx,
        endX,
        endY,
        projectile.explosionSize,
        config.color,
        progress,
        cellSize
      );
    }
  });
}

/**
 * Componente wrapper (para uso com React se necessário)
 * Na prática, usamos diretamente a função renderProjectiles no loop do canvas
 */
export const ProjectileTrajectory = {
  render: renderProjectiles,
};
