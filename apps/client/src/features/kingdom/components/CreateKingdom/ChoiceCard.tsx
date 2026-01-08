import React from "react";

interface ChoiceCardProps {
  title: string;
  description: string;
  note: string;
  badge: string;
  icon?: string;
  tone: "amber" | "emerald" | "slate" | "rose";
  isSelected: boolean;
  onSelect: () => void;
}

const toneStyles: Record<
  ChoiceCardProps["tone"],
  { ring: string; bg: string; chip: string; text: string; icon: string }
> = {
  amber: {
    ring: "ring-amber-400/60",
    bg: "from-amber-500/10 via-slate-900 to-slate-900",
    chip: "border-amber-400/40 text-amber-100 bg-amber-500/10",
    text: "text-amber-100",
    icon: "text-amber-200",
  },
  emerald: {
    ring: "ring-emerald-400/60",
    bg: "from-emerald-500/10 via-slate-900 to-slate-900",
    chip: "border-emerald-400/40 text-emerald-100 bg-emerald-500/10",
    text: "text-emerald-100",
    icon: "text-emerald-200",
  },
  slate: {
    ring: "ring-slate-400/60",
    bg: "from-slate-500/10 via-slate-900 to-slate-900",
    chip: "border-slate-300/40 text-slate-100 bg-slate-500/10",
    text: "text-slate-100",
    icon: "text-slate-200",
  },
  rose: {
    ring: "ring-rose-400/60",
    bg: "from-rose-500/10 via-slate-900 to-slate-900",
    chip: "border-rose-400/40 text-rose-100 bg-rose-500/10",
    text: "text-rose-100",
    icon: "text-rose-200",
  },
};

export const ChoiceCard: React.FC<ChoiceCardProps> = ({
  title,
  description,
  note,
  badge,
  icon,
  tone,
  isSelected,
  onSelect,
}) => {
  const toneStyle = toneStyles[tone];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative w-full overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/60 p-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:border-slate-500/60 hover:shadow-lg hover:shadow-black/30 focus:outline-none focus-visible:${
        toneStyle.ring
      } ${
        isSelected ? `border-transparent ring-2 ${toneStyle.ring}` : "ring-0"
      }`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${
          toneStyle.bg
        } opacity-70 transition-opacity duration-200 ${
          isSelected ? "opacity-90" : "opacity-60"
        }`}
      />
      <div className="relative flex items-start gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-lg border border-slate-600/60 bg-slate-800/60 text-xl ${toneStyle.icon}`}
        >
          {icon || "✨"}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white leading-tight">
              {title}
            </h4>
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-tight ${toneStyle.chip}`}
            >
              {badge}
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-snug line-clamp-2">
            {description}
          </p>
          <p className="text-[11px] leading-snug text-slate-200/80">
            <span className={`font-semibold ${toneStyle.text}`}>
              {note.split(":")[0]}:
            </span>{" "}
            <span className="text-slate-200/80 line-clamp-1">
              {note.replace(/^[^:]*:\s*/, "")}
            </span>
          </p>
        </div>
      </div>
      {isSelected && (
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-slate-950/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-500/40">
          ✓ Selecionado
        </div>
      )}
    </button>
  );
};
