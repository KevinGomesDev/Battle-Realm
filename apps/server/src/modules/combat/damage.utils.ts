// server/src/utils/damage.utils.ts
// =============================================================================
// SISTEMA DE DANO - FUNÇÃO ÚNICA E CENTRALIZADA
// =============================================================================
// Este é o ÚNICO arquivo responsável por aplicar dano no jogo.
// Todos os tipos de dano (físico, mágico, verdadeiro) passam por aqui.
// =============================================================================

import type { DamageTypeName } from "@boundless/shared/config";

/**
 * Resultado da aplicação de dano
 */
export interface DamageResult {
  /** Nova proteção física após o dano */
  newPhysicalProtection: number;
  /** Nova proteção mágica após o dano */
  newMagicalProtection: number;
  /** Novo HP após o dano */
  newHp: number;
  /** Dano absorvido pela proteção */
  damageAbsorbed: number;
  /** Dano que passou para o HP */
  damageToHp: number;
}

/**
 * Aplica dano com sistema de proteção física e mágica.
 * O dano excedente (quando proteção zera) passa para o HP.
 *
 * ESTA É A ÚNICA FUNÇÃO DE DANO DO JOGO.
 *
 * @param physicalProtection Proteção física atual
 * @param magicalProtection Proteção mágica atual
 * @param currentHp HP atual
 * @param damage Dano a aplicar
 * @param damageType "FISICO" | "MAGICO" | "VERDADEIRO"
 * @returns DamageResult com novos valores de proteção, HP e dano aplicado
 *
 * @example
 * // Aplicar 10 de dano físico
 * const result = applyDamage(unit.physicalProtection, unit.magicalProtection, unit.currentHp, 10, "FISICO");
 * unit.physicalProtection = result.newPhysicalProtection;
 * unit.magicalProtection = result.newMagicalProtection;
 * unit.currentHp = result.newHp;
 * if (unit.currentHp <= 0) unit.isAlive = false;
 */
export function applyDamage(
  physicalProtection: number,
  magicalProtection: number,
  currentHp: number,
  damage: number,
  damageType: DamageTypeName
): DamageResult {
  let newPhysicalProtection = physicalProtection;
  let newMagicalProtection = magicalProtection;
  let newHp = currentHp;
  let damageAbsorbed = 0;
  let damageToHp = 0;

  if (damageType === "VERDADEIRO") {
    // Dano verdadeiro ignora toda proteção, vai direto no HP
    damageToHp = damage;
    newHp = Math.max(0, currentHp - damage);
  } else if (damageType === "FISICO") {
    // Dano físico usa proteção física
    if (physicalProtection > 0) {
      if (damage >= physicalProtection) {
        // Proteção absorve o que pode, excedente vai para HP
        damageAbsorbed = physicalProtection;
        damageToHp = damage - physicalProtection;
        newPhysicalProtection = 0;
        newHp = Math.max(0, currentHp - damageToHp);
      } else {
        // Proteção absorve todo o dano
        damageAbsorbed = damage;
        newPhysicalProtection = physicalProtection - damage;
      }
    } else {
      // Sem proteção física, dano vai direto no HP
      damageToHp = damage;
      newHp = Math.max(0, currentHp - damage);
    }
  } else if (damageType === "MAGICO") {
    // Dano mágico usa proteção mágica
    if (magicalProtection > 0) {
      if (damage >= magicalProtection) {
        // Proteção absorve o que pode, excedente vai para HP
        damageAbsorbed = magicalProtection;
        damageToHp = damage - magicalProtection;
        newMagicalProtection = 0;
        newHp = Math.max(0, currentHp - damageToHp);
      } else {
        // Proteção absorve todo o dano
        damageAbsorbed = damage;
        newMagicalProtection = magicalProtection - damage;
      }
    } else {
      // Sem proteção mágica, dano vai direto no HP
      damageToHp = damage;
      newHp = Math.max(0, currentHp - damage);
    }
  }

  return {
    newPhysicalProtection,
    newMagicalProtection,
    newHp,
    damageAbsorbed,
    damageToHp,
  };
}
