// shared/data/targeting-patterns.data.ts
// Padrões de targeting predefinidos baseados em coordenadas
// Uso: targetingPattern: PATTERNS.CROSS_3 em AbilityDefinition

import type {
  CoordinatePattern,
  PatternCoordinate,
} from "../types/ability.types";

// =============================================================================
// FUNÇÕES HELPER PARA CRIAR PATTERNS
// =============================================================================

/**
 * Cria um padrão de linha horizontal/vertical
 * @param length Comprimento da linha (a partir da origem, não incluindo)
 * @param includeOrigin Se inclui a célula de origem
 */
export function createLinePattern(
  length: number,
  includeOrigin: boolean = false
): PatternCoordinate[] {
  const coords: PatternCoordinate[] = [];
  if (includeOrigin) {
    coords.push({ x: 0, y: 0 });
  }
  // Linha na direção "norte" (y negativo) - será rotacionada conforme necessário
  for (let i = 1; i <= length; i++) {
    coords.push({ x: 0, y: -i });
  }
  return coords;
}

/**
 * Cria um padrão de cruz (+)
 * @param radius Raio da cruz (distância do centro às pontas)
 * @param includeCenter Se inclui o centro
 */
export function createCrossPattern(
  radius: number,
  includeCenter: boolean = true
): PatternCoordinate[] {
  const coords: PatternCoordinate[] = [];
  if (includeCenter) {
    coords.push({ x: 0, y: 0 });
  }
  for (let i = 1; i <= radius; i++) {
    coords.push({ x: 0, y: -i }); // Norte
    coords.push({ x: 0, y: i }); // Sul
    coords.push({ x: -i, y: 0 }); // Oeste
    coords.push({ x: i, y: 0 }); // Leste
  }
  return coords;
}

/**
 * Cria um padrão de diamante (distância Manhattan)
 * @param radius Raio do diamante
 * @param includeCenter Se inclui o centro
 */
export function createDiamondPattern(
  radius: number,
  includeCenter: boolean = true
): PatternCoordinate[] {
  const coords: PatternCoordinate[] = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const distance = Math.abs(dx) + Math.abs(dy);
      if (distance > radius) continue;
      if (!includeCenter && dx === 0 && dy === 0) continue;
      coords.push({ x: dx, y: dy });
    }
  }
  return coords;
}

/**
 * Cria um padrão de quadrado (distância Chebyshev)
 * @param size Tamanho do lado (deve ser ímpar para centralizar)
 * @param includeCenter Se inclui o centro
 */
export function createSquarePattern(
  size: number,
  includeCenter: boolean = true
): PatternCoordinate[] {
  const coords: PatternCoordinate[] = [];
  const halfSize = Math.floor(size / 2);
  for (let dx = -halfSize; dx <= halfSize; dx++) {
    for (let dy = -halfSize; dy <= halfSize; dy++) {
      if (!includeCenter && dx === 0 && dy === 0) continue;
      coords.push({ x: dx, y: dy });
    }
  }
  return coords;
}

/**
 * Cria um padrão de cone (expande na direção)
 * @param length Comprimento do cone
 * @param startWidth Largura inicial (1 = uma célula)
 * @param expansion Quanto expande por linha (1 = +1 célula por lado)
 */
export function createConePattern(
  length: number,
  startWidth: number = 1,
  expansion: number = 1
): PatternCoordinate[] {
  const coords: PatternCoordinate[] = [];
  let width = startWidth;

  for (let i = 1; i <= length; i++) {
    const halfWidth = Math.floor(width / 2);
    for (let dx = -halfWidth; dx <= halfWidth; dx++) {
      coords.push({ x: dx, y: -i }); // Aponta para norte, será rotacionado
    }
    width += expansion * 2; // Expande dos dois lados
  }
  return coords;
}

/**
 * Cria um padrão de anel (ring)
 * @param innerRadius Raio interno (vazio)
 * @param outerRadius Raio externo
 */
export function createRingPattern(
  innerRadius: number,
  outerRadius: number
): PatternCoordinate[] {
  const coords: PatternCoordinate[] = [];
  for (let dx = -outerRadius; dx <= outerRadius; dx++) {
    for (let dy = -outerRadius; dy <= outerRadius; dy++) {
      const distance = Math.abs(dx) + Math.abs(dy);
      if (distance >= innerRadius && distance <= outerRadius) {
        coords.push({ x: dx, y: dy });
      }
    }
  }
  return coords;
}

// =============================================================================
// PADRÕES BÁSICOS (SINGLE, SELF)
// =============================================================================

/** Alvo único - apenas a célula clicada */
export const SINGLE: CoordinatePattern = {
  name: "SINGLE",
  origin: "TARGET",
  coordinates: [{ x: 0, y: 0 }],
  rotatable: false,
  isProjectile: true, // Alvo único é interceptável
  visualPreview: `
    X
  `,
};

/** Self - apenas o próprio caster */
export const SELF: CoordinatePattern = {
  name: "SELF",
  origin: "CASTER",
  coordinates: [{ x: 0, y: 0 }],
  rotatable: false,
  isProjectile: false, // Self não é interceptável
  visualPreview: `
    O (caster)
  `,
};

// =============================================================================
// PADRÕES DE LINHA (DIRECIONAIS)
// =============================================================================

/** Linha de 2 células */
export const LINE_2: CoordinatePattern = {
  name: "LINE_2",
  origin: "DIRECTION",
  coordinates: createLinePattern(2),
  rotatable: true,
  isProjectile: true, // Linha é projétil que percorre células
  projectileOrder: "DISTANCE",
  visualPreview: `
    X
    X
    O (caster)
  `,
};

/** Linha de 3 células */
export const LINE_3: CoordinatePattern = {
  name: "LINE_3",
  origin: "DIRECTION",
  coordinates: createLinePattern(3),
  rotatable: true,
  isProjectile: true,
  projectileOrder: "DISTANCE",
  visualPreview: `
    X
    X
    X
    O (caster)
  `,
};

/** Linha de 4 células */
export const LINE_4: CoordinatePattern = {
  name: "LINE_4",
  origin: "DIRECTION",
  coordinates: createLinePattern(4),
  rotatable: true,
  isProjectile: true,
  projectileOrder: "DISTANCE",
  visualPreview: `
    X
    X
    X
    X
    O (caster)
  `,
};

/** Linha de 5 células */
export const LINE_5: CoordinatePattern = {
  name: "LINE_5",
  origin: "DIRECTION",
  coordinates: createLinePattern(5),
  rotatable: true,
  isProjectile: true,
  projectileOrder: "DISTANCE",
  visualPreview: `
    X
    X
    X
    X
    X
    O (caster)
  `,
};

// =============================================================================
// PADRÕES DE CRUZ
// =============================================================================

/** Cruz de raio 1 (5 células) */
export const CROSS_1: CoordinatePattern = {
  name: "CROSS_1",
  origin: "TARGET",
  coordinates: createCrossPattern(1, true),
  rotatable: false,
  isProjectile: false, // Área afeta tudo simultaneamente
  visualPreview: `
      X
    X X X
      X
  `,
};

/** Cruz de raio 2 (9 células) */
export const CROSS_2: CoordinatePattern = {
  name: "CROSS_2",
  origin: "TARGET",
  coordinates: createCrossPattern(2, true),
  rotatable: false,
  isProjectile: false,
  visualPreview: `
        X
        X
    X X X X X
        X
        X
  `,
};

/** Cruz de raio 3 (13 células) */
export const CROSS_3: CoordinatePattern = {
  name: "CROSS_3",
  origin: "TARGET",
  coordinates: createCrossPattern(3, true),
  rotatable: false,
  isProjectile: false,
  visualPreview: `
          X
          X
          X
    X X X X X X X
          X
          X
          X
  `,
};

// =============================================================================
// PADRÕES DE DIAMANTE (ÁREA MANHATTAN)
// =============================================================================

/** Diamante de raio 1 (5 células) - mesmo que CROSS_1 */
export const DIAMOND_1: CoordinatePattern = {
  name: "DIAMOND_1",
  origin: "TARGET",
  coordinates: createDiamondPattern(1, true),
  rotatable: false,
  isProjectile: false, // Área afeta tudo simultaneamente
  visualPreview: `
      X
    X X X
      X
  `,
};

/** Diamante de raio 2 (13 células) */
export const DIAMOND_2: CoordinatePattern = {
  name: "DIAMOND_2",
  origin: "TARGET",
  coordinates: createDiamondPattern(2, true),
  rotatable: false,
  isProjectile: false,
  visualPreview: `
        X
      X X X
    X X X X X
      X X X
        X
  `,
};

/** Diamante de raio 3 (25 células) */
export const DIAMOND_3: CoordinatePattern = {
  name: "DIAMOND_3",
  origin: "TARGET",
  coordinates: createDiamondPattern(3, true),
  rotatable: false,
  isProjectile: false,
  visualPreview: `
          X
        X X X
      X X X X X
    X X X X X X X
      X X X X X
        X X X
          X
  `,
};

// =============================================================================
// PADRÕES DE QUADRADO (ÁREA CHEBYSHEV)
// =============================================================================

/** Quadrado 3x3 (9 células) */
export const SQUARE_3: CoordinatePattern = {
  name: "SQUARE_3",
  origin: "TARGET",
  coordinates: createSquarePattern(3, true),
  rotatable: false,
  isProjectile: false, // Área afeta tudo simultaneamente
  visualPreview: `
    X X X
    X X X
    X X X
  `,
};

/** Quadrado 5x5 (25 células) */
export const SQUARE_5: CoordinatePattern = {
  name: "SQUARE_5",
  origin: "TARGET",
  coordinates: createSquarePattern(5, true),
  rotatable: false,
  isProjectile: false,
  visualPreview: `
    X X X X X
    X X X X X
    X X X X X
    X X X X X
    X X X X X
  `,
};

// =============================================================================
// PADRÕES DE CONE (DIRECIONAIS)
// =============================================================================

/** Cone pequeno (3 linhas, expande 1 por linha) */
export const CONE_SMALL: CoordinatePattern = {
  name: "CONE_SMALL",
  origin: "DIRECTION",
  coordinates: createConePattern(3, 1, 1),
  rotatable: true,
  isProjectile: true, // Cone é projétil direcional
  projectileOrder: "DISTANCE",
  piercing: true, // Atinge todos no cone
  visualPreview: `
    X X X X X
      X X X
        X
        O (caster)
  `,
};

/** Cone médio (4 linhas) */
export const CONE_MEDIUM: CoordinatePattern = {
  name: "CONE_MEDIUM",
  origin: "DIRECTION",
  coordinates: createConePattern(4, 1, 1),
  rotatable: true,
  isProjectile: true,
  projectileOrder: "DISTANCE",
  piercing: true,
  visualPreview: `
    X X X X X X X
      X X X X X
        X X X
          X
          O (caster)
  `,
};

/** Cone grande (5 linhas) */
export const CONE_LARGE: CoordinatePattern = {
  name: "CONE_LARGE",
  origin: "DIRECTION",
  coordinates: createConePattern(5, 1, 1),
  rotatable: true,
  isProjectile: true,
  projectileOrder: "DISTANCE",
  piercing: true,
  visualPreview: `
    X X X X X X X X X
      X X X X X X X
        X X X X X
          X X X
            X
            O (caster)
  `,
};

// =============================================================================
// PADRÕES DE ANEL (RING)
// =============================================================================

/** Anel de raio 1 (8 células ao redor) */
export const RING_1: CoordinatePattern = {
  name: "RING_1",
  origin: "CASTER",
  coordinates: createRingPattern(1, 1),
  rotatable: false,
  includeOrigin: false,
  isProjectile: false, // Shockwave afeta tudo ao redor simultaneamente
  visualPreview: `
    X X X
    X O X
    X X X
  `,
};

/** Anel de raio 2 */
export const RING_2: CoordinatePattern = {
  name: "RING_2",
  origin: "CASTER",
  coordinates: createRingPattern(2, 2),
  rotatable: false,
  includeOrigin: false,
  isProjectile: false,
  visualPreview: `
        X
      X . X
    X . O . X
      X . X
        X
  `,
};

// =============================================================================
// PADRÕES ESPECIAIS (CUSTOMIZADOS)
// =============================================================================

/** Formato T (5+2) */
export const T_SHAPE: CoordinatePattern = {
  name: "T_SHAPE",
  origin: "DIRECTION",
  coordinates: [
    // Barra horizontal (perpendicular à direção)
    { x: -2, y: -1 },
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: 2, y: -1 },
    // Haste na direção
    { x: 0, y: -2 },
    { x: 0, y: -3 },
  ],
  rotatable: true,
  isProjectile: true,
  projectileOrder: "DISTANCE",
  piercing: true, // Atinge todos na forma T
  visualPreview: `
          X
          X
    X X X X X
          O (caster)
  `,
};

/** Formato L */
export const L_SHAPE: CoordinatePattern = {
  name: "L_SHAPE",
  origin: "DIRECTION",
  coordinates: [
    { x: 0, y: -1 },
    { x: 0, y: -2 },
    { x: 0, y: -3 },
    { x: 1, y: -1 },
    { x: 2, y: -1 },
  ],
  rotatable: true,
  isProjectile: true,
  projectileOrder: "DISTANCE",
  piercing: true,
  visualPreview: `
        X
        X
        X X X
        O (caster)
  `,
};

/** Formato X (diagonal) */
export const X_SHAPE: CoordinatePattern = {
  name: "X_SHAPE",
  origin: "TARGET",
  coordinates: [
    { x: 0, y: 0 },
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: 1, y: 1 },
    { x: -2, y: -2 },
    { x: 2, y: -2 },
    { x: -2, y: 2 },
    { x: 2, y: 2 },
  ],
  rotatable: false,
  isProjectile: false, // Explosão instantânea
  visualPreview: `
    X . . . X
    . X . X .
    . . X . .
    . X . X .
    X . . . X
  `,
};

/** Adjacentes (8 células ao redor, sem o centro) */
export const ADJACENT: CoordinatePattern = {
  name: "ADJACENT",
  origin: "CASTER",
  coordinates: [
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
  rotatable: false,
  includeOrigin: false,
  isProjectile: false,
  visualPreview: `
    X X X
    X O X
    X X X
  `,
};

/** Melee (apenas células ortogonais adjacentes - 4 células) */
export const MELEE: CoordinatePattern = {
  name: "MELEE",
  origin: "CASTER",
  coordinates: [
    { x: 0, y: -1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ],
  rotatable: false,
  includeOrigin: false,
  maxRange: 1,
  isProjectile: false,
  visualPreview: `
      X
    X O X
      X
  `,
};

/** Frente (3 células à frente) */
export const FRONT_3: CoordinatePattern = {
  name: "FRONT_3",
  origin: "DIRECTION",
  coordinates: [
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
  ],
  rotatable: true,
  isProjectile: true,
  projectileOrder: "DISTANCE",
  piercing: true,
  visualPreview: `
    X X X
      O (caster)
  `,
};

/** Wave (onda - 2 linhas à frente) */
export const WAVE: CoordinatePattern = {
  name: "WAVE",
  origin: "DIRECTION",
  coordinates: [
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: -2, y: -2 },
    { x: -1, y: -2 },
    { x: 0, y: -2 },
    { x: 1, y: -2 },
    { x: 2, y: -2 },
  ],
  rotatable: true,
  isProjectile: true,
  projectileOrder: "DISTANCE",
  piercing: true,
  visualPreview: `
    X X X X X
      X X X
        O (caster)
  `,
};

// =============================================================================
// PADRÕES DE VIAGEM + EXPLOSÃO (PROJECTILE WITH AOE)
// =============================================================================

/**
 * Bola de Fogo - viaja até o ponto e explode em 3x3
 * Uso: FIRE spell
 */
export const FIREBALL: CoordinatePattern = {
  name: "FIREBALL",
  origin: "TARGET",
  // Coordenadas da explosão (aplicadas no ponto de impacto)
  coordinates: createSquarePattern(3, true), // 3x3
  rotatable: false,
  isProjectile: false, // A explosão não é projétil
  stopsOnUnit: true, // Projétil para em unidade
  stopsOnObstacle: true, // Projétil para em obstáculo
  // Explosão usa o próprio pattern (pode ser sobrescrito)
  explosionPattern: {
    name: "FIREBALL_EXPLOSION",
    origin: "TARGET",
    coordinates: createSquarePattern(3, true),
    rotatable: false,
    isProjectile: false,
  },
  visualPreview: `
    Viaja: O------>X
    Explode:
    X X X
    X X X
    X X X
  `,
};

/**
 * Meteoro - viaja e explode em área maior (5x5)
 * Uso: Meteor spell
 */
export const METEOR: CoordinatePattern = {
  name: "METEOR",
  origin: "TARGET",
  coordinates: createSquarePattern(5, true), // 5x5
  rotatable: false,
  isProjectile: false,
  stopsOnUnit: false, // Não para em unidades
  stopsOnObstacle: true, // Para em obstáculos grandes
  explosionPattern: {
    name: "METEOR_EXPLOSION",
    origin: "TARGET",
    coordinates: createSquarePattern(5, true),
    rotatable: false,
    isProjectile: false,
  },
  visualPreview: `
    Viaja: O------>X
    Explode:
    X X X X X
    X X X X X
    X X X X X
    X X X X X
    X X X X X
  `,
};

/**
 * Flecha Explosiva - viaja em linha e explode em cruz pequena
 * Uso: Explosive Arrow skill
 */
export const EXPLOSIVE_ARROW: CoordinatePattern = {
  name: "EXPLOSIVE_ARROW",
  origin: "TARGET",
  coordinates: createCrossPattern(1, true), // Cruz 1
  rotatable: false,
  isProjectile: false,
  stopsOnUnit: true,
  stopsOnObstacle: true,
  explosionPattern: {
    name: "EXPLOSIVE_ARROW_EXPLOSION",
    origin: "TARGET",
    coordinates: createCrossPattern(1, true),
    rotatable: false,
    isProjectile: false,
  },
  visualPreview: `
    Viaja: O------>X
    Explode:
      X
    X X X
      X
  `,
};

/**
 * Lança Penetrante - viaja através de unidades e não explode
 * Uso: Pierce skill (projétil piercing sem explosão)
 */
export const PIERCING_PROJECTILE: CoordinatePattern = {
  name: "PIERCING_PROJECTILE",
  origin: "CASTER",
  coordinates: createLinePattern(6, false),
  rotatable: true,
  isProjectile: true,
  projectileOrder: "DISTANCE",
  piercing: true, // Atravessa unidades
  stopsOnUnit: false, // Não para em unidades
  stopsOnObstacle: true, // Para em obstáculos
  visualPreview: `
    O -> X -> X -> X (atravessa todos)
  `,
};

// =============================================================================
// EXPORT CONSOLIDADO DE TODOS OS PATTERNS
// =============================================================================

export const PATTERNS = {
  // Básicos
  SINGLE,
  SELF,

  // Linhas
  LINE_2,
  LINE_3,
  LINE_4,
  LINE_5,

  // Cruzes
  CROSS_1,
  CROSS_2,
  CROSS_3,

  // Diamantes
  DIAMOND_1,
  DIAMOND_2,
  DIAMOND_3,

  // Quadrados
  SQUARE_3,
  SQUARE_5,

  // Cones
  CONE_SMALL,
  CONE_MEDIUM,
  CONE_LARGE,

  // Anéis
  RING_1,
  RING_2,

  // Especiais
  T_SHAPE,
  L_SHAPE,
  X_SHAPE,
  ADJACENT,
  MELEE,
  FRONT_3,
  WAVE,

  // Viagem + Explosão
  FIREBALL,
  METEOR,
  EXPLOSIVE_ARROW,
  PIERCING_PROJECTILE,
} as const;

export type PatternName = keyof typeof PATTERNS;

/**
 * Busca um pattern pelo nome
 */
export function getPatternByName(name: PatternName): CoordinatePattern {
  return PATTERNS[name];
}

/**
 * Cria um pattern customizado a partir de uma string visual
 * Exemplo:
 * ```
 * createPatternFromVisual(`
 *   . X .
 *   X X X
 *   . O .
 * `)
 * ```
 * O = origem (caster)
 * X = célula afetada
 * . = célula vazia
 */
export function createPatternFromVisual(
  visual: string,
  origin: CoordinatePattern["origin"] = "CASTER",
  rotatable: boolean = false
): CoordinatePattern {
  const lines = visual
    .trim()
    .split("\n")
    .map((line) => line.trim());
  const coordinates: PatternCoordinate[] = [];

  let originX = 0;
  let originY = 0;

  // Encontrar a origem (O) primeiro
  for (let y = 0; y < lines.length; y++) {
    const chars = lines[y].split(/\s+/);
    for (let x = 0; x < chars.length; x++) {
      if (chars[x].toUpperCase() === "O") {
        originX = x;
        originY = y;
        break;
      }
    }
  }

  // Coletar coordenadas relativas
  for (let y = 0; y < lines.length; y++) {
    const chars = lines[y].split(/\s+/);
    for (let x = 0; x < chars.length; x++) {
      if (chars[x].toUpperCase() === "X") {
        coordinates.push({
          x: x - originX,
          y: y - originY,
        });
      }
    }
  }

  return {
    origin,
    coordinates,
    rotatable,
    visualPreview: visual,
  };
}
