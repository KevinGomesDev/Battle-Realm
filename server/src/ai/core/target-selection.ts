// server/src/ai/core/target-selection.ts
// Lógica de seleção de alvos para a IA

import { BattleUnit } from "../../../../shared/types/battle.types";
import type { AIBehaviorType, AIProfile } from "../types/ai.types";
import { manhattanDistance } from "./pathfinding";

interface Position {
  x: number;
  y: number;
}

/**
 * Resultado da avaliação de um alvo
 */
interface TargetScore {
  unit: BattleUnit;
  score: number;
  distance: number;
  canReach: boolean;
  canAttack: boolean;
  inVision: boolean;
}

/**
 * Obtém o range de visão de uma unidade
 * Default: max(10, focus) se não definido
 */
export function getVisionRange(unit: BattleUnit): number {
  return unit.visionRange ?? Math.max(10, unit.focus);
}

/**
 * Verifica se um alvo está dentro da visão da unidade
 */
export function isInVision(unit: BattleUnit, target: BattleUnit): boolean {
  const distance = manhattanDistance(
    { x: unit.posX, y: unit.posY },
    { x: target.posX, y: target.posY }
  );
  return distance <= getVisionRange(unit);
}

/**
 * Filtra unidades baseado no campo de visão da unidade observadora
 * - Unidades aliadas: sempre visíveis
 * - Unidades inimigas: somente se dentro do visionRange
 * - Unidades mortas: não visíveis
 */
export function filterVisibleUnits(
  observerUnit: BattleUnit,
  allUnits: BattleUnit[]
): BattleUnit[] {
  return allUnits.filter((u) => {
    // Sempre ver a si mesmo
    if (u.id === observerUnit.id) return true;

    // Unidades do mesmo dono são sempre visíveis
    if (u.ownerId === observerUnit.ownerId) return true;

    // Unidades mortas não são visíveis
    if (!u.isAlive) return false;

    // Inimigos: verificar se estão dentro do campo de visão
    return isInVision(observerUnit, u);
  });
}

/**
 * Obtém todos os inimigos vivos de uma unidade
 */
export function getEnemies(
  unit: BattleUnit,
  allUnits: BattleUnit[]
): BattleUnit[] {
  return allUnits.filter((u) => u.isAlive && u.ownerId !== unit.ownerId);
}

/**
 * Obtém todos os inimigos VISÍVEIS de uma unidade
 */
export function getVisibleEnemies(
  unit: BattleUnit,
  allUnits: BattleUnit[]
): BattleUnit[] {
  return getEnemies(unit, allUnits).filter((enemy) => isInVision(unit, enemy));
}

/**
 * Obtém todos os aliados vivos de uma unidade (exceto ela mesma)
 */
export function getAllies(
  unit: BattleUnit,
  allUnits: BattleUnit[]
): BattleUnit[] {
  return allUnits.filter(
    (u) => u.isAlive && u.ownerId === unit.ownerId && u.id !== unit.id
  );
}

/**
 * Avalia a ameaça que um alvo representa
 * Considera: combat, resistance, HP atual, distância
 */
export function evaluateThreatLevel(
  attacker: BattleUnit,
  target: BattleUnit
): number {
  let threat = 0;

  // Dano potencial do alvo (combat)
  threat += target.combat * 2;

  // Alvos tanky são menos urgentes (vão demorar para matar)
  threat -= target.resistance * 0.5;

  // Alvos com HP baixo são menos ameaçadores
  const hpPercent = target.currentHp / target.maxHp;
  threat *= hpPercent;

  // Alvos próximos são mais ameaçadores
  const distance = manhattanDistance(
    { x: attacker.posX, y: attacker.posY },
    { x: target.posX, y: target.posY }
  );
  if (distance <= 1) threat *= 1.5;
  else if (distance <= 2) threat *= 1.2;

  return threat;
}

/**
 * Avalia se a unidade consegue derrotar o alvo
 * Considera: combat vs resistance/HP, chance de acerto
 */
export function canDefeatTarget(
  attacker: BattleUnit,
  target: BattleUnit,
  turnsToKill: number = 3
): boolean {
  // Dano estimado por ataque (combat - resistance, mínimo 1)
  const estimatedDamage = Math.max(1, attacker.combat - target.resistance);

  // Ataques necessários para matar
  const attacksNeeded = Math.ceil(target.currentHp / estimatedDamage);

  return attacksNeeded <= turnsToKill;
}

/**
 * Calcula score de prioridade de um alvo baseado em vários fatores
 * ATUALIZADO: Considera visão e atributos da unidade
 */
export function calculateTargetScore(
  attacker: BattleUnit,
  target: BattleUnit,
  behavior: AIBehaviorType,
  attackRange: number
): TargetScore {
  const distance = manhattanDistance(
    { x: attacker.posX, y: attacker.posY },
    { x: target.posX, y: target.posY }
  );

  const canAttack = distance <= attackRange;
  const inVision = isInVision(attacker, target);
  let score = 0;

  // Se não está na visão, penalidade severa mas ainda considera
  if (!inVision) {
    score -= 100;
  }

  // Base score: HP baixo = alvo mais atrativo
  const hpPercentage = target.currentHp / target.maxHp;
  score += (1 - hpPercentage) * 30; // Até 30 pontos por HP baixo

  // Bonus por estar ao alcance
  if (canAttack) {
    score += 50;
  }

  // Penalidade por distância
  score -= distance * 2;

  // === CONSIDERAÇÕES DE ATRIBUTOS ===

  // Priorizar alvos que podemos derrotar rapidamente
  if (canDefeatTarget(attacker, target, 2)) {
    score += 25; // Podemos matar em 2 turnos
  } else if (canDefeatTarget(attacker, target, 4)) {
    score += 10; // Podemos matar em 4 turnos
  }

  // Se nosso combat é alto, podemos enfrentar alvos mais tanky
  if (attacker.combat >= target.resistance + 5) {
    score += 10; // Temos vantagem de dano
  }

  // Se nosso resistance é baixo, evitar alvos com alto combat
  if (attacker.resistance < target.combat - 3) {
    score -= 15; // Alvo perigoso para nós
  }

  // === AJUSTES POR COMPORTAMENTO ===
  switch (behavior) {
    case "AGGRESSIVE":
      // Agressivo prefere alvos fracos que pode matar
      if (hpPercentage < 0.3) score += 25;
      // Bônus por ameaça alta (quer eliminar perigos)
      score += evaluateThreatLevel(attacker, target) * 0.5;
      break;

    case "TACTICAL":
      // Tático prioriza por ameaça real
      score += evaluateThreatLevel(attacker, target);
      // Penaliza alvos muito tanky
      if (target.resistance > attacker.combat) score -= 20;
      break;

    case "RANGED":
      // Ranged prefere alvos distantes que ainda pode alcançar
      if (distance >= 2 && canAttack) score += 20;
      // Prefere alvos com baixo resistance (mais fáceis de danificar)
      score += (10 - target.resistance) * 2;
      break;

    case "SUPPORT":
      // Support geralmente não ataca, mas se precisar...
      score -= 15;
      // Só ataca alvos muito fracos
      if (hpPercentage > 0.5) score -= 20;
      break;

    case "DEFENSIVE":
      // Defensivo prefere alvos próximos (contra-ataque)
      if (distance <= 1) score += 20;
      else if (distance <= 2) score += 10;
      break;
  }

  return {
    unit: target,
    score,
    distance,
    canReach: true, // Simplificado por enquanto
    canAttack,
    inVision,
  };
}

/**
 * Seleciona o melhor alvo para atacar
 * PRIORIZA alvos visíveis, mas retorna não-visíveis se não há opção
 */
export function selectBestTarget(
  attacker: BattleUnit,
  allUnits: BattleUnit[],
  profile: AIProfile,
  attackRange: number
): BattleUnit | null {
  // Primeiro, tentar inimigos visíveis
  const visibleEnemies = getVisibleEnemies(attacker, allUnits);

  if (visibleEnemies.length > 0) {
    const scores = visibleEnemies.map((enemy) =>
      calculateTargetScore(attacker, enemy, profile.behavior, attackRange)
    );
    scores.sort((a, b) => b.score - a.score);
    return scores[0].unit;
  }

  // Se não há inimigos visíveis, considerar todos (para exploração)
  const allEnemies = getEnemies(attacker, allUnits);
  if (allEnemies.length === 0) return null;

  // Retornar o mais próximo para perseguir
  let nearest: BattleUnit | null = null;
  let minDistance = Infinity;

  for (const enemy of allEnemies) {
    const distance = manhattanDistance(
      { x: attacker.posX, y: attacker.posY },
      { x: enemy.posX, y: enemy.posY }
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearest = enemy;
    }
  }

  return nearest;
}

/**
 * Verifica se a unidade deve explorar (nenhum alvo visível)
 */
export function shouldExplore(
  unit: BattleUnit,
  allUnits: BattleUnit[]
): boolean {
  const visibleEnemies = getVisibleEnemies(unit, allUnits);
  return visibleEnemies.length === 0;
}

/**
 * Calcula a melhor direção de exploração
 * Baseado na última posição conhecida de inimigos ou centro do mapa
 */
export function getExplorationTarget(
  unit: BattleUnit,
  allUnits: BattleUnit[],
  gridWidth: number,
  gridHeight: number
): Position {
  const enemies = getEnemies(unit, allUnits);

  if (enemies.length > 0) {
    // Mover em direção ao inimigo mais próximo (mesmo fora da visão)
    let nearestEnemy = enemies[0];
    let minDistance = Infinity;

    for (const enemy of enemies) {
      const distance = manhattanDistance(
        { x: unit.posX, y: unit.posY },
        { x: enemy.posX, y: enemy.posY }
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestEnemy = enemy;
      }
    }

    return { x: nearestEnemy.posX, y: nearestEnemy.posY };
  }

  // Se não há inimigos conhecidos, ir para o centro do mapa
  return {
    x: Math.floor(gridWidth / 2),
    y: Math.floor(gridHeight / 2),
  };
}

/**
 * Seleciona aliado mais necessitado de cura/buff
 */
export function selectBestAllyForSupport(
  supporter: BattleUnit,
  allUnits: BattleUnit[],
  supportRange: number
): BattleUnit | null {
  const allies = getAllies(supporter, allUnits);
  if (allies.length === 0) return null;

  // Priorizar aliados com HP baixo
  const alliesWithScores = allies.map((ally) => {
    const distance = manhattanDistance(
      { x: supporter.posX, y: supporter.posY },
      { x: ally.posX, y: ally.posY }
    );
    const hpPercentage = ally.currentHp / ally.maxHp;
    const canReach = distance <= supportRange;

    // Score: quanto menor o HP, maior a prioridade
    let score = (1 - hpPercentage) * 100;
    if (canReach) score += 50;
    score -= distance;

    return { ally, score, distance, canReach };
  });

  // Ordenar por score
  alliesWithScores.sort((a, b) => b.score - a.score);

  return alliesWithScores.length > 0 ? alliesWithScores[0].ally : null;
}

/**
 * Encontra o inimigo mais próximo
 */
export function findNearestEnemy(
  unit: BattleUnit,
  allUnits: BattleUnit[]
): BattleUnit | null {
  const enemies = getEnemies(unit, allUnits);
  if (enemies.length === 0) return null;

  let nearest: BattleUnit | null = null;
  let minDistance = Infinity;

  for (const enemy of enemies) {
    const distance = manhattanDistance(
      { x: unit.posX, y: unit.posY },
      { x: enemy.posX, y: enemy.posY }
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearest = enemy;
    }
  }

  return nearest;
}

/**
 * Encontra o aliado mais próximo
 */
export function findNearestAlly(
  unit: BattleUnit,
  allUnits: BattleUnit[]
): BattleUnit | null {
  const allies = getAllies(unit, allUnits);
  if (allies.length === 0) return null;

  let nearest: BattleUnit | null = null;
  let minDistance = Infinity;

  for (const ally of allies) {
    const distance = manhattanDistance(
      { x: unit.posX, y: unit.posY },
      { x: ally.posX, y: ally.posY }
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearest = ally;
    }
  }

  return nearest;
}

/**
 * Verifica se a unidade está em perigo (HP baixo ou cercada)
 * ATUALIZADO: Considera atributos da unidade
 */
export function isUnitInDanger(
  unit: BattleUnit,
  allUnits: BattleUnit[],
  dangerThreshold: number = 0.3
): boolean {
  // HP baixo baseado no threshold
  if (unit.currentHp / unit.maxHp <= dangerThreshold) {
    return true;
  }

  // Verificar inimigos próximos
  const enemies = getEnemies(unit, allUnits);
  const nearbyEnemies = enemies.filter(
    (e) =>
      manhattanDistance(
        { x: unit.posX, y: unit.posY },
        { x: e.posX, y: e.posY }
      ) <= 2
  );

  // Calcular dano potencial dos inimigos próximos
  let totalThreat = 0;
  for (const enemy of nearbyEnemies) {
    const potentialDamage = Math.max(1, enemy.combat - unit.resistance);
    totalThreat += potentialDamage;
  }

  // Se dano potencial é maior que HP atual, está em perigo
  if (totalThreat >= unit.currentHp) {
    return true;
  }

  // Se muitos inimigos próximos (considerando nossa defesa)
  // Unidades com resistance alto aguentam mais pressão
  const maxSafeEnemies = Math.max(1, Math.floor(unit.resistance / 3) + 1);
  return nearbyEnemies.length > maxSafeEnemies;
}

/**
 * Conta quantos inimigos podem atacar uma posição
 */
export function countThreatsAtPosition(
  pos: Position,
  enemies: BattleUnit[],
  enemyAttackRange: number = 1
): number {
  return enemies.filter(
    (e) => manhattanDistance(pos, { x: e.posX, y: e.posY }) <= enemyAttackRange
  ).length;
}
