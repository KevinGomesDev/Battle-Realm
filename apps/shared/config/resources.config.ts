// shared/config/resources.config.ts
// Configuração de recursos do jogo
// IDs numéricos são imutáveis - nomes/keys podem mudar sem afetar o código

// =============================================================================
// TIPOS
// =============================================================================

/** ID numérico do recurso (1-5) */
export type ResourceId = 1 | 2 | 3 | 4 | 5;

/** Key string do recurso (pode mudar) */
export type ResourceKey =
  | "ore"
  | "supplies"
  | "arcane"
  | "experience"
  | "devotion";

export interface ResourceDefinition {
  id: ResourceId;
  key: ResourceKey;
  name: string;
  shortName: string;
  icon: string;
  description: string;
}

// =============================================================================
// DEFINIÇÕES DOS RECURSOS (por ID numérico)
// =============================================================================

export const RESOURCES: Record<ResourceId, ResourceDefinition> = {
  1: {
    id: 1,
    key: "ore",
    name: "Minério",
    shortName: "MIN",
    icon: "⛏️",
    description: "Recurso básico para construção e equipamentos.",
  },
  2: {
    id: 2,
    key: "supplies",
    name: "Suprimentos",
    shortName: "SUP",
    icon: "📦",
    description: "Mantimentos e provisões para as tropas.",
  },
  3: {
    id: 3,
    key: "arcane",
    name: "Arcano",
    shortName: "ARC",
    icon: "✨",
    description: "Energia mágica para habilidades e feitiços.",
  },
  4: {
    id: 4,
    key: "experience",
    name: "Experiência",
    shortName: "EXP",
    icon: "⭐",
    description: "Pontos de experiência para evolução.",
  },
  5: {
    id: 5,
    key: "devotion",
    name: "Devoção",
    shortName: "DEV",
    icon: "🙏",
    description: "Fé e poder divino para habilidades sagradas.",
  },
};

// =============================================================================
// LISTAS
// =============================================================================

export const ALL_RESOURCE_IDS: ResourceId[] = [1, 2, 3, 4, 5];

export const ALL_RESOURCE_KEYS: ResourceKey[] = ALL_RESOURCE_IDS.map(
  (id) => RESOURCES[id].key
);

// =============================================================================
// MAPEAMENTOS (gerados a partir de RESOURCES)
// =============================================================================

export const RESOURCE_ID_BY_KEY: Record<ResourceKey, ResourceId> =
  Object.fromEntries(
    ALL_RESOURCE_IDS.map((id) => [RESOURCES[id].key, id])
  ) as Record<ResourceKey, ResourceId>;

export const RESOURCE_KEY_BY_ID: Record<ResourceId, ResourceKey> =
  Object.fromEntries(
    ALL_RESOURCE_IDS.map((id) => [id, RESOURCES[id].key])
  ) as Record<ResourceId, ResourceKey>;

// =============================================================================
// HELPERS
// =============================================================================

/** Obtém definição por ID */
export function getResourceById(id: ResourceId): ResourceDefinition {
  return RESOURCES[id];
}

/** Obtém definição por key */
export function getResourceByKey(key: ResourceKey): ResourceDefinition {
  return RESOURCES[RESOURCE_ID_BY_KEY[key]];
}

/** Alias legado */
export function getResourceDefinition(key: ResourceKey): ResourceDefinition {
  return getResourceByKey(key);
}

/** Obtém nome por ID */
export function getResourceNameById(id: ResourceId): string {
  return RESOURCES[id].name;
}

/** Obtém nome por key */
export function getResourceName(key: ResourceKey): string {
  return getResourceByKey(key).name;
}

// =============================================================================
// COMPATIBILIDADE LEGADA
// =============================================================================

/** @deprecated Use RESOURCES[id] */
export const RESOURCE_NAMES: Record<ResourceKey, ResourceDefinition> =
  Object.fromEntries(
    ALL_RESOURCE_IDS.map((id) => [RESOURCES[id].key, RESOURCES[id]])
  ) as Record<ResourceKey, ResourceDefinition>;
