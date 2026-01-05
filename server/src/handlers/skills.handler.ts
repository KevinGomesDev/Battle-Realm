// src/handlers/skills.handler.ts
import { Socket, Server } from "socket.io";
import {
  listAllClasses,
  getClassInfo,
  getSkillInfo,
  useSkill,
} from "../utils/skills.utils";
import { getSpellByCode } from "../../../shared/data/spells.data";
import { executeSpell } from "../spells/executors";
import { ARENA_COOLDOWN_MULTIPLIER } from "../logic/skill-executors";
import { validateSpellUse } from "../../../shared/utils/spell-validation";
import { spendResources } from "../utils/turn.utils";
import { prisma } from "../lib/prisma";
import type { BattleUnit } from "../../../shared/types/battle.types";

export const registerSkillsHandlers = (io: Server, socket: Socket) => {
  // --- LISTAR TODAS AS CLASSES ---
  socket.on("skills:list_classes", () => {
    try {
      const classes = listAllClasses();

      socket.emit("skills:classes_list", {
        classes,
        count: classes.length,
      });
    } catch (error) {
      console.error("[SKILLS] Erro ao listar classes:", error);
      socket.emit("error", { message: "Erro ao listar classes" });
    }
  });

  // --- OBTER DETALHES DE UMA CLASSE ---
  socket.on("skills:get_class", ({ classCode }) => {
    try {
      const classInfo = getClassInfo(classCode);

      if (!classInfo) {
        socket.emit("error", { message: "Classe não encontrada" });
        return;
      }

      socket.emit("skills:class_info", classInfo);
    } catch (error) {
      console.error("[SKILLS] Erro ao obter classe:", error);
      socket.emit("error", { message: "Erro ao obter informações da classe" });
    }
  });

  // --- OBTER DETALHES DE UMA HABILIDADE ---
  socket.on(
    "skills:get_skill",
    async ({ skillId, unitId, playerId, usageCount = 0 }) => {
      try {
        const skillInfo = await getSkillInfo(
          skillId,
          unitId,
          playerId,
          usageCount
        );

        socket.emit("skills:skill_info", skillInfo);
      } catch (error) {
        console.error("[SKILLS] Erro ao obter habilidade:", error);
        socket.emit("error", {
          message: "Erro ao obter informações da habilidade",
        });
      }
    }
  );

  // --- USAR UMA HABILIDADE ---
  socket.on(
    "skills:use_skill",
    async ({
      matchId,
      playerId,
      unitId,
      skillId,
      usageCountThisBattle = 0,
    }) => {
      try {
        const result = await useSkill(
          unitId,
          skillId,
          playerId,
          usageCountThisBattle
        );

        if (result.success) {
          // Notifica todos na partida sobre o uso da habilidade
          io.to(matchId).emit("skills:skill_used", {
            unitId,
            playerId,
            skillId,
            message: result.message,
            cost: result.cost,
            resourceType: result.resourceType,
          });

          socket.emit("skills:use_success", {
            message: result.message,
            cost: result.cost,
            resourceType: result.resourceType,
          });
        } else {
          socket.emit("error", { message: result.message });
        }
      } catch (error) {
        console.error("[SKILLS] Erro ao usar habilidade:", error);
        socket.emit("error", { message: "Erro ao usar habilidade" });
      }
    }
  );

  // =========================================================================
  // SPELLS HANDLERS
  // =========================================================================

  // --- LISTAR SPELLS DA UNIDADE ---
  socket.on(
    "skills:list_spells",
    async ({
      battleId,
      userId,
      unitId,
    }: {
      battleId: string;
      userId: string;
      unitId: string;
    }) => {
      try {
        // Buscar a batalha e suas unidades
        const battle = await prisma.battle.findUnique({
          where: { id: battleId },
          include: { units: true },
        });

        if (!battle) {
          socket.emit("error", { message: "Batalha não encontrada" });
          return;
        }

        const unit = battle.units.find((u) => u.id === unitId);

        if (!unit) {
          socket.emit("error", { message: "Unidade não encontrada" });
          return;
        }

        // Validar que a unidade pertence ao jogador
        if (unit.userId !== userId && unit.ownerId !== userId) {
          socket.emit("error", { message: "Você não controla esta unidade" });
          return;
        }

        // Parse e retornar lista de spells
        const spells = JSON.parse(unit.spells || "[]");
        socket.emit("skills:spells_list", {
          unitId,
          spells,
        });
      } catch (error) {
        console.error("[SPELLS] Erro ao listar spells:", error);
        socket.emit("error", { message: "Erro ao listar spells" });
      }
    }
  );

  // --- USAR UMA SPELL ---
  socket.on(
    "skills:cast_spell",
    async ({
      battleId,
      userId,
      unitId,
      spellCode,
      targetId,
      targetPosition,
    }: {
      battleId: string;
      userId: string;
      unitId: string;
      spellCode: string;
      targetId?: string;
      targetPosition?: { x: number; y: number };
    }) => {
      try {
        // Buscar a spell
        const spell = getSpellByCode(spellCode);
        if (!spell) {
          socket.emit("error", { message: "Spell não encontrada" });
          return;
        }

        // Buscar a batalha e suas unidades
        const battle = await prisma.battle.findUnique({
          where: { id: battleId },
          include: { units: true },
        });

        if (!battle) {
          socket.emit("error", { message: "Batalha não encontrada" });
          return;
        }

        // Converter para BattleUnit[] com parse de JSON fields
        const units: BattleUnit[] = battle.units.map((u) => ({
          id: u.id,
          sourceUnitId: u.unitId || u.id,
          ownerId: u.ownerId || u.userId || "",
          ownerKingdomId: u.kingdomId || "",
          name: u.name,
          avatar: u.avatar || undefined,
          category: u.category,
          troopSlot: u.troopSlot || undefined,
          level: u.level,
          race: "HUMANOIDE", // TODO: obter do banco
          classCode: u.classCode || undefined,
          features: JSON.parse(u.features || "[]"),
          equipment: JSON.parse(u.equipment || "[]"),
          spells: JSON.parse(u.spells || "[]"),
          combat: u.combat,
          speed: u.speed,
          focus: u.focus,
          armor: u.armor,
          vitality: u.vitality,
          damageReduction: u.damageReduction,
          currentHp: u.currentHp,
          maxHp: u.vitality * 2,
          posX: u.posX,
          posY: u.posY,
          movesLeft: u.movesLeft,
          actionsLeft: u.actionsLeft,
          attacksLeftThisTurn: u.attacksLeftThisTurn,
          isAlive: u.isAlive,
          actionMarks: u.actionMarks,
          physicalProtection: u.protection,
          maxPhysicalProtection: u.armor * 2,
          magicalProtection: u.focus * 2,
          maxMagicalProtection: u.focus * 2,
          conditions: JSON.parse(u.conditions || "[]"),
          hasStartedAction: u.hasStartedAction,
          grabbedByUnitId: u.grabbedByBattleUnitId || undefined,
          size: (u.size as any) || "NORMAL",
          visionRange: u.visionRange,
          unitCooldowns: JSON.parse(u.unitCooldowns || "{}"),
          isAIControlled: u.isAIControlled,
        }));

        // Encontrar o conjurador
        const caster = units.find((u) => u.id === unitId);
        if (!caster) {
          socket.emit("error", { message: "Unidade não encontrada" });
          return;
        }

        // Validar que a unidade pertence ao jogador
        const dbUnit = battle.units.find((u) => u.id === unitId);
        if (
          !dbUnit ||
          (dbUnit.userId !== userId && dbUnit.ownerId !== userId)
        ) {
          socket.emit("error", { message: "Você não controla esta unidade" });
          return;
        }

        // Resolver o alvo
        let target: BattleUnit | { x: number; y: number } | null = null;
        if (spell.targetType === "POSITION" || spell.targetType === "GROUND") {
          target = targetPosition || null;
        } else if (targetId) {
          target = units.find((u) => u.id === targetId) || null;
        }

        // Validação centralizada de spell
        const validation = validateSpellUse(caster, spell, target);
        if (!validation.valid) {
          socket.emit("error", { message: validation.error });
          return;
        }

        // Em partidas (Match), cobrar o custo de Arcane
        if (!battle.isArena && spell.manaCost && spell.manaCost > 0) {
          // Buscar o ownerId (MatchPlayer ID) da unidade
          const battleUnit = battle.units.find((u) => u.id === unitId);
          const matchPlayerId = battleUnit?.ownerId;

          if (!matchPlayerId) {
            socket.emit("error", {
              message: "Não foi possível identificar o jogador da partida",
            });
            return;
          }

          try {
            await spendResources(matchPlayerId, { arcane: spell.manaCost });
            console.log(
              `[SPELLS] Arcane consumido: ${spell.manaCost} para ${spell.name}`
            );
          } catch (err: any) {
            socket.emit("error", {
              message: err.message || "Arcane insuficiente",
            });
            return;
          }
        }

        // Executar a spell
        const result = executeSpell(spell, caster, target, units);

        if (!result.success) {
          socket.emit("error", {
            message: result.error || "Falha ao usar spell",
          });
          return;
        }

        // Consumir ação
        caster.actionsLeft -= 1;

        // Aplicar cooldown da spell (dobrado em Arena)
        if (spell.cooldown && spell.cooldown > 0) {
          if (!caster.unitCooldowns) {
            caster.unitCooldowns = {};
          }
          const cooldownValue = battle.isArena
            ? spell.cooldown * ARENA_COOLDOWN_MULTIPLIER
            : spell.cooldown;
          caster.unitCooldowns[spellCode] = cooldownValue;
        }

        // Atualizar unidades no banco
        for (const unit of units) {
          await prisma.battleUnit.update({
            where: { id: unit.id },
            data: {
              currentHp: unit.currentHp,
              isAlive: unit.isAlive,
              actionsLeft: unit.actionsLeft,
              posX: unit.posX,
              posY: unit.posY,
              conditions: JSON.stringify(unit.conditions),
              unitCooldowns: JSON.stringify(unit.unitCooldowns || {}),
            },
          });
        }

        // Notificar todos na batalha
        io.to(battleId).emit("skills:spell_cast", {
          unitId,
          unitName: caster.name,
          spellCode,
          spellName: spell.name,
          result,
        });

        // Emitir estado atualizado
        io.to(battleId).emit("battle:units_updated", {
          units: units.map((u) => ({
            id: u.id,
            currentHp: u.currentHp,
            isAlive: u.isAlive,
            actionsLeft: u.actionsLeft,
            posX: u.posX,
            posY: u.posY,
            conditions: u.conditions,
            unitCooldowns: u.unitCooldowns,
          })),
        });

        socket.emit("skills:cast_success", {
          message: `${spell.name} usado com sucesso!`,
          result,
        });
      } catch (error) {
        console.error("[SPELLS] Erro ao usar spell:", error);
        socket.emit("error", { message: "Erro ao usar spell" });
      }
    }
  );
};
