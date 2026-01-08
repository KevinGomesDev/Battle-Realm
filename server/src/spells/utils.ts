// server/src/spells/utils.ts
// Utilitários para gerenciar spells de unidades

import { prisma } from "../lib/prisma";
import { getAbilityByCode as getSpellByCode } from "../../../shared/data/abilities.data";

/**
 * Adiciona uma spell a uma unidade (persiste no banco)
 */
export async function grantSpellToUnit(
  unitId: string,
  spellCode: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Verificar se spell existe
    const spell = getSpellByCode(spellCode);
    if (!spell) {
      return {
        success: false,
        message: `Spell não encontrada: ${spellCode}`,
      };
    }

    // Buscar unidade
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, name: true, spells: true },
    });

    if (!unit) {
      return {
        success: false,
        message: "Unidade não encontrada",
      };
    }

    // Parse spells existentes
    const currentSpells: string[] = JSON.parse(unit.spells || "[]");

    // Verificar se já possui
    if (currentSpells.includes(spellCode)) {
      return {
        success: false,
        message: `${unit.name} já possui a spell ${spell.name}`,
      };
    }

    // Adicionar nova spell
    currentSpells.push(spellCode);

    // Atualizar no banco
    await prisma.unit.update({
      where: { id: unitId },
      data: { spells: JSON.stringify(currentSpells) },
    });

    return {
      success: true,
      message: `${spell.name} concedida a ${unit.name}!`,
    };
  } catch (error) {
    console.error("[SPELLS] Erro ao conceder spell:", error);
    return {
      success: false,
      message: "Erro ao conceder spell",
    };
  }
}

/**
 * Remove uma spell de uma unidade
 */
export async function removeSpellFromUnit(
  unitId: string,
  spellCode: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Buscar unidade
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, name: true, spells: true },
    });

    if (!unit) {
      return {
        success: false,
        message: "Unidade não encontrada",
      };
    }

    // Parse spells existentes
    let currentSpells: string[] = JSON.parse(unit.spells || "[]");

    // Verificar se possui
    if (!currentSpells.includes(spellCode)) {
      return {
        success: false,
        message: `${unit.name} não possui essa spell`,
      };
    }

    // Remover spell
    currentSpells = currentSpells.filter((s) => s !== spellCode);

    // Atualizar no banco
    await prisma.unit.update({
      where: { id: unitId },
      data: { spells: JSON.stringify(currentSpells) },
    });

    const spell = getSpellByCode(spellCode);
    return {
      success: true,
      message: `${spell?.name || spellCode} removida de ${unit.name}`,
    };
  } catch (error) {
    console.error("[SPELLS] Erro ao remover spell:", error);
    return {
      success: false,
      message: "Erro ao remover spell",
    };
  }
}

/**
 * Lista todas as spells de uma unidade
 */
export async function getUnitSpells(unitId: string): Promise<string[]> {
  try {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { spells: true },
    });

    if (!unit) {
      return [];
    }

    return JSON.parse(unit.spells || "[]");
  } catch (error) {
    console.error("[SPELLS] Erro ao buscar spells:", error);
    return [];
  }
}

/**
 * Verifica se uma unidade possui uma spell específica
 */
export async function unitHasSpell(
  unitId: string,
  spellCode: string
): Promise<boolean> {
  const spells = await getUnitSpells(unitId);
  return spells.includes(spellCode);
}

/**
 * Concede múltiplas spells de uma vez
 */
export async function grantMultipleSpells(
  unitId: string,
  spellCodes: string[]
): Promise<{ success: boolean; message: string; granted: string[] }> {
  try {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, name: true, spells: true },
    });

    if (!unit) {
      return {
        success: false,
        message: "Unidade não encontrada",
        granted: [],
      };
    }

    const currentSpells: string[] = JSON.parse(unit.spells || "[]");
    const granted: string[] = [];

    for (const spellCode of spellCodes) {
      // Verificar se spell existe
      const spell = getSpellByCode(spellCode);
      if (!spell) {
        console.warn(`[SPELLS] Spell inválida ignorada: ${spellCode}`);
        continue;
      }

      // Adicionar se não possui
      if (!currentSpells.includes(spellCode)) {
        currentSpells.push(spellCode);
        granted.push(spellCode);
      }
    }

    if (granted.length === 0) {
      return {
        success: false,
        message: "Nenhuma spell nova foi concedida",
        granted: [],
      };
    }

    // Atualizar no banco
    await prisma.unit.update({
      where: { id: unitId },
      data: { spells: JSON.stringify(currentSpells) },
    });

    return {
      success: true,
      message: `${granted.length} spell(s) concedida(s) a ${unit.name}`,
      granted,
    };
  } catch (error) {
    console.error("[SPELLS] Erro ao conceder múltiplas spells:", error);
    return {
      success: false,
      message: "Erro ao conceder spells",
      granted: [],
    };
  }
}
