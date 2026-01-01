import React from "react";
import { AlignmentCard } from "./AlignmentCard";
import type { Alignment } from "./types";

interface Step2AlignmentProps {
  selectedAlignment: string;
  setSelectedAlignment: (value: string) => void;
  alignments: Alignment[];
  error: string | null;
  isLoading: boolean;
  onNext: (e: React.FormEvent) => void;
  onBack: () => void;
}

export const Step2Alignment: React.FC<Step2AlignmentProps> = ({
  selectedAlignment,
  setSelectedAlignment,
  alignments,
  error,
  isLoading,
  onNext,
  onBack,
}) => {
  const isFormValid = !!selectedAlignment;

  return (
    <form onSubmit={onNext} className="space-y-6">
      {/* Título da Etapa */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-amber-400">⚖️ Alinhamento</h2>
        <p className="text-slate-400 mt-2">
          Escolha a natureza moral do seu reino
        </p>
      </div>

      {/* Seleção de Alinhamento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {alignments.map((alignment) => (
          <AlignmentCard
            key={alignment.id}
            alignment={alignment}
            isSelected={selectedAlignment === alignment.id}
            onSelect={() => setSelectedAlignment(alignment.id)}
          />
        ))}
      </div>

      {/* Erro */}
      {error && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Botões */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 px-6 py-3 bg-slate-700/50 hover:bg-slate-600/50 
                     text-slate-300 font-semibold rounded-lg transition-all
                     border border-slate-600/30"
        >
          ← Voltar
        </button>
        <button
          type="submit"
          disabled={!isFormValid || isLoading}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-700 
                     hover:from-amber-500 hover:to-amber-600
                     disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed 
                     text-white font-semibold rounded-lg transition-all
                     shadow-lg shadow-amber-900/30"
        >
          Próximo →
        </button>
      </div>
    </form>
  );
};
