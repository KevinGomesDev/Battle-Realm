# Battle Realm - Instruções de Desenvolvimento

## Stack

- **Client:** React 18 + Vite + TypeScript + TailwindCSS
- **Server:** Node.js + Express + Socket.IO + Prisma + PostgreSQL
- **Shared:** Tipos TypeScript compartilhados

## Estrutura

```
client/src/features/{feature}/   # Componentes, context, hooks por feature
server/src/handlers/             # Socket event handlers
server/src/logic/                # Lógica de jogo pura
server/src/services/             # Business logic com I/O
server/src/data/                 # Dados estáticos (classes, skills)
shared/types/                    # Tipos compartilhados (CRÍTICO!)
```

---

## Regras Críticas

### 1. Shared Types

Tipos usados por client E server → `shared/types/`

```typescript
import type { ArenaUnit } from "../../../shared/types";
```

### 2. Backend = Fonte de Verdade

Server calcula tudo (dano, movimento, validações). Client apenas exibe.

### 3. Socket Events

Verificar que nome e payload são idênticos em ambos os lados.

```
Padrão: {domain}:{action}
Exemplos: arena:lobby-updated, battle:action-executed
```

---

## Sistema de Eventos (Log de Batalha)

### Backend - Emitir eventos

```typescript
// server/src/logic/combat-events.ts
import { emitAttackHitEvent, emitAttackDodgedEvent } from "./combat-events";

// Após ação de combate
if (result.missed) {
  await emitAttackDodgedEvent(battleId, attacker, target);
} else {
  await emitAttackHitEvent(battleId, attacker, target, result);
}
```

### Frontend - Exibir eventos

```tsx
import { EventProvider, EventLog } from "@/features/events";

// Provider no App
<EventProvider><App /></EventProvider>

// Componente em qualquer lugar
<EventLog context="BATTLE" contextId={battleId} />
```

### Arquivos do Sistema

| Arquivo                                | Descrição                    |
| -------------------------------------- | ---------------------------- |
| `shared/types/events.types.ts`         | Tipos e constantes           |
| `server/src/services/event.service.ts` | Criar e emitir eventos       |
| `server/src/logic/combat-events.ts`    | Funções prontas para combate |
| `client/src/features/events/`          | Context, hook e componente   |

---

## Sistema de Skills

### Dados Estáticos (não banco)

```typescript
// Tipos: shared/types/skills.types.ts
// Classes: server/src/data/classes.data.ts
// Skills: server/src/data/skills.data.ts

import { HERO_CLASSES, getClassByCode } from "../data/classes.data";
import {
  getSkillEffectiveRange,
  isAdjacent,
} from "../../../shared/types/skills.types";
```

### Ranges

- `SELF` = 0 (apenas usuário)
- `ADJACENT` = 1 (1 bloco Manhattan)
- `RANGED` = customizável (padrão 4)
- `AREA` = raio (padrão 2)

---

## Padrões de Código

### Feature (Client)

```typescript
// client/src/features/{feature}/index.ts
export { FeatureProvider, useFeature } from "./context";
export { FeatureComponent } from "./components";
```

### Handler (Server)

```typescript
export function registerFeatureHandlers(io: Server, socket: Socket) {
  socket.on("feature:action", async (data, callback) => {
    // 1. Validar → 2. Processar → 3. Persistir → 4. Emitir
    callback?.({ success: true, data: result });
  });
}
```

---

## Quick Reference

| Ação                       | Onde                                                  |
| -------------------------- | ----------------------------------------------------- |
| Novo tipo compartilhado    | `shared/types/`                                       |
| Nova condição de batalha   | `server/src/logic/conditions.ts`                      |
| Nova skill/classe          | `server/src/data/skills.data.ts` ou `classes.data.ts` |
| Novo evento de combate     | `server/src/logic/combat-events.ts`                   |
| Lógica de combate          | `server/src/logic/combat-actions.ts`                  |
| Novo componente de feature | `client/src/features/{feature}/components/`           |

---

## NÃO FAZER

- ❌ Duplicar tipos entre client/server
- ❌ Calcular lógica de jogo no frontend
- ❌ Criar socket events sem verificar listener correspondente
- ❌ Executar `npm run build/dev` (assumir que estão rodando)
