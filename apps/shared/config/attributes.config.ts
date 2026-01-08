// shared/config/attributes.config.ts
// Configuração de atributos de unidades
// IDs numéricos são imutáveis - nomes/keys podem mudar sem afetar o código

// =============================================================================
// TIPOS
// =============================================================================

/** ID numérico do atributo (1-6) */
export type AttributeId = 1 | 2 | 3 | 4 | 5 | 6;

/** Key string do atributo (pode mudar) */
export type AttributeKey =
  | "combat"
  | "speed"
  | "focus"
  | "resistance"
  | "will"
  | "vitality";

export type AttributeName = AttributeKey;

export interface AttributeStyle {
  color: string;
  colorDark: string;
  borderColor: string;
  glowColor: string;
}

export interface AttributeDefinition {
  id: AttributeId;
  key: AttributeKey;
  name: string;
  shortName: string;
  description: string;
  style: AttributeStyle;
}

export interface UnitAttributes {
  combat: number;
  speed: number;
  focus: number;
  resistance: number;
  will: number;
  vitality: number;
}

// =============================================================================
// DEFINIÇÕES DOS ATRIBUTOS (por ID numérico)
// =============================================================================

export const ATTRIBUTES: Record<AttributeId, AttributeDefinition> = {
  1: {
    id: 1,
    key: "combat",
    name: "Combate",
    shortName: "COM",
    description: "Determina dados de ataque e dano.",
    style: {
      color: "#dc2626",
      colorDark: "#991b1b",
      borderColor: "rgba(239,68,68,0.7)",
      glowColor: "rgba(220,38,38,0.5)",
    },
  },
  2: {
    id: 2,
    key: "speed",
    name: "Velocidade",
    shortName: "VEL",
    description: "Determina chance de esquiva e movimento.",
    style: {
      color: "#06b6d4",
      colorDark: "#0e7490",
      borderColor: "rgba(34,211,238,0.7)",
      glowColor: "rgba(6,182,212,0.5)",
    },
  },
  3: {
    id: 3,
    key: "focus",
    name: "Foco",
    shortName: "FOC",
    description: "Poder mágico. Usado para magias e determina visão.",
    style: {
      color: "#6366f1",
      colorDark: "#4338ca",
      borderColor: "rgba(129,140,248,0.7)",
      glowColor: "rgba(99,102,241,0.5)",
    },
  },
  4: {
    id: 4,
    key: "resistance",
    name: "Resistência",
    shortName: "RES",
    description: "Redução de dano físico.",
    style: {
      color: "#f97316",
      colorDark: "#c2410c",
      borderColor: "rgba(251,146,60,0.7)",
      glowColor: "rgba(249,115,22,0.5)",
    },
  },
  5: {
    id: 5,
    key: "will",
    name: "Vontade",
    shortName: "VON",
    description: "Força mental.",
    style: {
      color: "#a855f7",
      colorDark: "#7e22ce",
      borderColor: "rgba(192,132,252,0.7)",
      glowColor: "rgba(168,85,247,0.5)",
    },
  },
  6: {
    id: 6,
    key: "vitality",
    name: "Vitalidade",
    shortName: "VIT",
    description: "Pontos de vida.",
    style: {
      color: "#22c55e",
      colorDark: "#15803d",
      borderColor: "rgba(74,222,128,0.7)",
      glowColor: "rgba(34,197,94,0.5)",
    },
  },
};

// =============================================================================
// LISTAS
// =============================================================================

export const ALL_ATTRIBUTE_IDS: AttributeId[] = [1, 2, 3, 4, 5, 6];

export const ALL_ATTRIBUTE_KEYS: AttributeKey[] = ALL_ATTRIBUTE_IDS.map(
  (id) => ATTRIBUTES[id].key
);

// =============================================================================
// MAPEAMENTOS (gerados a partir de ATTRIBUTES)
// =============================================================================

export const ATTRIBUTE_ID_BY_KEY: Record<AttributeKey, AttributeId> =
  Object.fromEntries(
    ALL_ATTRIBUTE_IDS.map((id) => [ATTRIBUTES[id].key, id])
  ) as Record<AttributeKey, AttributeId>;

export const ATTRIBUTE_KEY_BY_ID: Record<AttributeId, AttributeKey> =
  Object.fromEntries(
    ALL_ATTRIBUTE_IDS.map((id) => [id, ATTRIBUTES[id].key])
  ) as Record<AttributeId, AttributeKey>;

// =============================================================================
// HELPERS
// =============================================================================

/** Obtém definição por ID */
export function getAttributeById(id: AttributeId): AttributeDefinition {
  return ATTRIBUTES[id];
}

/** Obtém definição por key */
export function getAttributeByKey(key: AttributeKey): AttributeDefinition {
  return ATTRIBUTES[ATTRIBUTE_ID_BY_KEY[key]];
}

/** Alias legado */
export function getAttributeDefinition(key: AttributeKey): AttributeDefinition {
  return getAttributeByKey(key);
}

/** Obtém nome por ID */
export function getAttributeNameById(id: AttributeId): string {
  return ATTRIBUTES[id].name;
}

/** Obtém nome por key */
export function getAttributeName(key: AttributeKey): string {
  return getAttributeByKey(key).name;
}

/** Obtém valor do atributo de uma unidade por key */
export function getAttributeValue(
  unit: UnitAttributes,
  key: AttributeName
): number {
  return unit[key] ?? 0;
}

/** Obtém valor do atributo por ID */
export function getAttributeValueById(
  unit: UnitAttributes,
  id: AttributeId
): number {
  const key = ATTRIBUTE_KEY_BY_ID[id];
  return unit[key] ?? 0;
}

// =============================================================================
// COMPATIBILIDADE LEGADA
// =============================================================================

/** @deprecated Use ATTRIBUTES[id] */
export const ATTRIBUTE_NAMES: Record<AttributeKey, AttributeDefinition> =
  Object.fromEntries(
    ALL_ATTRIBUTE_IDS.map((id) => [ATTRIBUTES[id].key, ATTRIBUTES[id]])
  ) as Record<AttributeKey, AttributeDefinition>;
