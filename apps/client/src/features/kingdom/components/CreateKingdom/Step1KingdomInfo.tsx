import React from "react";
import { ChoiceCard } from "./ChoiceCard";
import type { Race, Alignment } from "./types";

interface Step1KingdomInfoProps {
  kingdomName: string;
  setKingdomName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  selectedRace: string;
  setSelectedRace: (value: string) => void;
  selectedAlignment: string;
  setSelectedAlignment: (value: string) => void;
  races: Race[];
  alignments: Alignment[];
  error: string | null;
  isLoading: boolean;
  onNext: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export const Step1KingdomInfo: React.FC<Step1KingdomInfoProps> = ({
  kingdomName,
  setKingdomName,
  description,
  setDescription,
  selectedRace,
  setSelectedRace,
  selectedAlignment,
  setSelectedAlignment,
  races,
  alignments,
  error,
  isLoading,
  onNext,
  onCancel,
}) => {
  const isFormValid =
    kingdomName.length >= 3 && selectedRace.length > 0 && selectedAlignment;

  const raceIcon: Record<string, string> = {
    HUMANOIDE: "👤",
    ABERRACAO: "👁️",
    CONSTRUTO: "🤖",
  };

  const alignmentTone: Record<string, "emerald" | "slate" | "rose"> = {
    BOM: "emerald",
    NEUTRO: "slate",
    MAL: "rose",
  };

  return (
    <form onSubmit={onNext} className="space-y-4">
      {/* Nome do Reino */}
      <div>
        <label className="block text-sm font-semibold text-white mb-2">
          Nome do Reino <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={kingdomName}
          onChange={(e) => setKingdomName(e.target.value)}
          placeholder="Digite o nome do seu reino..."
          className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg 
                     text-white placeholder:text-slate-500 
                     focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30
                     transition-all"
          required
          autoFocus
        />
        <p className="text-xs text-slate-500 mt-1">Mínimo de 3 caracteres</p>
      </div>

      {/* Raça */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-white">
          Escolha sua Raça <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {races.map((race) => (
            <ChoiceCard
              key={race.id}
              title={race.name}
              description={race.description}
              note={`${race.passiveName}: ${race.passiveEffect}`}
              badge="Raça"
              icon={raceIcon[race.id] || "🏰"}
              tone="amber"
              isSelected={selectedRace === race.id}
              onSelect={() => setSelectedRace(race.id)}
            />
          ))}
        </div>
      </div>

      {/* Alinhamento */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-white">
          Escolha seu Alinhamento <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {alignments.map((alignment) => (
            <ChoiceCard
              key={alignment.id}
              title={alignment.name}
              description={alignment.description}
              note={`${alignment.passiveName}: ${alignment.passiveEffect}`}
              badge={`Alinhamento • ${alignment.id}`}
              icon={
                alignment.id === "BOM"
                  ? "✨"
                  : alignment.id === "MAL"
                  ? "💀"
                  : "⚖️"
              }
              tone={alignmentTone[alignment.id] || "slate"}
              isSelected={selectedAlignment === alignment.id}
              onSelect={() => setSelectedAlignment(alignment.id)}
            />
          ))}
        </div>
      </div>

      {/* Descrição (Opcional) */}
      <div>
        <label className="block text-sm font-semibold text-white mb-2">
          História do Reino{" "}
          <span className="text-slate-500 font-normal">(opcional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Conte a história do seu reino, suas origens, cultura, tradições..."
          rows={4}
          className="w-full h-[80px] px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg 
                     text-white placeholder:text-slate-500 
                     focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30
                     resize-none transition-all"
          maxLength={500}
        />
        <p className="text-xs text-slate-500 mt-1 text-right">
          {description.length} / 500
        </p>
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
          onClick={onCancel}
          className="flex-1 px-6 py-3 bg-slate-700/50 hover:bg-slate-600/50 
                     text-slate-300 font-semibold rounded-lg transition-all
                     border border-slate-600/30"
        >
          Cancelar
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
