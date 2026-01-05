// src/handlers/items.handler.ts
// Inventário existe apenas durante partidas (MatchKingdom)
import { Socket, Server } from "socket.io";
import { prisma } from "../lib/prisma";
import { generateRandomItem, generateItems } from "../utils/items.generator";
import { GeneratedItem } from "../types/items";

function parseJSON<T>(val: string | null | undefined, fallback: T): T {
  try {
    return JSON.parse(val || "") as T;
  } catch {
    return fallback;
  }
}

export const registerItemsHandlers = (io: Server, socket: Socket) => {
  // Geração livre de itens (não vinculado)
  socket.on("items:generate", ({ count = 1 }) => {
    const items = generateItems(count);
    socket.emit("items:generated", { items });
  });

  // Listar inventário do Reino em Partida
  socket.on("inventory:list", async ({ matchKingdomId }) => {
    const matchKingdom = await prisma.matchKingdom.findUnique({
      where: { id: matchKingdomId },
    });
    if (!matchKingdom)
      return socket.emit("error", {
        message: "Reino na partida não encontrado",
      });
    const inventory = parseJSON<GeneratedItem[]>(matchKingdom.inventory, []);
    socket.emit("inventory:data", { matchKingdomId, inventory });
  });

  // Adicionar item ao inventário do Reino em Partida
  socket.on("inventory:add_item", async ({ matchKingdomId, item }) => {
    const matchKingdom = await prisma.matchKingdom.findUnique({
      where: { id: matchKingdomId },
    });
    if (!matchKingdom)
      return socket.emit("error", {
        message: "Reino na partida não encontrado",
      });
    const inventory = parseJSON<GeneratedItem[]>(matchKingdom.inventory, []);
    const newItem: GeneratedItem = item?.id ? item : generateRandomItem();
    inventory.push(newItem);
    await prisma.matchKingdom.update({
      where: { id: matchKingdomId },
      data: { inventory: JSON.stringify(inventory) },
    });
    socket.emit("inventory:item_added", { matchKingdomId, item: newItem });
  });

  // Transferir item do inventário para uma Unidade (Herói/Regente)
  socket.on(
    "inventory:transfer_to_unit",
    async ({ matchKingdomId, unitId, itemId }) => {
      const matchKingdom = await prisma.matchKingdom.findUnique({
        where: { id: matchKingdomId },
      });
      const unit = await prisma.unit.findUnique({ where: { id: unitId } });
      if (!matchKingdom || !unit)
        return socket.emit("error", { message: "Dados inválidos" });
      if (unit.category !== "HERO" && unit.category !== "REGENT") {
        return socket.emit("error", {
          message: "Apenas Heróis e Regentes podem equipar itens",
        });
      }

      const inventory = parseJSON<GeneratedItem[]>(matchKingdom.inventory, []);
      const idx = inventory.findIndex((i) => i.id === itemId);
      if (idx < 0)
        return socket.emit("error", {
          message: "Item não encontrado no inventário",
        });
      const item = inventory[idx];

      const equipped = parseJSON<GeneratedItem[]>(unit.equipment as any, []);
      if (equipped.length >= 3)
        return socket.emit("error", {
          message: "Limite de 3 equipamentos atingido",
        });

      // Aplicar bônus de atributo
      const boost = item.boost;
      const newData: any = {};
      newData[boost.attribute] = (unit as any)[boost.attribute] + boost.amount;

      equipped.push(item);

      await prisma.unit.update({
        where: { id: unitId },
        data: { equipment: JSON.stringify(equipped), ...newData },
      });

      // Remove do inventário
      inventory.splice(idx, 1);
      await prisma.matchKingdom.update({
        where: { id: matchKingdomId },
        data: { inventory: JSON.stringify(inventory) },
      });

      socket.emit("unit:item_equipped", { unitId, item });
    }
  );

  // Transferir item da Unidade de volta ao Reino (e remover bônus)
  socket.on(
    "inventory:transfer_to_kingdom",
    async ({ matchKingdomId, unitId, itemId }) => {
      const matchKingdom = await prisma.matchKingdom.findUnique({
        where: { id: matchKingdomId },
      });
      const unit = await prisma.unit.findUnique({ where: { id: unitId } });
      if (!matchKingdom || !unit)
        return socket.emit("error", { message: "Dados inválidos" });

      const equipped = parseJSON<GeneratedItem[]>(unit.equipment as any, []);
      const idx = equipped.findIndex((i) => i.id === itemId);
      if (idx < 0)
        return socket.emit("error", { message: "Item não está equipado" });
      const item = equipped[idx];

      // Reverter bônus
      const boost = item.boost;
      const newData: any = {};
      newData[boost.attribute] = Math.max(
        0,
        (unit as any)[boost.attribute] - boost.amount
      );

      equipped.splice(idx, 1);

      await prisma.unit.update({
        where: { id: unitId },
        data: { equipment: JSON.stringify(equipped), ...newData },
      });

      const inventory = parseJSON<GeneratedItem[]>(matchKingdom.inventory, []);
      inventory.push(item);
      await prisma.matchKingdom.update({
        where: { id: matchKingdomId },
        data: { inventory: JSON.stringify(inventory) },
      });

      socket.emit("inventory:item_returned", { matchKingdomId, unitId, item });
    }
  );
};
