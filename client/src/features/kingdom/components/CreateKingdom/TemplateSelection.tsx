import React, { useEffect, useState } from "react";
import { colyseusService } from "../../../../services/colyseus.service";
import type { KingdomTemplateSummary, KingdomTemplateDetails } from "./types";
import { RESOURCE_NAMES as GLOBAL_RESOURCE_NAMES } from "../../../../../../shared/config/global.config";

interface TemplateCardProps {
  template: KingdomTemplateSummary;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
}

const DIFFICULTY_CONFIG = {
  BEGINNER: {
    color: "text-green-400",
    bg: "bg-green-900/30",
    border: "border-green-600/50",
    label: "Iniciante",
  },
  INTERMEDIATE: {
    color: "text-yellow-400",
    bg: "bg-yellow-900/30",
    border: "border-yellow-600/50",
    label: "Intermediário",
  },
  ADVANCED: {
    color: "text-red-400",
    bg: "bg-red-900/30",
    border: "border-red-600/50",
    label: "Avançado",
  },
};

/**
 * Card de Template - Preto e branco quando não selecionado, colorido quando selecionado/hover
 */
const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  isSelected,
  isExpanded,
  onSelect,
}) => {
  const diffConfig =
    DIFFICULTY_CONFIG[template.difficulty] || DIFFICULTY_CONFIG.BEGINNER;

  return (
    <div
      onClick={onSelect}
      className={`
        relative cursor-pointer transition-all duration-300 overflow-hidden rounded-xl
        ${
          isSelected
            ? "ring-2 ring-stellar-gold shadow-[0_0_30px_rgba(255,215,0,0.3)]"
            : "hover:ring-1 hover:ring-stellar-amber/50"
        }
        ${!isSelected && !isExpanded ? "grayscale" : ""}
      `}
    >
      {/* Background com gradiente */}
      <div
        className={`
        absolute inset-0 transition-all duration-300
        ${
          isSelected
            ? "bg-gradient-to-b from-surface-700 via-surface-600 to-surface-900"
            : "bg-gradient-to-b from-surface-800 to-surface-900"
        }
      `}
      />

      {/* Conteúdo do Card */}
      <div className="relative p-4 flex flex-col items-center text-center min-h-[280px]">
        {/* Ícone grande */}
        <div
          className={`
          text-5xl mb-3 transition-all duration-300
          ${isSelected ? "scale-110" : "opacity-70"}
        `}
        >
          {template.icon}
        </div>

        {/* Nome do Template */}
        <h3
          className={`
            text-lg font-bold mb-2 transition-colors duration-300
            ${isSelected ? "text-astral-chrome" : "text-astral-steel"}
          `}
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          {template.name}
        </h3>

        {/* Descrição curta */}
        <p
          className={`
          text-xs leading-relaxed mb-3 flex-1 transition-colors duration-300
          ${isSelected ? "text-astral-silver" : "text-astral-steel/70"}
        `}
        >
          {template.description}
        </p>

        {/* Tags de info */}
        <div className="space-y-2 w-full">
          <div className="flex items-center justify-center gap-2 text-xs">
            <span
              className={`px-2 py-0.5 rounded ${
                isSelected
                  ? "bg-surface-800/50 text-astral-silver"
                  : "bg-surface-900/50 text-astral-steel"
              }`}
            >
              {template.raceName}
            </span>
            <span
              className={`px-2 py-0.5 rounded ${
                isSelected
                  ? "bg-surface-800/50 text-astral-silver"
                  : "bg-surface-900/50 text-astral-steel"
              }`}
            >
              {template.alignmentName}
            </span>
          </div>

          <div
            className={`text-xs px-2 py-1 rounded ${diffConfig.bg} ${diffConfig.border} border ${diffConfig.color}`}
          >
            {diffConfig.label}
          </div>
        </div>

        {/* Indicador de seleção */}
        {isSelected && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-stellar-gold rounded-full flex items-center justify-center">
            <span className="text-surface-900 text-sm">✓</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface TemplateDetailsViewProps {
  template: KingdomTemplateDetails;
  isLoading: boolean;
  onCreateFromTemplate: () => void;
}

// Mapeamento de códigos para nomes legíveis
const RACE_NAMES: Record<string, string> = {
  HUMANOIDE: "Humanóide",
  ELFICO: "Élfico",
  DRACONICO: "Dracônico",
  MORTO_VIVO: "Morto-Vivo",
  DEMONIACO: "Demoníaco",
};

const ALIGNMENT_NAMES: Record<string, string> = {
  BOM: "Bom",
  MAL: "Mal",
  NEUTRO: "Neutro",
  CAOS: "Caos",
  ORDEM: "Ordem",
};

// Usa nomes do config global com mapeamento para chaves legadas
const RESOURCE_NAMES: Record<string, string> = {
  minerio: GLOBAL_RESOURCE_NAMES.ore.name,
  ore: GLOBAL_RESOURCE_NAMES.ore.name,
  suprimentos: GLOBAL_RESOURCE_NAMES.supplies.name,
  supplies: GLOBAL_RESOURCE_NAMES.supplies.name,
  devocao: GLOBAL_RESOURCE_NAMES.devotion.name,
  devotion: GLOBAL_RESOURCE_NAMES.devotion.name,
  arcano: GLOBAL_RESOURCE_NAMES.arcane.name,
  arcane: GLOBAL_RESOURCE_NAMES.arcane.name,
  experiencia: GLOBAL_RESOURCE_NAMES.experience.name,
  experience: GLOBAL_RESOURCE_NAMES.experience.name,
};

const PASSIVE_NAMES: Record<string, string> = {
  charge: "Investida",
  shield_wall: "Muro de Escudos",
  first_strike: "Primeiro Golpe",
  expendable: "Descartável",
  healer: "Curador",
  stealth: "Furtividade",
  berserker: "Fúria",
  undying: "Imortal",
};

/**
 * Vista expandida dos detalhes do template
 */
const TemplateDetailsView: React.FC<TemplateDetailsViewProps> = ({
  template,
  isLoading,
  onCreateFromTemplate,
}) => {
  if (!template) return null;

  const regent = template.regent;
  const troops = template.troopTemplates || [];

  return (
    <div className="bg-surface-800/30 rounded-xl border border-surface-500/30 p-6 mt-4 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6 pb-4 border-b border-surface-500/30">
        <div className="text-4xl">🏰</div>
        <div className="flex-1">
          <h3
            className="text-2xl font-bold text-astral-chrome mb-1"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {template.name}
          </h3>
        </div>
      </div>

      {/* Descrição/Lore */}
      <div className="mb-6 p-4 bg-surface-900/30 rounded-lg border-l-4 border-stellar-gold/50">
        <p className="text-astral-silver text-sm leading-relaxed whitespace-pre-line">
          {template.description}
        </p>
      </div>

      {/* Grid de informações */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Reino */}
        <div className="bg-surface-900/50 rounded-lg p-4">
          <h4 className="text-astral-chrome font-semibold mb-3 flex items-center gap-2">
            <span>🏰</span> Reino
          </h4>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-astral-steel">Raça:</span>
              <span className="text-astral-silver font-medium">
                {RACE_NAMES[template.race] || template.race}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-astral-steel">Alinhamento:</span>
              <span className="text-astral-silver font-medium">
                {ALIGNMENT_NAMES[template.alignment] || template.alignment}
              </span>
            </div>
          </div>
        </div>

        {/* Regente */}
        <div className="bg-surface-900/50 rounded-lg p-4">
          <h4 className="text-astral-chrome font-semibold mb-3 flex items-center gap-2">
            <span>👑</span> Regente
          </h4>
          {regent ? (
            <>
              <div className="space-y-2 text-sm mb-3">
                <div>
                  <span className="text-astral-steel">Nome:</span>
                  <span className="text-astral-silver ml-2 font-medium">
                    {regent.name}
                  </span>
                </div>
                <div>
                  <span className="text-astral-steel">Classe:</span>
                  <span className="text-astral-silver ml-2 font-medium">
                    Regente
                  </span>
                </div>
              </div>

              {/* Atributos do Regente */}
              <div className="pt-3 border-t border-surface-500/20">
                <p className="text-astral-steel text-xs mb-2">Atributos:</p>
                <div className="grid grid-cols-6 gap-1 text-center text-xs">
                  <div className="bg-surface-800/30 rounded p-1">
                    <div className="text-red-400">⚔️</div>
                    <div className="text-astral-chrome font-bold">
                      {regent.combat ?? 0}
                    </div>
                  </div>
                  <div className="bg-surface-800/30 rounded p-1">
                    <div className="text-blue-400">👁️</div>
                    <div className="text-astral-chrome font-bold">
                      {regent.speed ?? 0}
                    </div>
                  </div>
                  <div className="bg-surface-800/30 rounded p-1">
                    <div className="text-stellar-amber">🎯</div>
                    <div className="text-astral-chrome font-bold">
                      {regent.focus ?? 0}
                    </div>
                  </div>
                  <div className="bg-surface-800/30 rounded p-1">
                    <div className="text-astral-steel">🛡️</div>
                    <div className="text-astral-chrome font-bold">
                      {regent.resistance ?? 0}
                    </div>
                  </div>
                  <div className="bg-surface-800/30 rounded p-1">
                    <div className="text-mystic-glow">🧠</div>
                    <div className="text-astral-chrome font-bold">
                      {regent.will ?? 0}
                    </div>
                  </div>
                  <div className="bg-surface-800/30 rounded p-1">
                    <div className="text-green-400">❤️</div>
                    <div className="text-astral-chrome font-bold">
                      {regent.vitality ?? 0}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-astral-steel text-sm">Regente não definido</p>
          )}
        </div>

        {/* Tropas */}
        <div className="bg-surface-900/50 rounded-lg p-4">
          <h4 className="text-astral-chrome font-semibold mb-3 flex items-center gap-2">
            <span>⚔️</span> Exército
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {troops.length > 0 ? (
              troops.map((troop, index) => (
                <div
                  key={index}
                  className="bg-surface-800/20 rounded p-2 text-xs"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-astral-chrome font-semibold">
                      {troop.name}
                    </span>
                    <span className="text-astral-steel text-[10px]">
                      {RESOURCE_NAMES[troop.resourceType] || troop.resourceType}
                    </span>
                  </div>
                  <div className="text-stellar-gold text-[10px]">
                    🔸 {PASSIVE_NAMES[troop.passiveId] || troop.passiveId}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-astral-steel text-sm">
                Nenhuma tropa definida
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Descrição do Regente */}
      {regent?.description && (
        <div className="mb-6 p-4 bg-surface-900/30 rounded-lg">
          <h4 className="text-astral-chrome font-semibold mb-2 text-sm flex items-center gap-2">
            <span>📜</span> Sobre o Regente
          </h4>
          <p className="text-astral-steel text-xs leading-relaxed whitespace-pre-line">
            {regent.description}
          </p>
        </div>
      )}

      {/* Botão de Criar */}
      <button
        onClick={onCreateFromTemplate}
        disabled={isLoading}
        className="w-full py-4 bg-gradient-to-b from-stellar-gold to-stellar-amber border-2 border-stellar-gold/50 rounded-lg
                   text-surface-900 font-bold text-lg tracking-wide
                   hover:from-yellow-400 hover:to-stellar-gold
                   disabled:from-surface-700 disabled:to-surface-600 disabled:text-astral-steel disabled:cursor-not-allowed
                   transition-all duration-200 shadow-lg"
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="animate-spin w-5 h-5 border-2 border-surface-900 border-t-transparent rounded-full"></div>
            Criando Reino...
          </span>
        ) : (
          <span>⚔️ FUNDAR ESTE REINO ⚔️</span>
        )}
      </button>
    </div>
  );
};

interface TemplateSelectionProps {
  onSelectTemplate: (templateId: string) => void;
  onCustomCreate: () => void;
}

/**
 * Componente de seleção de templates
 */
export const TemplateSelection: React.FC<TemplateSelectionProps> = ({
  onSelectTemplate,
  onCustomCreate,
}) => {
  const [templates, setTemplates] = useState<KingdomTemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [templateDetails, setTemplateDetails] =
    useState<KingdomTemplateDetails | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar lista de templates
  useEffect(() => {
    const handleTemplatesList = (data: {
      templates: KingdomTemplateSummary[];
    }) => {
      setTemplates(data.templates);
      setIsLoadingList(false);
    };

    const handleError = (data: { message: string }) => {
      setError(data.message);
      setIsLoadingList(false);
    };

    colyseusService.on("kingdom:templates_list", handleTemplatesList);
    colyseusService.on("error", handleError);

    colyseusService.sendToGlobal("kingdom:list_templates");

    return () => {
      colyseusService.off("kingdom:templates_list", handleTemplatesList);
      colyseusService.off("error", handleError);
    };
  }, []);

  // Carregar detalhes do template selecionado
  useEffect(() => {
    if (!selectedTemplateId) {
      setTemplateDetails(null);
      return;
    }

    setIsLoadingDetails(true);

    const handleDetails = (data: { template: KingdomTemplateDetails }) => {
      setTemplateDetails(data.template);
      setIsLoadingDetails(false);
    };

    colyseusService.on("kingdom:template_details", handleDetails);
    colyseusService.sendToGlobal("kingdom:get_template", {
      templateId: selectedTemplateId,
    });

    return () => {
      colyseusService.off("kingdom:template_details", handleDetails);
    };
  }, [selectedTemplateId]);

  const handleCreateFromTemplate = () => {
    if (!selectedTemplateId) return;

    setIsCreating(true);

    const handleSuccess = (data: { kingdom: any; message: string }) => {
      setIsCreating(false);
      onSelectTemplate(data.kingdom.id);
    };

    const handleError = (data: { message: string }) => {
      setError(data.message);
      setIsCreating(false);
    };

    colyseusService.on("kingdom:created_from_template", handleSuccess);
    colyseusService.on("error", handleError);

    colyseusService.sendToGlobal("kingdom:create_from_template", {
      templateId: selectedTemplateId,
    });

    // Cleanup após timeout
    setTimeout(() => {
      colyseusService.off("kingdom:created_from_template", handleSuccess);
      colyseusService.off("error", handleError);
    }, 15000);
  };

  if (isLoadingList) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-3 border-stellar-amber rounded-full animate-spin border-t-transparent"></div>
          <div
            className="absolute inset-2 border-2 border-stellar-gold rounded-full animate-spin border-b-transparent"
            style={{ animationDirection: "reverse" }}
          ></div>
        </div>
        <p className="text-astral-steel mt-4">Carregando reinos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Erro */}
      {error && (
        <div className="p-3 bg-red-800/20 border border-red-500 rounded-lg">
          <p className="text-red-400 text-sm flex items-center gap-2">
            <span>⚠️</span> {error}
          </p>
        </div>
      )}

      {/* Título */}
      <div className="text-center">
        <h2
          className="text-2xl font-bold text-astral-chrome mb-2"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Escolha seu Destino
        </h2>
        <p className="text-astral-steel text-sm">
          Selecione um reino pré-configurado ou crie o seu próprio
        </p>
      </div>

      {/* Grid de Templates */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            isSelected={selectedTemplateId === template.id}
            isExpanded={
              selectedTemplateId === template.id && templateDetails !== null
            }
            onSelect={() =>
              setSelectedTemplateId(
                selectedTemplateId === template.id ? null : template.id
              )
            }
          />
        ))}
      </div>

      {/* Detalhes do Template Selecionado */}
      {selectedTemplateId &&
        (isLoadingDetails ? (
          <div className="bg-surface-800/30 rounded-xl border border-surface-500/30 p-8 mt-4 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-stellar-gold border-t-transparent rounded-full"></div>
            <span className="text-astral-steel ml-3">
              Carregando detalhes...
            </span>
          </div>
        ) : templateDetails ? (
          <TemplateDetailsView
            template={templateDetails}
            isLoading={isCreating}
            onCreateFromTemplate={handleCreateFromTemplate}
          />
        ) : null)}

      {/* Divisor */}
      <div className="flex items-center gap-4 py-4">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-surface-500 to-transparent"></div>
        <span className="text-astral-steel text-xs tracking-widest uppercase">
          ou
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-surface-500 to-transparent"></div>
      </div>

      {/* Botão de Criação Personalizada */}
      <button
        onClick={onCustomCreate}
        className="w-full py-4 bg-gradient-to-b from-surface-700 to-surface-600 border-2 border-surface-500 rounded-lg
                   text-astral-silver font-semibold tracking-wide
                   hover:from-surface-600 hover:to-surface-700 hover:text-astral-chrome
                   transition-all duration-200"
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        <span className="flex items-center justify-center gap-2">
          <span>📜</span>
          <span>Criar seu Próprio Reino</span>
          <span className="text-astral-steel text-xs">(Personalizado)</span>
        </span>
      </button>
    </div>
  );
};
