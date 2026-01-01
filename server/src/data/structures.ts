// src/data/structures.ts
import { ResourceType } from "../types";

interface StructureDefinition {
  id: string;
  name: string;
  icon: string; // Caminho para o PNG do ícone (relativo a assets/)
  color: number;
  maxHp: number;
  resourceGenerated?: ResourceType;
  resourceIcon?: string; // Ícone do recurso gerado
  specialEffect?: string;
  isCapital?: boolean; // Não pode ser construída manualmente
}

export const STRUCTURE_DEFINITIONS: Record<string, StructureDefinition> = {
  CITADEL: {
    id: "CITADEL",
    name: "Cidadela",
    icon: "Fortaleza.png",
    color: 0xffd700,
    maxHp: 100,
    specialEffect: "O coração do seu reino. Se cair, você perde.",
    isCapital: true,
  },
  MINE: {
    id: "MINE",
    name: "Mina",
    icon: "Minério.png",
    color: 0x6c757d,
    maxHp: 30,
    resourceGenerated: "ore",
    resourceIcon: "Minério.png",
  },
  FARM: {
    id: "FARM",
    name: "Fazenda",
    icon: "Suprimento.png",
    color: 0x7cb518,
    maxHp: 20,
    resourceGenerated: "supplies",
    resourceIcon: "Suprimento.png",
  },
  FORTRESS: {
    id: "FORTRESS",
    name: "Fortaleza",
    icon: "Fortaleza.png",
    color: 0x8b4513,
    maxHp: 80,
    specialEffect: "Unidades aliadas neste território recebem +2 de Armadura.",
  },
  SHRINE: {
    id: "SHRINE",
    name: "Santuário",
    icon: "Devocao.png",
    color: 0x9b59b6,
    maxHp: 25,
    resourceGenerated: "devotion",
    resourceIcon: "Devocao.png",
  },
  LIBRARY: {
    id: "LIBRARY",
    name: "Biblioteca Arcana",
    icon: "Arcana.png",
    color: 0x3498db,
    maxHp: 20,
    resourceGenerated: "arcane",
    resourceIcon: "Arcana.png",
  },
  ARENA: {
    id: "ARENA",
    name: "Fosso de Combate",
    icon: "Experiencia.png",
    color: 0xe74c3c,
    maxHp: 40,
    resourceGenerated: "experience",
    resourceIcon: "Experiencia.png",
  },
};

// Lista de estruturas disponíveis para construção (exclui CITADEL)
export const BUILDABLE_STRUCTURES = Object.values(STRUCTURE_DEFINITIONS).filter(
  (s) => !s.isCapital
);
