import React, { useState, useRef, useMemo } from "react";
import { getConditionInfo } from "../../constants";
import {
  getSkillInfo,
  isCommonAction,
} from "../../../../../../shared/data/skills.data";
import { getSpellByCode } from "../../../../../../shared/data/spells.data";
import type { BattleUnit } from "../../../../../../shared/types/battle.types";
import { AttributesDisplay } from "@/components/AttributesDisplay/index";
import { UI_SECTION_COLORS } from "../../../../config/colors.config";
import { Tooltip } from "@/components/Tooltip";
import {
  AnimatedCharacterSprite,
  parseAvatarToHeroId,
} from "../../../kingdom/components/CreateKingdom";
import { isPlayerControllable } from "../../utils/unit-control";

// =============================================================================
// TIPOS E INTERFACES
// =============================================================================

interface StatInfo {
  icon: string;
  name: string;
  value: string | number;
  description: string;
  color: string;
  details?: string[];
}

// =============================================================================
// COMPONENTES AUXILIARES
// =============================================================================

// Stat Badge - Ícone com tooltip detalhado
const StatBadge: React.FC<{ stat: StatInfo }> = ({ stat }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={badgeRef}
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className="w-9 h-9 rounded-lg border-2 flex flex-col items-center justify-center cursor-help transition-all hover:scale-105"
        style={{
          borderColor: stat.color,
          backgroundColor: `${stat.color}15`,
        }}
      >
        <span className="text-xs leading-none">{stat.icon}</span>
        <span
          className="font-bold text-[10px] leading-none mt-0.5"
          style={{ color: stat.color }}
        >
          {stat.value}
        </span>
      </div>

      {/* Tooltip */}
      <Tooltip
        anchorRef={badgeRef}
        visible={showTooltip}
        preferredPosition="top"
        width="w-56"
      >
        <p className="text-gray-100 font-bold text-xs mb-1 flex items-center gap-1.5">
          <span className="text-base">{stat.icon}</span>
          <span>{stat.name}</span>
          <span className="ml-auto font-mono" style={{ color: stat.color }}>
            {stat.value}
          </span>
        </p>
        <p className="text-gray-300 text-[10px] leading-relaxed mb-1">
          {stat.description}
        </p>
        {stat.details && stat.details.length > 0 && (
          <div className="border-t border-gray-700 pt-1 mt-1">
            {stat.details.map((detail, i) => (
              <p
                key={i}
                className="text-gray-400 text-[9px] flex items-center gap-1"
              >
                <span className="text-gray-500">•</span>
                {detail}
              </p>
            ))}
          </div>
        )}
      </Tooltip>
    </div>
  );
};

// Derived Stats - Seção de stats derivados
const DerivedStats: React.FC<{ unit: BattleUnit }> = ({ unit }) => {
  const stats = useMemo(() => {
    const result: StatInfo[] = [];

    // Calcular esquiva
    const baseDodge = unit.speed * 3;
    const hasDodging = unit.conditions.includes("DODGING");
    const dodgeBonus = hasDodging ? 50 : 0;
    const totalDodge = Math.min(baseDodge + dodgeBonus, 75);

    result.push({
      icon: "🌀",
      name: "Chance de Esquiva",
      value: `${totalDodge}%`,
      description: "Chance de evitar ataques físicos.",
      color: "#22d3ee", // cyan-400
      details: [
        `Base (Speed × 3): ${baseDodge}%`,
        ...(hasDodging ? [`Postura Defensiva: +${dodgeBonus}%`] : []),
        `Máximo: 75%`,
      ],
    });

    // Dano base de ataque
    result.push({
      icon: "⚔️",
      name: "Dano Base",
      value: unit.combat,
      description: "Dano causado por ataques físicos.",
      color: "#f87171", // red-400
      details: [`Combat: ${unit.combat}`, `Dano = Combat × Multiplicador`],
    });

    // Poder mágico
    if (unit.focus > 0) {
      result.push({
        icon: "✨",
        name: "Poder Mágico",
        value: unit.focus,
        description: "Potência de habilidades mágicas.",
        color: "#a78bfa", // violet-400
        details: [`Focus: ${unit.focus}`, `Dano Mágico = Focus × Tier`],
      });
    }

    // Movimento
    result.push({
      icon: "👣",
      name: "Movimento",
      value: unit.speed,
      description: "Células que pode percorrer por turno.",
      color: "#60a5fa", // blue-400
      details: [`Base (Speed): ${unit.speed}`, `Dash: +${unit.speed} extra`],
    });

    return result;
  }, [unit]);

  return (
    <div className="flex-shrink-0 px-3">
      <h4
        className={`${UI_SECTION_COLORS.stats.title} text-[10px] font-bold uppercase tracking-wider pb-1 mb-1.5 border-b ${UI_SECTION_COLORS.stats.border}`}
      >
        Stats
      </h4>
      <div className="flex gap-1.5 flex-wrap max-w-[200px]">
        {stats.map((stat, i) => (
          <StatBadge key={i} stat={stat} />
        ))}
      </div>
    </div>
  );
};

// Condition Badge - Apenas ícone com hover
const ConditionBadge: React.FC<{ condition: string }> = ({ condition }) => {
  const info = getConditionInfo(condition);
  const [showTooltip, setShowTooltip] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={badgeRef}
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className="w-7 h-7 rounded-lg border-2 flex items-center justify-center cursor-help"
        style={{
          borderColor: info.color,
          backgroundColor: `${info.color}20`,
        }}
      >
        <span className="text-sm">{info.icon}</span>
      </div>

      {/* Tooltip */}
      <Tooltip
        anchorRef={badgeRef}
        visible={showTooltip}
        preferredPosition="top"
        width="w-52"
      >
        <p className="text-gray-100 font-bold text-xs mb-1 flex items-center gap-1.5">
          <span className="text-base">{info.icon}</span>
          <span>{info.name}</span>
        </p>
        <p className="text-gray-300 text-[10px] leading-relaxed">
          {info.description}
        </p>
      </Tooltip>
    </div>
  );
};

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

interface UnitPanelProps {
  selectedUnit: BattleUnit | null;
  activeUnitId: string | undefined;
  isMyTurn: boolean;
  currentUserId: string;
  pendingAction: string | null;
  onSetPendingAction: (action: string | null) => void;
  onExecuteAction: (actionKey: string, unitId: string) => void;
  onEndAction: () => void;
}

export const UnitPanel: React.FC<UnitPanelProps> = ({
  selectedUnit,
  activeUnitId,
  isMyTurn,
  currentUserId,
  pendingAction,
  onSetPendingAction,
  onExecuteAction,
  onEndAction,
}) => {
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"actions" | "skills" | "spells">(
    "actions"
  );

  // Categorizar ações (fora do render condicional)
  // Ações comuns são skills com commonAction: true
  const categorizedActions = useMemo(() => {
    const commonActions: string[] = [];
    const skills: string[] = [];
    const spells: string[] = [];

    if (selectedUnit) {
      // Features da unidade (ações comuns + skills de classe)
      selectedUnit.features?.forEach((featureCode) => {
        // Ações comuns (ATTACK, DASH, DODGE) vão para a aba de ações
        if (isCommonAction(featureCode)) {
          commonActions.push(featureCode);
        } else if (getSkillInfo(featureCode)) {
          // Skills de classe
          skills.push(featureCode);
        }
      });

      // Spells (magias)
      if (selectedUnit.spells && selectedUnit.spells.length > 0) {
        selectedUnit.spells.forEach((spellCode) => {
          spells.push(spellCode);
        });
      }
    }

    return { actions: commonActions, skills, spells };
  }, [selectedUnit]);

  // Define aba inicial quando o menu abre
  React.useEffect(() => {
    if (actionsMenuOpen) {
      if (categorizedActions.actions.length > 0) setActiveTab("actions");
      else if (categorizedActions.skills.length > 0) setActiveTab("skills");
      else if (categorizedActions.spells.length > 0) setActiveTab("spells");
    }
  }, [actionsMenuOpen, categorizedActions]);

  // Se activeUnitId está undefined mas é meu turno e a unidade é minha (e controlável),
  // consideramos que está "aguardando ativação" e tratamos como se fosse ativa
  const isActiveOrPending = activeUnitId
    ? selectedUnit?.id === activeUnitId
    : isMyTurn &&
      selectedUnit &&
      isPlayerControllable(selectedUnit, currentUserId);

  if (!selectedUnit) {
    return (
      <div className="absolute bottom-0 left-0 right-0 bg-gray-900 border-t-2 border-gray-700 shadow-2xl">
        <div className="py-3 text-center">
          <p className="text-gray-300 text-sm flex items-center justify-center gap-2">
            <span className="text-xl">👁️</span>
            <span>Selecione uma unidade para ver detalhes</span>
          </p>
        </div>
      </div>
    );
  }

  const canAct =
    isMyTurn &&
    selectedUnit &&
    isPlayerControllable(selectedUnit, currentUserId) &&
    isActiveOrPending;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20">
      {/* Container principal */}
      <div className="bg-gray-900/90 backdrop-blur-sm border-2 border-gray-700 rounded-xl shadow-2xl">
        <div className="flex items-stretch divide-x-2 divide-gray-700 px-3 py-2">
          {/* SEÇÃO 1: DADOS BÁSICOS */}
          <div className="flex-shrink-0 pr-3">
            <h4
              className={`${UI_SECTION_COLORS.basicData.title} text-[10px] font-bold uppercase tracking-wider pb-1 mb-1.5 border-b ${UI_SECTION_COLORS.basicData.border}`}
            >
              Dados Básicos
            </h4>
            <div className="flex items-center gap-2">
              {/* Avatar - Sprite animado */}
              <div className="relative">
                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-gray-600 shadow-lg overflow-hidden flex items-center justify-center">
                  <AnimatedCharacterSprite
                    heroId={parseAvatarToHeroId(selectedUnit.avatar)}
                    animation="Idle"
                    direction="right"
                  />
                </div>
                <div className="absolute -top-0.5 -right-0.5 bg-amber-500 text-gray-900 font-bold text-[9px] px-1 py-0.5 rounded-full border border-amber-300">
                  {selectedUnit.level}
                </div>
              </div>

              {/* Nome + Barras */}
              <div className="min-w-[200px]">
                <h3
                  className="text-gray-100 font-bold text-xs mb-0.5"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {selectedUnit.name}
                </h3>

                {/* HP Bar */}
                <div className="relative h-5 bg-gray-800/80 rounded border border-red-900/50 overflow-hidden mb-1">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-600 to-red-500 transition-all duration-300 flex items-center justify-end pr-1.5"
                    style={{
                      width: `${
                        (selectedUnit.currentHp / selectedUnit.maxHp) * 100
                      }%`,
                    }}
                  >
                    <span className="text-white font-bold text-xs drop-shadow-lg">
                      {selectedUnit.currentHp}
                    </span>
                  </div>
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">
                    /{selectedUnit.maxHp}
                  </span>
                </div>

                {/* Proteções inline */}
                <div className="flex gap-1.5">
                  {/* Proteção Física */}
                  <div className="flex-1 relative h-4 bg-gray-800/80 rounded border border-blue-500/40 overflow-hidden">
                    {selectedUnit.physicalProtection > 0 ? (
                      <>
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-blue-400 transition-all flex items-center justify-end pr-1"
                          style={{
                            width: `${
                              selectedUnit.maxPhysicalProtection > 0
                                ? (selectedUnit.physicalProtection /
                                    selectedUnit.maxPhysicalProtection) *
                                  100
                                : 0
                            }%`,
                          }}
                        >
                          <span className="text-white font-bold text-[10px] drop-shadow">
                            {selectedUnit.physicalProtection}
                          </span>
                        </div>
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-blue-300/60 font-bold text-[10px]">
                          /{selectedUnit.maxPhysicalProtection}
                        </span>
                      </>
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-blue-400/50 font-bold text-[10px] italic">
                        Quebrado
                      </span>
                    )}
                  </div>
                  {/* Proteção Mágica */}
                  <div className="flex-1 relative h-4 bg-gray-800/80 rounded border border-purple-500/40 overflow-hidden">
                    {selectedUnit.magicalProtection > 0 ? (
                      <>
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 to-purple-400 transition-all flex items-center justify-end pr-1"
                          style={{
                            width: `${
                              selectedUnit.maxMagicalProtection > 0
                                ? (selectedUnit.magicalProtection /
                                    selectedUnit.maxMagicalProtection) *
                                  100
                                : 0
                            }%`,
                          }}
                        >
                          <span className="text-white font-bold text-[10px] drop-shadow">
                            {selectedUnit.magicalProtection}
                          </span>
                        </div>
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-purple-300/60 font-bold text-[10px]">
                          /{selectedUnit.maxMagicalProtection}
                        </span>
                      </>
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-purple-400/50 font-bold text-[10px] italic">
                        Quebrado
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: ATRIBUTOS */}
          <div className="flex-shrink-0 px-3">
            <h4
              className={`${UI_SECTION_COLORS.attributes.title} text-[10px] font-bold uppercase tracking-wider pb-1 mb-1.5 border-b ${UI_SECTION_COLORS.attributes.border}`}
            >
              Atributos
            </h4>
            <AttributesDisplay
              attributes={{
                combat: selectedUnit.combat,
                speed: selectedUnit.speed,
                focus: selectedUnit.focus,
                armor: selectedUnit.armor,
                vitality: selectedUnit.vitality,
              }}
              editable={false}
            />
          </div>

          {/* SEÇÃO 2.5: STATS DERIVADOS */}
          <DerivedStats unit={selectedUnit} />

          {/* SEÇÃO 3: AÇÕES */}
          {isMyTurn && isActiveOrPending && selectedUnit.hasStartedAction && (
            <div className="flex-shrink-0 px-3">
              <h4
                className={`${UI_SECTION_COLORS.actions.title} text-[10px] font-bold uppercase tracking-wider pb-1 mb-1.5 border-b ${UI_SECTION_COLORS.actions.border}`}
              >
                Recursos
              </h4>
              <div className="flex items-center gap-2">
                {/* Ação */}
                <div
                  className={`w-9 h-9 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                    selectedUnit.actionsLeft > 0
                      ? "border-emerald-500 bg-emerald-500/15"
                      : "border-gray-600 bg-gray-800/50"
                  }`}
                >
                  <span className="text-xs">⚡</span>
                  <span
                    className={`font-bold text-[10px] ${
                      selectedUnit.actionsLeft > 0
                        ? "text-emerald-400"
                        : "text-gray-500"
                    }`}
                  >
                    {selectedUnit.actionsLeft}
                  </span>
                </div>

                {/* Movimento */}
                <div
                  className={`w-9 h-9 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                    selectedUnit.movesLeft > 0
                      ? "border-blue-500 bg-blue-500/15"
                      : "border-gray-600 bg-gray-800/50"
                  }`}
                >
                  <span className="text-xs">👣</span>
                  <span
                    className={`font-bold text-[10px] ${
                      selectedUnit.movesLeft > 0
                        ? "text-blue-400"
                        : "text-gray-500"
                    }`}
                  >
                    {selectedUnit.movesLeft}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* SEÇÃO 4: CONDIÇÕES */}
          {selectedUnit.conditions.length > 0 && (
            <div className="px-3 min-w-[120px] max-w-[300px]">
              <h4
                className={`${UI_SECTION_COLORS.conditions.title} text-[10px] font-bold uppercase tracking-wider pb-1 mb-1.5 border-b ${UI_SECTION_COLORS.conditions.border}`}
              >
                Condições
              </h4>
              <div className="flex items-start gap-1 flex-wrap max-h-[60px] overflow-y-auto">
                {selectedUnit.conditions.map((cond, i) => (
                  <ConditionBadge key={i} condition={cond} />
                ))}
              </div>
            </div>
          )}

          {/* CONTROLES */}
          {canAct && (
            <div className="flex-1 flex items-center justify-end gap-2 px-3">
              {/* Botão de Ações */}
              <div className="relative">
                <button
                  onClick={() => setActionsMenuOpen(!actionsMenuOpen)}
                  className="px-4 py-2 bg-gradient-to-b from-blue-600 to-blue-800 border-2 border-blue-500 rounded-lg text-white font-bold text-sm hover:from-blue-500 hover:to-blue-700 transition-all shadow-lg flex items-center gap-2"
                >
                  <span>⚡</span>
                  <span>Ações</span>
                  <span className="text-xs">{actionsMenuOpen ? "▲" : "▼"}</span>
                </button>

                {/* Menu de Ações */}
                {actionsMenuOpen && (
                  <div className="absolute bottom-full left-0 mb-[32px] bg-gray-900/95 backdrop-blur-sm border-2 border-gray-600 rounded-xl shadow-2xl min-w-[280px] max-w-[400px]">
                    {/* Abas */}
                    <div className="flex border-b border-gray-700">
                      {categorizedActions.actions.length > 0 && (
                        <button
                          onClick={() => setActiveTab("actions")}
                          className={`flex-1 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
                            activeTab === "actions"
                              ? "bg-blue-600/20 text-blue-400 border-b-2 border-blue-500"
                              : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
                          }`}
                        >
                          <span className="mr-1.5">⚔️</span>
                          Ações
                        </button>
                      )}
                      {categorizedActions.skills.length > 0 && (
                        <button
                          onClick={() => setActiveTab("skills")}
                          className={`flex-1 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
                            activeTab === "skills"
                              ? "bg-amber-600/20 text-amber-400 border-b-2 border-amber-500"
                              : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
                          }`}
                        >
                          <span className="mr-1.5">✨</span>
                          Habilidades
                        </button>
                      )}
                      {categorizedActions.spells.length > 0 && (
                        <button
                          onClick={() => setActiveTab("spells")}
                          className={`flex-1 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
                            activeTab === "spells"
                              ? "bg-purple-600/20 text-purple-400 border-b-2 border-purple-500"
                              : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
                          }`}
                        >
                          <span className="mr-1.5">🔮</span>
                          Magias
                        </button>
                      )}
                    </div>

                    {/* Conteúdo das Abas */}
                    <div className="p-3">
                      {/* Aba de Ações (Ações Comuns) */}
                      {activeTab === "actions" &&
                        categorizedActions.actions.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {categorizedActions.actions.map((actionKey) => {
                              const skillInfo = getSkillInfo(actionKey);
                              if (!skillInfo) return null;

                              const isAttackAction = actionKey === "ATTACK";
                              const hasExtraAttacks =
                                (selectedUnit.attacksLeftThisTurn ?? 0) > 0;
                              const canExecute = isAttackAction
                                ? selectedUnit.actionsLeft > 0 ||
                                  hasExtraAttacks
                                : selectedUnit.actionsLeft > 0;

                              return (
                                <button
                                  key={actionKey}
                                  onClick={() => {
                                    if (!canExecute) return;
                                    if (skillInfo.requiresTarget) {
                                      onSetPendingAction(actionKey);
                                      setActionsMenuOpen(false);
                                    } else {
                                      onExecuteAction(
                                        actionKey,
                                        selectedUnit.id
                                      );
                                      setActionsMenuOpen(false);
                                    }
                                  }}
                                  disabled={!canExecute}
                                  className={`w-full px-3 py-2.5 rounded-lg border text-left transition-all flex items-center gap-3 ${
                                    canExecute
                                      ? "bg-gray-800 hover:bg-gray-700 border-gray-600 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/20"
                                      : "bg-gray-800/40 border-gray-700/50 opacity-40 cursor-not-allowed"
                                  }`}
                                >
                                  <span className="text-xl w-6 text-center">
                                    {skillInfo.icon}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-gray-100 text-sm font-semibold block">
                                      {skillInfo.name}
                                    </span>
                                    <span className="text-gray-500 text-[9px] block truncate">
                                      {skillInfo.description}
                                    </span>
                                  </div>
                                  {skillInfo.requiresTarget && (
                                    <span className="text-gray-500 text-[10px]">
                                      🎯
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                      {/* Aba de Skills */}
                      {activeTab === "skills" &&
                        categorizedActions.skills.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {categorizedActions.skills.map((skillCode) => {
                              const skillInfo = getSkillInfo(skillCode);
                              if (!skillInfo) return null;

                              // Verificar cooldown
                              const cooldownLeft =
                                selectedUnit.unitCooldowns?.[skillCode] ?? 0;
                              const isOnCooldown = cooldownLeft > 0;
                              const canExecute =
                                selectedUnit.actionsLeft > 0 && !isOnCooldown;

                              return (
                                <button
                                  key={skillCode}
                                  onClick={() => {
                                    if (!canExecute) return;
                                    if (skillInfo.requiresTarget) {
                                      onSetPendingAction(skillCode);
                                      setActionsMenuOpen(false);
                                    } else {
                                      onExecuteAction(
                                        skillCode,
                                        selectedUnit.id
                                      );
                                      setActionsMenuOpen(false);
                                    }
                                  }}
                                  disabled={!canExecute}
                                  className={`w-full px-3 py-2.5 rounded-lg border text-left transition-all flex items-center gap-3 ${
                                    isOnCooldown
                                      ? "bg-gray-900/60 border-gray-700/50 opacity-60 cursor-not-allowed"
                                      : canExecute
                                      ? "bg-gray-800 hover:bg-gray-700 border-gray-600 hover:border-amber-500 hover:shadow-lg hover:shadow-amber-500/20"
                                      : "bg-gray-800/40 border-gray-700/50 opacity-40 cursor-not-allowed"
                                  }`}
                                >
                                  <span className="text-xl w-6 text-center relative">
                                    {skillInfo.icon}
                                    {isOnCooldown && (
                                      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-red-400">
                                        {cooldownLeft}
                                      </span>
                                    )}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <span
                                      className={`text-sm font-semibold block ${
                                        isOnCooldown
                                          ? "text-gray-400"
                                          : "text-gray-100"
                                      }`}
                                    >
                                      {skillInfo.name}
                                    </span>
                                    <span className="text-gray-500 text-[9px] block truncate">
                                      {isOnCooldown
                                        ? `⏳ Cooldown: ${cooldownLeft} rodada${
                                            cooldownLeft > 1 ? "s" : ""
                                          }`
                                        : skillInfo.description}
                                    </span>
                                  </div>
                                  {skillInfo.requiresTarget &&
                                    !isOnCooldown && (
                                      <span className="text-gray-500 text-[10px]">
                                        🎯
                                      </span>
                                    )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                      {/* Aba de Magias */}
                      {activeTab === "spells" &&
                        categorizedActions.spells.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {categorizedActions.spells.map((spellCode) => {
                              const spellInfo = getSpellByCode(spellCode);
                              if (!spellInfo) return null;

                              // Verificar cooldown da spell
                              const cooldownLeft =
                                selectedUnit.unitCooldowns?.[spellCode] ?? 0;
                              const isOnCooldown = cooldownLeft > 0;
                              const canExecute =
                                selectedUnit.actionsLeft > 0 && !isOnCooldown;

                              return (
                                <button
                                  key={spellCode}
                                  onClick={() => {
                                    if (!canExecute) return;
                                    onSetPendingAction(`spell:${spellCode}`);
                                    setActionsMenuOpen(false);
                                  }}
                                  disabled={!canExecute}
                                  className={`w-full px-3 py-2.5 rounded-lg border text-left transition-all flex items-center gap-3 ${
                                    canExecute
                                      ? "bg-gray-800 hover:bg-gray-700 border-gray-600 hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/20"
                                      : "bg-gray-800/40 border-gray-700/50 opacity-40 cursor-not-allowed"
                                  }`}
                                >
                                  <div className="relative">
                                    <span className="text-xl w-6 text-center">
                                      {spellInfo.icon}
                                    </span>
                                    {isOnCooldown && (
                                      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                        {cooldownLeft}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-gray-100 text-sm font-semibold block">
                                      {spellInfo.name}
                                    </span>
                                    <span
                                      className={`text-[9px] block truncate ${
                                        isOnCooldown
                                          ? "text-red-400"
                                          : "text-purple-400"
                                      }`}
                                    >
                                      {isOnCooldown
                                        ? `⏳ Cooldown: ${cooldownLeft} rodadas`
                                        : spellInfo.description}
                                    </span>
                                  </div>
                                  {!isOnCooldown && (
                                    <span className="text-purple-400 text-[10px]">
                                      🎯
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>

              {/* Botão Finalizar */}
              <button
                onClick={onEndAction}
                className="px-4 py-2 bg-gradient-to-b from-amber-600 to-amber-800 border-2 border-amber-500 rounded-lg text-white font-bold text-sm hover:from-amber-500 hover:to-amber-700 transition-all shadow-lg flex items-center gap-2"
              >
                <span>⏭️</span>
                <span>Finalizar</span>
              </button>
            </div>
          )}

          {/* Mensagem de visualização */}
          {isMyTurn &&
            selectedUnit &&
            isPlayerControllable(selectedUnit, currentUserId) &&
            !isActiveOrPending && (
              <div className="px-4 py-2 bg-amber-900/40 border border-amber-600/50 rounded-lg">
                <p className="text-amber-400 text-xs font-semibold flex items-center gap-1">
                  <span>👁️</span>
                  <span>
                    Visualizando - Selecione a unidade ativa para agir
                  </span>
                </p>
              </div>
            )}
        </div>

        {/* Ação Pendente */}
        {pendingAction && (
          <div className="bg-amber-500/20 border-t-2 border-amber-500/50 px-4 py-2 flex items-center justify-between">
            <span className="text-amber-400 text-sm font-semibold animate-pulse flex items-center gap-2">
              <span>🎯</span>
              <span>
                {pendingAction.startsWith("spell:")
                  ? (() => {
                      const spellCode = pendingAction.replace("spell:", "");
                      const spell = getSpellByCode(spellCode);
                      if (spell) {
                        const targetText =
                          spell.targetType === "POSITION" ||
                          spell.targetType === "GROUND"
                            ? "uma posição"
                            : spell.targetType === "ALLY"
                            ? "um aliado"
                            : spell.targetType === "ENEMY"
                            ? "um inimigo"
                            : "um alvo";
                        return `${spell.icon} ${spell.name}: Selecione ${targetText}...`;
                      }
                      return "Selecione um alvo...";
                    })()
                  : "Selecione um alvo..."}
              </span>
            </span>
            <button
              onClick={() => onSetPendingAction(null)}
              className="px-3 py-1 bg-gray-700/70 hover:bg-gray-600/70 border border-gray-500 rounded text-white text-xs transition-colors"
            >
              ✕ Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
