// src/utils/items.generator.ts
import { GeneratedItem, ItemRarity } from "@boundless/shared/types";
import { AttributeKey } from "@boundless/shared/config";

function randomId(): string {
  // Simple UUID v4-like generator
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const BASE_TYPES: Array<{ type: string; attribute: AttributeKey }> = [
  { type: "Espada", attribute: "combat" },
  { type: "Machado", attribute: "combat" },
  { type: "Arco", attribute: "speed" },
  { type: "Adaga", attribute: "speed" },
  { type: "Tomo", attribute: "focus" },
  { type: "Cajado", attribute: "focus" },
  { type: "Manto", attribute: "resistance" },
  { type: "Escudo", attribute: "resistance" },
  { type: "Amuleto", attribute: "vitality" },
  { type: "Anel", attribute: "vitality" },
];

const NAME_PREFIXES = [
  "Bravura",
  "Sombras",
  "Aurora",
  "Tempestade",
  "Eterna",
  "Sanguínea",
  "Espectral",
  "Arcana",
  "Gélida",
  "Trovão",
];

const NAME_SUFFIXES = [
  "do Campeão",
  "do Arcanista",
  "do Caçador",
  "do Guardião",
  "do Regente",
  "do Lobo",
  "da Fênix",
  "do Dragão",
  "da Escuridão",
  "da Luz",
];

const DESCRIPTIONS = [
  "Forjada por artesãos lendários, exala um poder antigo.",
  "Brilha sob a lua, sussurrando promessas de vitória.",
  "Leve, porém resistente, perfeita para mãos habilidosas.",
  "Imbuída de magia esquiva, responde ao chamado do portador.",
  "Fria ao toque, ecoa o silêncio das neves eternas.",
  "Marcas de batalha contam histórias de conquistas perdidas.",
];

const RARITIES: ItemRarity[] = [
  "COMMON",
  "UNCOMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
];

const RARITY_BASE: Record<ItemRarity, number> = {
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
  EPIC: 4,
  LEGENDARY: 5,
};

export function generateRandomItem(): GeneratedItem {
  const base = BASE_TYPES[Math.floor(Math.random() * BASE_TYPES.length)];
  const rarity = RARITIES[Math.floor(Math.random() * RARITIES.length)];
  const magical = Math.random() < 0.25; // 25% chance
  const baseAmount = RARITY_BASE[rarity];
  const amount = magical ? baseAmount * 2 : baseAmount;
  const prefix =
    NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
  const suffix =
    NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)];
  const description =
    DESCRIPTIONS[Math.floor(Math.random() * DESCRIPTIONS.length)];

  const name = `${base.type} ${prefix} ${suffix}${magical ? " (Mágica)" : ""}`;

  return {
    id: randomId(),
    name,
    type: base.type,
    description,
    rarity,
    magical,
    boost: { attribute: base.attribute, amount },
  };
}

export function generateItems(count: number): GeneratedItem[] {
  return Array.from({ length: Math.max(0, count) }, generateRandomItem);
}
