import React, { useState, useMemo } from "react";
import type { BattleEndedResponse } from "../../types/arena.types";
import type { BattleUnit } from "../../../../../../shared/types/battle.types";

interface BattleResultModalProps {
  result: BattleEndedResponse;
  units: BattleUnit[];
  isWinner: boolean;
  myKingdomName: string;
  opponentKingdomName: string;
  myUserId: string;
  onRematch: () => void;
  onLeave: () => void;
  rematchPending?: boolean;
  opponentWantsRematch?: boolean;
  vsBot?: boolean;
}

type ViewTab = "summary" | "myUnits" | "enemyUnits";

/**
 * BattleResultModal - Modal moderno exibido ao final de uma batalha
 * Preparado para lidar com centenas de unidades usando tabs e virtualização
 */
export const BattleResultModal: React.FC<BattleResultModalProps> = ({
  result,
  units,
  isWinner,
  myKingdomName,
  opponentKingdomName,
  myUserId,
  onRematch,
  onLeave,
  rematchPending,
  opponentWantsRematch,
  vsBot,
}) => {
  const [activeTab, setActiveTab] = useState<ViewTab>("summary");

  // Separar unidades
  const myUnits = useMemo(
    () => units.filter((u) => u.ownerId === myUserId),
    [units, myUserId]
  );
  const enemyUnits = useMemo(
    () => units.filter((u) => u.ownerId !== myUserId),
    [units, myUserId]
  );

  // Calcular estatísticas
  const stats = useMemo(() => {
    const myAlive = myUnits.filter((u) => u.isAlive && u.currentHp > 0);
    const myDead = myUnits.filter((u) => !u.isAlive || u.currentHp <= 0);
    const enemyAlive = enemyUnits.filter((u) => u.isAlive && u.currentHp > 0);
    const enemyDead = enemyUnits.filter((u) => !u.isAlive || u.currentHp <= 0);

    const myTotalHp = myUnits.reduce((sum, u) => sum + u.maxHp, 0);
    const myCurrentHp = myUnits.reduce(
      (sum, u) => sum + Math.max(0, u.currentHp),
      0
    );
    const enemyTotalHp = enemyUnits.reduce((sum, u) => sum + u.maxHp, 0);
    const enemyCurrentHp = enemyUnits.reduce(
      (sum, u) => sum + Math.max(0, u.currentHp),
      0
    );

    return {
      myAlive: myAlive.length,
      myDead: myDead.length,
      myTotal: myUnits.length,
      myHpPercent: myTotalHp > 0 ? (myCurrentHp / myTotalHp) * 100 : 0,
      enemyAlive: enemyAlive.length,
      enemyDead: enemyDead.length,
      enemyTotal: enemyUnits.length,
      enemyHpPercent:
        enemyTotalHp > 0 ? (enemyCurrentHp / enemyTotalHp) * 100 : 0,
    };
  }, [myUnits, enemyUnits]);

  // Componente de unidade compacto para listas grandes
  const UnitRow: React.FC<{ unit: BattleUnit; isEnemy: boolean }> = ({
    unit,
    isEnemy,
  }) => {
    const hpPercent = (unit.currentHp / unit.maxHp) * 100;
    const isDead = !unit.isAlive || unit.currentHp <= 0;

    return (
      <div
        className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
          isDead
            ? "bg-surface-800/40 opacity-70"
            : isEnemy
            ? "bg-red-900/20 hover:bg-red-900/30"
            : "bg-blue-900/20 hover:bg-blue-900/30"
        }`}
      >
        {/* Status Icon */}
        <div className="text-lg w-6 text-center">
          {isDead ? "💀" : isEnemy ? "⚔️" : "👤"}
        </div>

        {/* Nome e Stats */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`font-medium truncate ${
                isDead ? "text-surface-300 line-through" : "text-astral-chrome"
              }`}
            >
              {unit.name}
            </span>
            <span className="text-xs text-surface-200">Lv.{unit.level}</span>
          </div>

          {/* HP Bar compacta */}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-cosmos-void rounded-full overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.max(0, hpPercent)}%`,
                  backgroundColor: isDead
                    ? "#374151"
                    : hpPercent > 60
                    ? "#22c55e"
                    : hpPercent > 30
                    ? "#eab308"
                    : "#ef4444",
                }}
              />
            </div>
            <span className="text-xs text-surface-200 whitespace-nowrap">
              {unit.currentHp}/{unit.maxHp}
            </span>
          </div>
        </div>

        {/* Stats compactos */}
        <div className="hidden sm:flex items-center gap-3 text-xs text-surface-200">
          <span title="Combate">⚔️{unit.combat}</span>
          <span title="Velocidade">💨{unit.speed}</span>
          <span title="Foco">🎯{unit.focus}</span>
          <span title="Resistência">🛡️{unit.resistance}</span>
          <span title="Vontade">🧠{unit.will}</span>
        </div>
      </div>
    );
  };

  // Lista de unidades com scroll virtual para grandes quantidades
  const UnitList: React.FC<{ unitList: BattleUnit[]; isEnemy: boolean }> = ({
    unitList,
    isEnemy,
  }) => {
    // Ordenar: vivos primeiro, depois mortos
    const sortedUnits = useMemo(
      () =>
        [...unitList].sort((a, b) => {
          const aAlive = a.isAlive && a.currentHp > 0 ? 1 : 0;
          const bAlive = b.isAlive && b.currentHp > 0 ? 1 : 0;
          if (aAlive !== bAlive) return bAlive - aAlive;
          return b.currentHp / b.maxHp - a.currentHp / a.maxHp;
        }),
      [unitList]
    );

    if (sortedUnits.length === 0) {
      return (
        <div className="text-center text-surface-200 py-8">Nenhuma unidade</div>
      );
    }

    return (
      <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
        {sortedUnits.map((unit) => (
          <UnitRow key={unit.id} unit={unit} isEnemy={isEnemy} />
        ))}
      </div>
    );
  };

  // Stat Card para o resumo
  const StatCard: React.FC<{
    label: string;
    alive: number;
    dead: number;
    total: number;
    hpPercent: number;
    isEnemy: boolean;
  }> = ({ label, alive, dead, total, hpPercent, isEnemy }) => (
    <div
      className={`p-4 rounded-xl border ${
        isEnemy
          ? "bg-gradient-to-br from-red-950/50 to-red-900/30 border-red-800/50"
          : "bg-gradient-to-br from-blue-950/50 to-blue-900/30 border-blue-800/50"
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{isEnemy ? "⚔️" : "👑"}</span>
        <span className="font-semibold text-astral-chrome truncate">
          {label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <div>
          <div className="text-2xl font-bold text-green-400">{alive}</div>
          <div className="text-xs text-surface-200">Vivos</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-red-400">{dead}</div>
          <div className="text-xs text-surface-200">Mortos</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-astral-silver">{total}</div>
          <div className="text-xs text-surface-200">Total</div>
        </div>
      </div>

      {/* HP Total Bar */}
      <div>
        <div className="flex justify-between text-xs text-surface-200 mb-1">
          <span>HP Total</span>
          <span>{Math.round(hpPercent)}%</span>
        </div>
        <div className="h-2 bg-cosmos-void rounded-full overflow-hidden">
          <div
            className="h-full transition-all"
            style={{
              width: `${hpPercent}%`,
              backgroundColor:
                hpPercent > 60
                  ? "#22c55e"
                  : hpPercent > 30
                  ? "#eab308"
                  : "#ef4444",
            }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md animate-fadeIn">
      <div className="bg-gradient-to-b from-surface-800 to-surface-900 border border-surface-500/50 rounded-2xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden animate-slideUp">
        {/* Header - Resultado */}
        <div
          className={`relative p-6 text-center overflow-hidden ${
            isWinner
              ? "bg-gradient-to-br from-yellow-600/20 via-yellow-500/10 to-transparent"
              : "bg-gradient-to-br from-red-900/30 via-red-800/10 to-transparent"
          }`}
        >
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div
              className={`absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl ${
                isWinner ? "bg-yellow-500" : "bg-red-600"
              }`}
            />
          </div>

          <div className="relative">
            <div
              className={`text-7xl mb-3 animate-bounce ${
                isWinner ? "" : "animate-none"
              }`}
            >
              {isWinner ? "🏆" : "💀"}
            </div>
            <h1
              className={`text-4xl font-black tracking-wider ${
                isWinner
                  ? "text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-300"
                  : "text-red-400"
              }`}
              style={{ fontFamily: "'Rajdhani', sans-serif" }}
            >
              {isWinner ? "VITÓRIA" : "DERROTA"}
            </h1>
            <p className="text-astral-silver mt-2 text-sm">{result.reason}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-500/30">
          <button
            onClick={() => setActiveTab("summary")}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === "summary"
                ? "text-astral-chrome border-b-2 border-stellar-amber bg-surface-800/30"
                : "text-surface-200 hover:text-astral-silver hover:bg-surface-800/20"
            }`}
          >
            📊 Resumo
          </button>
          <button
            onClick={() => setActiveTab("myUnits")}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === "myUnits"
                ? "text-astral-chrome border-b-2 border-blue-500 bg-surface-800/30"
                : "text-surface-200 hover:text-astral-silver hover:bg-surface-800/20"
            }`}
          >
            👑 Minhas ({stats.myTotal})
          </button>
          <button
            onClick={() => setActiveTab("enemyUnits")}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === "enemyUnits"
                ? "text-astral-chrome border-b-2 border-red-500 bg-surface-800/30"
                : "text-surface-200 hover:text-astral-silver hover:bg-surface-800/20"
            }`}
          >
            ⚔️ Inimigos ({stats.enemyTotal})
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {activeTab === "summary" && (
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                label={myKingdomName}
                alive={stats.myAlive}
                dead={stats.myDead}
                total={stats.myTotal}
                hpPercent={stats.myHpPercent}
                isEnemy={false}
              />
              <StatCard
                label={opponentKingdomName}
                alive={stats.enemyAlive}
                dead={stats.enemyDead}
                total={stats.enemyTotal}
                hpPercent={stats.enemyHpPercent}
                isEnemy={true}
              />
            </div>
          )}

          {activeTab === "myUnits" && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-astral-chrome font-semibold">
                  {myKingdomName}
                </h3>
                <span className="text-xs text-surface-200">
                  {stats.myAlive} vivos / {stats.myDead} mortos
                </span>
              </div>
              <UnitList unitList={myUnits} isEnemy={false} />
            </div>
          )}

          {activeTab === "enemyUnits" && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-astral-chrome font-semibold">
                  {opponentKingdomName}
                </h3>
                <span className="text-xs text-surface-200">
                  {stats.enemyAlive} vivos / {stats.enemyDead} mortos
                </span>
              </div>
              <UnitList unitList={enemyUnits} isEnemy={true} />
            </div>
          )}
        </div>

        {/* Footer - Ações */}
        <div className="p-4 bg-surface-800/30 border-t border-surface-500/30">
          {/* Status de Revanche (apenas para jogadores humanos) */}
          {!vsBot && opponentWantsRematch && !rematchPending && (
            <div className="mb-3 p-2.5 bg-yellow-900/30 border border-yellow-600/50 rounded-lg text-center">
              <p className="text-yellow-400 text-sm font-medium">
                ⚔️ O oponente quer uma revanche!
              </p>
            </div>
          )}
          {!vsBot && rematchPending && (
            <div className="mb-3 p-2.5 bg-blue-900/30 border border-blue-600/50 rounded-lg text-center">
              <p className="text-blue-400 text-sm font-medium">
                ⏳ Aguardando resposta do oponente...
              </p>
            </div>
          )}

          <div className="flex gap-3">
            {/* Botão de Revanche (apenas para jogadores humanos) */}
            {!vsBot && (
              <button
                onClick={onRematch}
                disabled={rematchPending}
                className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                  rematchPending
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                    : opponentWantsRematch
                    ? "bg-gradient-to-r from-yellow-500 to-amber-600 text-cosmos-void hover:from-yellow-400 hover:to-amber-500 shadow-lg shadow-yellow-500/20"
                    : "bg-gradient-to-r from-green-600 to-emerald-700 text-white hover:from-green-500 hover:to-emerald-600 shadow-lg shadow-green-500/20"
                }`}
              >
                {rematchPending
                  ? "⏳ Aguardando..."
                  : opponentWantsRematch
                  ? "⚔️ Aceitar Revanche!"
                  : "🔄 Revanche"}
              </button>
            )}
            <button
              onClick={onLeave}
              className={`${
                vsBot ? "w-full" : "flex-1"
              } py-2.5 bg-gradient-to-r from-surface-700 to-surface-800 border border-surface-600 rounded-xl text-astral-silver font-semibold text-sm hover:from-surface-600 hover:to-surface-700 transition-all`}
            >
              🚪 Sair
            </button>
          </div>
        </div>
      </div>

      {/* Styles for animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.4s ease-out;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.2);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.3);
        }
      `}</style>
    </div>
  );
};
