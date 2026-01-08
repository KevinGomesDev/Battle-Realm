// Kingdom Socket Helper
// Centraliza chamadas socket com tipagem forte e eventos específicos

import { colyseusService } from "@/services/colyseus.service";
import type {
  Kingdom,
  KingdomSummary,
  KingdomWithRelations,
  CreateKingdomData,
  CreateTroopTemplateData,
  KingdomTemplateSummary,
  KingdomTemplateDetails,
  RaceDefinition,
  AlignmentDefinition,
  TroopPassiveDefinition,
  GameClassDefinition,
} from "../types/kingdom.types";

const KINGDOM_ERROR_EVENT = "kingdom:error";
const DEFAULT_TIMEOUT = 15000;

// ============ HELPER GENÉRICO ============

interface SocketResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function emitWithResponse<T>(
  emitEvent: string,
  successEvent: string,
  data?: unknown,
  timeoutMs: number = DEFAULT_TIMEOUT
): Promise<SocketResponse<T>> {
  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      clearTimeout(timeoutId);
      colyseusService.off(successEvent, successHandler);
      colyseusService.off(KINGDOM_ERROR_EVENT, errorHandler);
    };

    const successHandler = (responseData: T) => {
      cleanup();
      resolve({ success: true, data: responseData });
    };

    const errorHandler = (errorData: { message: string; code?: string }) => {
      cleanup();
      resolve({ success: false, error: errorData.message });
    };

    colyseusService.on(successEvent, successHandler);
    colyseusService.on(KINGDOM_ERROR_EVENT, errorHandler);

    timeoutId = setTimeout(() => {
      cleanup();
      resolve({ success: false, error: "Timeout na operação" });
    }, timeoutMs);

    colyseusService.sendToGlobal(emitEvent, data);
  });
}

// ============ KINGDOM API ============

export const kingdomApi = {
  /**
   * Cria um novo reino
   */
  async create(
    data: CreateKingdomData
  ): Promise<SocketResponse<KingdomWithRelations>> {
    return emitWithResponse<KingdomWithRelations>(
      "kingdom:create",
      "kingdom:created",
      data
    );
  },

  /**
   * Lista reinos do usuário
   */
  async list(): Promise<SocketResponse<KingdomSummary[]>> {
    return emitWithResponse<KingdomSummary[]>(
      "kingdom:list",
      "kingdom:list_success"
    );
  },

  /**
   * Obtém detalhes de um reino
   */
  async getDetails(
    kingdomId: string
  ): Promise<SocketResponse<KingdomWithRelations>> {
    return emitWithResponse<KingdomWithRelations>(
      "kingdom:get_details",
      "kingdom:details",
      { kingdomId }
    );
  },

  /**
   * Define templates de tropas
   */
  async setTroopTemplates(
    kingdomId: string,
    templates: CreateTroopTemplateData[]
  ): Promise<SocketResponse<KingdomWithRelations>> {
    return emitWithResponse<KingdomWithRelations>(
      "kingdom:set_troop_templates",
      "kingdom:set_troop_templates_success",
      { kingdomId, templates }
    );
  },

  /**
   * Atualiza descrição do reino
   */
  async updateDescription(
    kingdomId: string,
    description: string
  ): Promise<SocketResponse<{ kingdom: Kingdom }>> {
    return emitWithResponse<{ kingdom: Kingdom }>(
      "kingdom:update_description",
      "kingdom:description_updated",
      { kingdomId, description }
    );
  },

  /**
   * Lista templates pré-definidos
   */
  async listTemplates(): Promise<
    SocketResponse<{ templates: KingdomTemplateSummary[] }>
  > {
    return emitWithResponse<{ templates: KingdomTemplateSummary[] }>(
      "kingdom:list_templates",
      "kingdom:templates_list"
    );
  },

  /**
   * Obtém detalhes de um template
   */
  async getTemplate(
    templateId: string
  ): Promise<SocketResponse<{ template: KingdomTemplateDetails }>> {
    return emitWithResponse<{ template: KingdomTemplateDetails }>(
      "kingdom:get_template",
      "kingdom:template_details",
      { templateId }
    );
  },

  /**
   * Cria reino a partir de template
   */
  async createFromTemplate(templateId: string): Promise<
    SocketResponse<{
      kingdom: KingdomWithRelations;
      message: string;
    }>
  > {
    return emitWithResponse<{ kingdom: KingdomWithRelations; message: string }>(
      "kingdom:create_from_template",
      "kingdom:created_from_template",
      { templateId }
    );
  },
};

// ============ STATIC DATA API ============

export const kingdomStaticApi = {
  /**
   * Carrega raças
   */
  async getRaces(): Promise<SocketResponse<RaceDefinition[]>> {
    return emitWithResponse<RaceDefinition[]>(
      "kingdom:get_races",
      "kingdom:races_data"
    );
  },

  /**
   * Carrega alinhamentos
   */
  async getAlignments(): Promise<SocketResponse<AlignmentDefinition[]>> {
    return emitWithResponse<AlignmentDefinition[]>(
      "kingdom:get_alignments",
      "kingdom:alignments_data"
    );
  },

  /**
   * Carrega passivas de tropas
   */
  async getTroopPassives(): Promise<SocketResponse<TroopPassiveDefinition[]>> {
    return emitWithResponse<TroopPassiveDefinition[]>(
      "kingdom:get_troop_passives",
      "kingdom:troop_passives_data"
    );
  },

  /**
   * Carrega classes de herói
   */
  async getClasses(): Promise<
    SocketResponse<{ classes: GameClassDefinition[] }>
  > {
    return emitWithResponse<{ classes: GameClassDefinition[] }>(
      "skills:list_classes",
      "skills:classes_list"
    );
  },

  /**
   * Carrega todos os dados estáticos em paralelo
   */
  async loadAll(): Promise<{
    races: RaceDefinition[];
    alignments: AlignmentDefinition[];
    passives: TroopPassiveDefinition[];
    classes: GameClassDefinition[];
  }> {
    const [racesRes, alignmentsRes, passivesRes, classesRes] =
      await Promise.all([
        this.getRaces(),
        this.getAlignments(),
        this.getTroopPassives(),
        this.getClasses(),
      ]);

    return {
      races: racesRes.data || [],
      alignments: alignmentsRes.data || [],
      passives: passivesRes.data || [],
      classes: classesRes.data?.classes || [],
    };
  },
};
