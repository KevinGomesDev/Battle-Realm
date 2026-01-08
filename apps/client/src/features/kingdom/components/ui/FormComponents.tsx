// Kingdom UI Components
// Componentes de UI reutilizáveis para o módulo Kingdom

import React from "react";

// ============ FORM INPUT ============

interface FormInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  defaultIndicator?: string;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  required,
  disabled,
  defaultIndicator,
}) => (
  <div>
    <div className="flex items-center gap-2 mb-2">
      <label className="block text-sm font-semibold text-white">{label}</label>
      {defaultIndicator && (
        <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
          ★ {defaultIndicator}
        </span>
      )}
    </div>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 disabled:opacity-50"
    />
  </div>
);

// ============ FORM SELECT ============

interface FormSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface FormSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FormSelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  showDescription?: boolean;
}

export const FormSelect: React.FC<FormSelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  disabled,
  showDescription,
}) => {
  const selectedOption = options.find((o) => o.value === value);

  return (
    <div>
      <label className="block text-sm font-semibold text-white mb-2">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {showDescription && selectedOption?.description && (
        <p className="text-slate-400 text-xs mt-1">
          {selectedOption.description}
        </p>
      )}
    </div>
  );
};

// ============ ATTRIBUTE COUNTER ============

interface AttributeCounterProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

export const AttributeCounter: React.FC<AttributeCounterProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 30,
  disabled,
}) => (
  <div className="bg-slate-800/50 rounded p-3">
    <label className="block text-xs text-slate-400 mb-1">{label}</label>
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        className="w-8 h-8 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded text-white"
      >
        -
      </button>
      <span className="flex-1 text-center font-bold text-white">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        className="w-8 h-8 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded text-white"
      >
        +
      </button>
    </div>
  </div>
);

// ============ POINTS INDICATOR ============

interface PointsIndicatorProps {
  current: number;
  max: number;
  label?: string;
}

export const PointsIndicator: React.FC<PointsIndicatorProps> = ({
  current,
  max,
  label = "Pontos",
}) => {
  const isValid = current === max;
  const isOver = current > max;

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-white">{label}</span>
      <span
        className={`text-sm font-bold ${
          isValid
            ? "text-green-400"
            : isOver
            ? "text-red-400"
            : "text-yellow-400"
        }`}
      >
        {current} / {max}
      </span>
    </div>
  );
};

// ============ ERROR ALERT ============

interface ErrorAlertProps {
  message: string | null;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="bg-red-900/20 border border-red-700 rounded p-3">
      <p className="text-red-400 text-sm">{message}</p>
    </div>
  );
};

// ============ INFO TIP ============

interface InfoTipProps {
  children: React.ReactNode;
}

export const InfoTip: React.FC<InfoTipProps> = ({ children }) => (
  <div className="bg-blue-900/20 border border-blue-700 rounded p-3">
    <p className="text-blue-400 text-sm">
      <span className="font-semibold">💡 Dica:</span> {children}
    </p>
  </div>
);

// ============ FORM BUTTONS ============

interface FormButtonsProps {
  onBack?: () => void;
  onSubmit?: () => void;
  backLabel?: string;
  submitLabel?: string;
  isLoading?: boolean;
  isDisabled?: boolean;
  loadingLabel?: string;
  variant?: "next" | "submit";
}

export const FormButtons: React.FC<FormButtonsProps> = ({
  onBack,
  backLabel = "← Voltar",
  submitLabel = "Próximo →",
  isLoading,
  isDisabled,
  loadingLabel = "Carregando...",
  variant = "next",
}) => {
  const submitBg =
    variant === "submit"
      ? "bg-green-600 hover:bg-green-500"
      : "bg-blue-600 hover:bg-blue-500";

  return (
    <div className="flex gap-3 pt-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded"
        >
          {backLabel}
        </button>
      )}
      <button
        type="submit"
        disabled={isDisabled || isLoading}
        className={`flex-1 px-6 py-3 ${submitBg} disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded flex items-center justify-center gap-2`}
      >
        {isLoading ? (
          <>
            <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            {loadingLabel}
          </>
        ) : (
          submitLabel
        )}
      </button>
    </div>
  );
};

// ============ LOADING SPINNER ============

interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = "Carregando dados...",
}) => (
  <div className="flex flex-col items-center justify-center py-12">
    <div className="relative w-12 h-12">
      <div className="absolute inset-0 border-3 border-stellar-amber rounded-full animate-spin border-t-transparent" />
      <div
        className="absolute inset-2 border-2 border-stellar-gold rounded-full animate-spin border-b-transparent"
        style={{ animationDirection: "reverse" }}
      />
    </div>
    <p className="text-astral-steel mt-4">{message}</p>
  </div>
);

// ============ STEP INDICATOR ============

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentStep,
}) => (
  <div className="flex gap-1">
    {steps.map((_, idx) => (
      <div
        key={idx}
        className={`flex-1 h-1 rounded ${
          idx < currentStep
            ? "bg-green-500"
            : idx === currentStep
            ? "bg-stellar-gold"
            : "bg-surface-800"
        }`}
      />
    ))}
  </div>
);

// ============ BREADCRUMB ============

interface BreadcrumbProps {
  items: string[];
  currentIndex: number;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  currentIndex,
}) => (
  <div className="flex items-center justify-center gap-2 mt-2">
    {items.map((label, idx) => (
      <React.Fragment key={idx}>
        <span
          className={`text-xs ${
            idx === currentIndex
              ? "text-stellar-gold font-bold"
              : idx < currentIndex
              ? "text-astral-silver"
              : "text-astral-steel"
          }`}
        >
          {label}
        </span>
        {idx < items.length - 1 && <span className="text-surface-500">→</span>}
      </React.Fragment>
    ))}
  </div>
);

// ============ RESOURCE BUTTONS ============

interface ResourceButtonsProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const RESOURCES = [
  { id: "ore", name: "Ore", color: "text-amber-400" },
  { id: "supplies", name: "Supplies", color: "text-green-400" },
  { id: "arcane", name: "Arcane", color: "text-mystic-glow" },
  { id: "experience", name: "Experience", color: "text-blue-400" },
  { id: "devotion", name: "Devotion", color: "text-yellow-400" },
] as const;

export const ResourceButtons: React.FC<ResourceButtonsProps> = ({
  value,
  onChange,
  disabled,
}) => (
  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
    {RESOURCES.map((res) => (
      <button
        key={res.id}
        type="button"
        onClick={() => onChange(res.id)}
        disabled={disabled}
        className={`px-3 py-2 rounded text-sm font-medium transition-all ${
          value === res.id
            ? `bg-slate-600 ${res.color} ring-2 ring-blue-500`
            : "bg-slate-800 text-slate-400 hover:bg-slate-700"
        } disabled:opacity-50`}
      >
        {res.name}
      </button>
    ))}
  </div>
);
