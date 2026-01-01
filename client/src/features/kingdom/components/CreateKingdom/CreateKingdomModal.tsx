import React, { useEffect, useState } from "react";
import { useKingdom, useKingdomStaticData } from "../../hooks/useKingdom";
import {
  useKingdomForm,
  useRegentForm,
  useTroopsForm,
} from "../../hooks/useKingdomForm";
import { Step1KingdomInfo } from "./Step1KingdomInfo";
import { Step2Alignment } from "./Step2Alignment";
import { Step3RegentSheet } from "./Step3RegentSheet";
import { Step3Troops } from "./Step3Troops";
import { TemplateSelection } from "./TemplateSelection";
import { LoadingSpinner, StepIndicator } from "../ui";

interface CreateKingdomModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type WizardStep = "info" | "alignment" | "regent" | "troops";

export const CreateKingdomModal: React.FC<CreateKingdomModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const {
    createKingdom,
    isLoading: isCreatingKingdom,
    error: kingdomError,
  } = useKingdom();

  // View state: templates or custom
  const [view, setView] = useState<"templates" | "custom">("templates");
  const [currentStep, setCurrentStep] = useState<WizardStep>("info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form hooks
  const kingdomForm = useKingdomForm();
  const regentForm = useRegentForm();
  const troopsForm = useTroopsForm();

  // Static data
  const staticData = useKingdomStaticData();

  // Load static data on mount
  useEffect(() => {
    staticData.loadAll().then((data) => {
      if (data && data.passives.length > 0) {
        troopsForm.setPassiveIds(data.passives.map((p) => p.id));
      }
    });
  }, []);

  // Navigation
  const goToCustom = () => setView("custom");
  const goToTemplates = () => setView("templates");

  const nextStep = () => {
    const steps: WizardStep[] = ["info", "alignment", "regent", "troops"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const prevStep = () => {
    const steps: WizardStep[] = ["info", "alignment", "regent", "troops"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    } else {
      goToTemplates();
    }
  };

  // Step handlers
  const handleNextFromInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (kingdomForm.data.name.length >= 3) {
      nextStep();
    }
  };

  const handleNextFromAlignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (kingdomForm.data.alignment) {
      nextStep();
    }
  };

  const handleNextFromRegent = (e: React.FormEvent) => {
    e.preventDefault();
    if (regentForm.isValid) {
      nextStep();
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!troopsForm.allValid) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await createKingdom({
        name: kingdomForm.data.name,
        description: kingdomForm.data.description,
        race: (kingdomForm.data.race as any) || "HUMANOIDE",
        alignment: kingdomForm.data.alignment as any,
        raceMetadata: kingdomForm.data.raceMetadata,
        regent: {
          name: regentForm.data.name,
          avatar: regentForm.data.avatar,
          attributes: regentForm.data.attributes,
          initialSkillId: regentForm.data.initialSkillId,
        },
        troopTemplates: troopsForm.templates.map((t) => ({
          slotIndex: t.slotIndex,
          name: t.name,
          passiveId: t.passiveId,
          resourceType: t.resourceType,
          combat: t.combat,
          acuity: t.acuity,
          focus: t.focus,
          armor: t.armor,
          vitality: t.vitality,
        })),
      });

      onSuccess();
    } catch (err: any) {
      setSubmitError(err.message || "Erro ao criar reino");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTemplateSuccess = () => {
    onSuccess();
  };

  const currentError = submitError || kingdomError;
  const isLoading = isSubmitting || isCreatingKingdom;

  const getStepNumber = () => {
    const steps: WizardStep[] = ["info", "alignment", "regent", "troops"];
    return steps.indexOf(currentStep);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop com efeito de sombra/névoa */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Efeitos de sombra nas bordas - fade effect como se fosse feito de sombras */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black opacity-70" />
        {/* Cantos mais escuros */}
        <div className="absolute top-0 left-0 w-1/4 h-1/4 bg-gradient-to-br from-black to-transparent opacity-80" />
        <div className="absolute top-0 right-0 w-1/4 h-1/4 bg-gradient-to-bl from-black to-transparent opacity-80" />
        <div className="absolute bottom-0 left-0 w-1/4 h-1/4 bg-gradient-to-tr from-black to-transparent opacity-80" />
        <div className="absolute bottom-0 right-0 w-1/4 h-1/4 bg-gradient-to-tl from-black to-transparent opacity-80" />
      </div>

      {/* Modal Container - mais largo (max-w-6xl) */}
      <div
        className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden
                   bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900
                   rounded-2xl shadow-2xl shadow-black/50"
      >
        {/* Efeito de borda suave com gradiente - borda esvaecida */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none">
          <div className="absolute inset-0 rounded-2xl border border-amber-900/20" />
          <div className="absolute inset-[1px] rounded-2xl border border-slate-700/30" />
          {/* Glow sutil nas bordas */}
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-b from-amber-900/10 via-transparent to-amber-900/5 blur-sm" />
        </div>

        {/* Header */}
        <div className="relative px-6 py-4 border-b border-slate-700/50 bg-slate-900/50">
          <h1 className="text-center text-2xl font-bold text-amber-400">
            {view === "templates"
              ? "⚔️ Fundar Novo Reino ⚔️"
              : getStepTitle(currentStep)}
          </h1>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center
                       text-slate-400 hover:text-white transition-colors rounded-lg
                       hover:bg-slate-700/50"
          >
            ✕
          </button>
        </div>

        {/* Progress Bar */}
        {view === "custom" && (
          <div className="px-6 pt-4">
            <StepIndicator
              steps={["Reino", "Alinhamento", "Regente", "Tropas"]}
              currentStep={getStepNumber()}
            />
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {view === "templates" && (
            <TemplateSelection
              onSelectTemplate={handleTemplateSuccess}
              onCustomCreate={goToCustom}
            />
          )}

          {view === "custom" && (
            <>
              {staticData.isLoading ? (
                <LoadingSpinner message="Carregando dados do reino..." />
              ) : (
                <>
                  {currentStep === "info" && (
                    <Step1KingdomInfo
                      kingdomName={kingdomForm.data.name}
                      setKingdomName={(v) => kingdomForm.update({ name: v })}
                      description={kingdomForm.data.description || ""}
                      setDescription={(v) =>
                        kingdomForm.update({ description: v })
                      }
                      error={currentError}
                      isLoading={isLoading}
                      onNext={handleNextFromInfo}
                      onCancel={goToTemplates}
                    />
                  )}

                  {currentStep === "alignment" && (
                    <Step2Alignment
                      selectedAlignment={kingdomForm.data.alignment}
                      setSelectedAlignment={(v) =>
                        kingdomForm.update({ alignment: v })
                      }
                      alignments={staticData.alignments}
                      error={currentError}
                      isLoading={isLoading}
                      onNext={handleNextFromAlignment}
                      onBack={prevStep}
                    />
                  )}

                  {currentStep === "regent" && (
                    <Step3RegentSheet
                      regentName={regentForm.data.name}
                      setRegentName={(v) => regentForm.update({ name: v })}
                      regentDescription=""
                      setRegentDescription={() => {}}
                      selectedAvatar={regentForm.data.avatar || ""}
                      setSelectedAvatar={(v) =>
                        regentForm.update({ avatar: v })
                      }
                      selectedSkillId={regentForm.data.initialSkillId}
                      setSelectedSkillId={(v) =>
                        regentForm.update({ initialSkillId: v || undefined })
                      }
                      attributes={regentForm.data.attributes}
                      updateAttribute={regentForm.updateAttribute}
                      totalPoints={regentForm.totalPoints}
                      error={currentError}
                      isLoading={isLoading}
                      onSubmit={handleNextFromRegent}
                      onBack={prevStep}
                    />
                  )}

                  {currentStep === "troops" && (
                    <Step3Troops
                      templates={troopsForm.templates}
                      setTemplates={() => {}}
                      passives={staticData.passives}
                      error={currentError}
                      isLoading={isLoading}
                      onSubmit={handleFinalSubmit}
                      onBack={prevStep}
                      activeSlot={troopsForm.activeSlot}
                      setActiveSlot={troopsForm.setActiveSlot}
                      updateTemplate={troopsForm.updateTemplate}
                      updateAttribute={troopsForm.updateAttribute}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

function getStepTitle(step: WizardStep): string {
  switch (step) {
    case "info":
      return "🏰 Identidade do Reino";
    case "alignment":
      return "⚖️ Alinhamento";
    case "regent":
      return "👑 Criar Regente";
    case "troops":
      return "⚔️ Configurar Tropas";
    default:
      return "Criar Reino";
  }
}
