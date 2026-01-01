import React from "react";

interface Step1KingdomInfoProps {
  kingdomName: string;
  setKingdomName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
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
  error,
  isLoading,
  onNext,
  onCancel,
}) => {
  const isFormValid = kingdomName.length >= 3;

  return (
    <form onSubmit={onNext} className="space-y-6">
      {/* Título da Etapa */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-amber-400">
          🏰 Identidade do Reino
        </h2>
        <p className="text-slate-400 mt-2">
          Dê um nome ao seu reino e conte sua história
        </p>
      </div>

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
          className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg 
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
