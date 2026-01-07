// shared/data/kingdom-templates.ts
// Templates de Reinos pré-definidos com Regente e Exércitos
// Re-exporta templates e fornece funções utilitárias

import { getRegentTemplate, type RegentTemplate } from "./regents.data";
import type { KingdomTemplateDefinition } from "../types/units.types";

// Re-exportar tipos e templates de tropas
export type { TroopTemplateDefinition } from "./Templates/TroopTemplates";
export {
  VALDORIA_TROOPS,
  NYXRATH_TROOPS,
  ASHENVALE_TROOPS,
} from "./Templates/TroopTemplates";

// Re-exportar tipos e templates de reinos
export type { KingdomTemplateDefinition } from "../types/units.types";
export { VALDORIA, NYXRATH, ASHENVALE } from "./Templates/KingdomTemplates";

import { VALDORIA, NYXRATH, ASHENVALE } from "./Templates/KingdomTemplates";

/**
 * Interface expandida com o regente já resolvido
 */
export interface KingdomTemplateResolved
  extends Omit<KingdomTemplateDefinition, "regentCode"> {
  regent: RegentTemplate;
}

// ============================================
// EXPORTAÇÃO
// ============================================

export const KINGDOM_TEMPLATES: KingdomTemplateDefinition[] = [
  VALDORIA,
  NYXRATH,
  ASHENVALE,
];

export function getKingdomTemplateById(
  id: string
): KingdomTemplateDefinition | undefined {
  return KINGDOM_TEMPLATES.find((t) => t.id === id);
}

export function getAllKingdomTemplates(): KingdomTemplateDefinition[] {
  return KINGDOM_TEMPLATES;
}

/**
 * Resolve um template de reino com o regente completo
 */
export function resolveKingdomTemplate(
  template: KingdomTemplateDefinition
): KingdomTemplateResolved | null {
  const regent = getRegentTemplate(template.regentCode);
  if (!regent) {
    console.error(`Regente ${template.regentCode} não encontrado`);
    return null;
  }
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    alignment: template.alignment,
    race: template.race,
    regent,
    troopTemplates: template.troopTemplates,
  };
}

/**
 * Obtém um template de reino resolvido (com regente)
 */
export function getResolvedKingdomTemplateById(
  id: string
): KingdomTemplateResolved | null {
  const template = getKingdomTemplateById(id);
  if (!template) return null;
  return resolveKingdomTemplate(template);
}

// Versão resumida para listagem (sem descrições completas)
export function getKingdomTemplatesSummary() {
  return KINGDOM_TEMPLATES.map((t) => {
    const regent = getRegentTemplate(t.regentCode);
    return {
      id: t.id,
      name: t.name,
      alignment: t.alignment,
      race: t.race,
      regentName: regent?.name || "Desconhecido",
      troopCount: t.troopTemplates.length,
    };
  });
}
