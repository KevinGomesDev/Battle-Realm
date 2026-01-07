import { useState, useCallback } from "react";
import type {
  CreateTroopTemplateData,
  ResourceType,
  BaseAttributes,
} from "../types/kingdom.types";

// ============ TYPES ============

export interface TroopTemplateFormData extends CreateTroopTemplateData {
  // Form state extends the create data
}

export interface RegentFormData {
  name: string;
  avatar?: string; // Nome do arquivo sprite
  attributes: BaseAttributes;
  initialSkillId?: string; // Skill inicial escolhida
}

export interface KingdomFormData {
  name: string;
  description?: string;
  race: string;
  alignment: string;
  raceMetadata?: string;
}

// ============ DEFAULTS ============

const DEFAULT_KINGDOM: KingdomFormData = {
  name: "",
  description: "",
  race: "",
  alignment: "",
};

const DEFAULT_REGENT: RegentFormData = {
  name: "",
  avatar: "1",
  attributes: {
    combat: 0,
    speed: 0,
    focus: 0,
    resistance: 0,
    will: 0,
    vitality: 0,
  },
  initialSkillId: undefined,
};

const RESOURCE_ORDER: ResourceType[] = [
  "ore",
  "supplies",
  "arcane",
  "experience",
  "devotion",
];

// IDs de avatar padrão para cada slot de tropa (heroId 1-15)
const DEFAULT_AVATARS = [
  "1", // Slot 0 - Hero 1
  "2", // Slot 1 - Hero 2
  "3", // Slot 2 - Hero 3
  "4", // Slot 3 - Hero 4
  "5", // Slot 4 - Hero 5
];

const createDefaultTroopTemplate = (
  slotIndex: number,
  passiveId: string = ""
): TroopTemplateFormData => ({
  slotIndex,
  name: `Tropa ${slotIndex + 1}`,
  passiveId,
  resourceType: RESOURCE_ORDER[slotIndex % 5],
  avatar: DEFAULT_AVATARS[slotIndex % DEFAULT_AVATARS.length],
  combat: 2,
  speed: 2,
  focus: 2,
  resistance: 2,
  will: 0,
  vitality: 2,
});

// ============ KINGDOM FORM HOOK ============

export function useKingdomForm() {
  const [data, setData] = useState<KingdomFormData>(DEFAULT_KINGDOM);

  const update = useCallback((updates: Partial<KingdomFormData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  const reset = useCallback(() => {
    setData(DEFAULT_KINGDOM);
  }, []);

  const isValid = data.name.length >= 3 && data.race && data.alignment;

  return { data, update, reset, isValid };
}

// ============ REGENT FORM HOOK ============

export function useRegentForm() {
  const [data, setData] = useState<RegentFormData>(DEFAULT_REGENT);

  const update = useCallback((updates: Partial<RegentFormData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateAttribute = useCallback(
    (key: keyof BaseAttributes, value: number) => {
      const safeValue = Math.max(0, Math.min(30, value));
      setData((prev) => ({
        ...prev,
        attributes: { ...prev.attributes, [key]: safeValue },
      }));
    },
    []
  );

  const reset = useCallback(() => {
    setData(DEFAULT_REGENT);
  }, []);

  const totalPoints = Object.values(data.attributes).reduce((a, b) => a + b, 0);
  // Regentes precisam de skill inicial, nome e 30 pontos distribuídos
  const isValid =
    data.name.length >= 2 && totalPoints === 30 && !!data.initialSkillId;

  return { data, update, updateAttribute, reset, totalPoints, isValid };
}

// ============ TROOPS FORM HOOK ============

export function useTroopsForm(initialPassives: string[] = []) {
  const [templates, setTemplates] = useState<TroopTemplateFormData[]>(() =>
    Array.from({ length: 5 }, (_, i) =>
      createDefaultTroopTemplate(i, initialPassives[i] || "")
    )
  );
  const [activeSlot, setActiveSlot] = useState(0);

  const updateTemplate = useCallback(
    (slotIndex: number, updates: Partial<TroopTemplateFormData>) => {
      setTemplates((prev) =>
        prev.map((t) => (t.slotIndex === slotIndex ? { ...t, ...updates } : t))
      );
    },
    []
  );

  const updateAttribute = useCallback(
    (slotIndex: number, attr: keyof BaseAttributes, value: number) => {
      const safeValue = Math.max(0, Math.min(10, value));
      updateTemplate(slotIndex, { [attr]: safeValue });
    },
    [updateTemplate]
  );

  const setPassiveIds = useCallback((passiveIds: string[]) => {
    setTemplates((prev) =>
      prev.map((t, i) => ({
        ...t,
        passiveId: passiveIds[i % passiveIds.length] || "",
      }))
    );
  }, []);

  const reset = useCallback(() => {
    setTemplates(
      Array.from({ length: 5 }, (_, i) => createDefaultTroopTemplate(i))
    );
    setActiveSlot(0);
  }, []);

  const currentTemplate = templates[activeSlot];

  const getTemplateTotal = (t: TroopTemplateFormData) =>
    t.combat + t.speed + t.focus + t.resistance + t.will + t.vitality;

  const isTemplateValid = (t: TroopTemplateFormData) =>
    t.name.length >= 2 &&
    t.passiveId &&
    t.resourceType &&
    getTemplateTotal(t) === 10;

  const allValid = templates.every(isTemplateValid);

  return {
    templates,
    activeSlot,
    setActiveSlot,
    updateTemplate,
    updateAttribute,
    setPassiveIds,
    reset,
    currentTemplate,
    getTemplateTotal,
    isTemplateValid,
    allValid,
  };
}

// ============ CREATION WIZARD HOOK ============

export type WizardStep = "kingdom" | "regent" | "troops";
export type WizardView = "templates" | "custom";

export function useCreationWizard() {
  const [view, setView] = useState<WizardView>("templates");
  const [step, setStep] = useState<WizardStep>("kingdom");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const nextStep = useCallback(() => {
    setStep((current) => {
      if (current === "kingdom") return "regent";
      if (current === "regent") return "troops";
      return current;
    });
  }, []);

  const prevStep = useCallback(() => {
    setStep((current) => {
      if (current === "troops") return "regent";
      if (current === "regent") return "kingdom";
      return current;
    });
  }, []);

  const goToCustom = useCallback(() => {
    setView("custom");
    setStep("kingdom");
  }, []);

  const goToTemplates = useCallback(() => {
    setView("templates");
    setStep("kingdom");
  }, []);

  const startSubmit = useCallback(() => {
    setIsSubmitting(true);
    setSubmitError(null);
  }, []);

  const endSubmit = useCallback((error?: string) => {
    setIsSubmitting(false);
    if (error) setSubmitError(error);
  }, []);

  const clearError = useCallback(() => {
    setSubmitError(null);
  }, []);

  const stepNumber = step === "kingdom" ? 1 : step === "regent" ? 2 : 3;

  return {
    view,
    step,
    stepNumber,
    isSubmitting,
    submitError,
    nextStep,
    prevStep,
    goToCustom,
    goToTemplates,
    startSubmit,
    endSubmit,
    clearError,
  };
}
