# Battle Realm - Guia de Desenvolvimento

## 🎯 Regras Fundamentais

### ✅ FAZER

- Tipos compartilhados em `shared/types/`
- Backend calcula, frontend exibe
- Reutilizar tipos existentes (NUNCA duplicar)
- Deletar código não usado (não comentar)
- Colyseus rooms: padrão `{domain}Room` (ex: ArenaRoom, MatchRoom)
- Mensagens Colyseus: `{domain}:{action}` pattern

### ❌ NÃO FAZER

- Lógica de jogo no frontend
- Criar tipos novos sem verificar se já existem
- Comentar código antigo (deletar)
- Executar `npm run build/dev` (assumir que estão rodando)
- Manter arquivos/imports não usados
- Não crie Docs
- Antes de finalizar a tarefa, confira se não existem erros. Se existirem, corrija-os.
- NUNCA faça sub-componentes dentro do mesmo arquivo. Sempre separe em arquivos diferentes.
- NUNCA use Socket.IO - usar Colyseus

---

## 🛠️ Stack de Bibliotecas

| Área                     | Biblioteca           | Prioridade |
| ------------------------ | -------------------- | ---------- |
| **Multiplayer/Realtime** | Colyseus             | ⭐ Top     |
| **Animação**             | Framer Motion        | Alta       |
| **Input (Teclado)**      | React-Hotkeys-Hook   | Alta       |
| **Lógica de Grid/Path**  | Pathfinding.js       | Alta       |
| **Estado Local**         | Zustand              | Alta       |
| **Som**                  | Howler.js            | Média      |
| **Mapas/Grid/Canvas**    | React-Konva (Canvas) | Alta       |

### Colyseus - Padrões de Uso

**Server (Rooms):**

```typescript
// server/src/colyseus/rooms/MinhaRoom.ts
import { Room, Client } from "@colyseus/core";
import { MinhaState } from "../schemas/minha.schema";

export class MinhaRoom extends Room<MinhaState> {
  onCreate(options: any) {
    this.setState(new MinhaState());

    // Registrar handlers de mensagens
    this.onMessage("action:fazer_algo", (client, data) => {
      // Lógica aqui
    });
  }
}
```

**Client (Service):**

```typescript
// Usar colyseusService singleton
import { colyseusService } from "../services/colyseus.service";

// Conectar
await colyseusService.connect();

// Criar/entrar em room
const room = await colyseusService.createArenaLobby({ kingdomId });

// Enviar mensagem
colyseusService.sendToArena("action:fazer_algo", { data });

// Escutar eventos
colyseusService.on("arena:state_changed", (state) => {});
```

**Client (Hooks/Context):**

```typescript
// Usar hooks do core
import { useArena, useMatch, useColyseus } from "../core";

function MeuComponente() {
  const { state, createLobby, moveUnit } = useArena();
  // ...
}
```

---

## 📁 Estrutura de Arquivos

```
shared/
  types/              # Tipos TypeScript compartilhados (CRÍTICO!)
  data/               # Dados estáticos (skills, classes, races)
  config/             # Configurações globais

server/src/
  colyseus/
    rooms/            # Colyseus Rooms (ArenaRoom, MatchRoom, GlobalRoom)
    schemas/          # Colyseus Schemas (estado sincronizado)
    index.ts          # Barrel exports
  logic/              # Lógica pura (combat, conditions, round-control)
  services/           # Business logic com I/O
  spells/             # Sistema de magias (executors, utils)
  utils/              # Utilities e factories

client/src/
  services/
    colyseus.service.ts  # Serviço singleton de conexão
  core/
    context/          # ColyseusContext (conexão global)
    hooks/            # useColyseus, useArena, useMatch
  features/{feature}/ # Componentes, context, hooks por feature
```

---

## 🔧 Quick Reference

| Tarefa              | Arquivo                                          |
| ------------------- | ------------------------------------------------ |
| Tipo compartilhado  | `shared/types/{tipo}.types.ts`                   |
| Skill/Classe        | `shared/data/skills.data.ts`                     |
| Spell/Magia         | `shared/data/spells.data.ts`                     |
| Condição            | `server/src/logic/skill-conditions.ts`           |
| Raça                | `shared/data/races.ts`                           |
| Executor de skill   | `server/src/logic/skill-executors.ts`            |
| Executor de spell   | `server/src/spells/executors.ts`                 |
| Utilitários spell   | `server/src/spells/utils.ts`                     |
| Turnos/Rodadas      | `server/src/logic/round-control.ts`              |
| **Colyseus Room**   | `server/src/colyseus/rooms/{Domain}Room.ts`      |
| **Colyseus Schema** | `server/src/colyseus/schemas/{domain}.schema.ts` |
| Feature client      | `client/src/features/{feature}/`                 |

---

## 📚 Tutorial: Criar Nova Skill

### Passo 1: Definir Skill (`shared/data/skills.data.ts`)

```typescript
export const MINHA_SKILL: SkillDefinition = {
  code: "MINHA_SKILL",
  name: "Minha Skill",
  description: "Descrição do que a skill faz",
  category: "ACTIVE", // ou "PASSIVE"
  costTier: "MEDIUM", // LOW, MEDIUM, HIGH
  range: "ADJACENT", // SELF, MELEE, RANGED, AREA
  targetType: "UNIT", // SELF, UNIT, ALL, POSITION, GROUND
  functionName: "executeMinhaSkill", // Se ACTIVE
  conditionApplied: "MINHA_CONDICAO", // Se PASSIVE
  consumesAction: true,
  cooldown: 2,
};

// Adicionar à lista da classe
export const WARRIOR_SKILLS: SkillDefinition[] = [
  EXTRA_ATTACK,
  SECOND_WIND,
  ACTION_SURGE,
  MINHA_SKILL, // ← Adicionar aqui
];
```

**Arquivo:** `shared/data/skills.data.ts`

---

### Passo 2: Criar Condição (se PASSIVE) (`server/src/logic/skill-conditions.ts`)

```typescript
MINHA_CONDICAO: {
  id: "MINHA_CONDICAO",
  name: "Minha Condição",
  description: "Descrição do efeito",
  expiry: "permanent", // ou "end_of_turn", "next_turn", "on_action"
  icon: "⚡",
  color: "#fbbf24",
  effects: {
    // Escolha os efeitos necessários:
    bonusDamage: 2,           // +2 dano
    damageReduction: 1,       // -1 dano recebido
    dodgeChance: 10,          // +10% esquiva
    movementMod: 2,           // +2 movimento
    extraAttacks: 1,          // +1 ataque por ação
    // Ver conditions.types.ts para todos os efeitos
  },
}
```

**Arquivo:** `server/src/logic/skill-conditions.ts`

---

### Passo 3: Criar Executor (se ACTIVE) (`server/src/logic/skill-executors.ts`)

```typescript
function executeMinhaSkill(
  caster: BattleUnit,
  target: BattleUnit | null,
  allUnits: BattleUnit[],
  skill: SkillDefinition
): SkillExecutionResult {
  // Validações
  if (!target || !target.isAlive) {
    return { success: false, error: "Alvo inválido" };
  }

  // Lógica da skill
  const damage = caster.combat * 2;
  target.currentHp -= damage;

  if (target.currentHp <= 0) {
    target.isAlive = false;
  }

  // Retorno
  return {
    success: true,
    damageDealt: damage,
    targetHpAfter: target.currentHp,
    targetDefeated: !target.isAlive,
  };
}

// Registrar no mapa de executores
export const SKILL_EXECUTORS: Record<string, SkillExecutorFn> = {
  executeSecondWind,
  executeActionSurge,
  executeMinhaSkill, // ← Adicionar aqui
  // ...
};
```

**Arquivo:** `server/src/logic/skill-executors.ts`

---

### Passo 4: Adicionar Info Visual (`shared/data/skills.data.ts`)

```typescript
const SKILL_ICONS: Record<string, string> = {
  MINHA_SKILL: "⚡",
  // ...
};

const SKILL_COLORS: Record<string, string> = {
  MINHA_SKILL: "yellow",
  // ...
};
```

**Arquivo:** `shared/data/skills.data.ts` (final do arquivo)

---

### Passo 5: Adicionar Condição Visual (`shared/types/conditions.data.ts`)

```typescript
export const CONDITIONS_INFO: Record<string, ConditionInfo> = {
  MINHA_CONDICAO: {
    icon: "⚡",
    name: "Minha Condição",
    description: "Descrição do efeito",
    color: "#fbbf24",
  },
  // ...
};
```

**Arquivo:** `shared/types/conditions.data.ts`

---

### ✅ Checklist Final

- [ ] Skill definida em `skills.data.ts`
- [ ] Skill adicionada à lista da classe
- [ ] Condição criada (se PASSIVE) em `skill-conditions.ts`
- [ ] Executor implementado (se ACTIVE) em `skill-executors.ts`
- [ ] Executor registrado em `SKILL_EXECUTORS`
- [ ] Ícone e cor adicionados em `skills.data.ts`
- [ ] Info visual da condição em `conditions.data.ts`
- [ ] Testar em batalha

---

## 🎮 Sistema de Atributos

| Atributo   | Uso                                                  |
| ---------- | ---------------------------------------------------- |
| Combat     | Dano de ataque físico (direto)                       |
| Speed      | Movimento + Esquiva (3% por ponto)                   |
| Focus      | Poder mágico e visão                                 |
| Resistance | Proteção física (2x) + Custo de Engajamento vs Speed |
| Will       | Mana (2x) + Proteção mágica (2x)                     |
| Vitality   | HP máximo (1x)                                       |

**Arquivo:** `shared/config/global.config.ts`

---

## 🔄 Fluxo de Combate

```
1. Atacante usa ação de ataque
2. scanConditionsForAction() - Verifica condições do atacante
3. Calcula dano base = combat + bonusDamage
4. Alvo: scanConditionsForAction() - Verifica condições do alvo
5. Sistema de esquiva: 1D100 vs (speed × 3%)
6. Aplica damageReduction das condições
7. Aplica proteções (física/mágica)
8. Aplica dano final no HP
```

**Arquivo:** `server/src/logic/skill-executors.ts` (função `executeAttack`)

---

## 🧩 Tipo Principal

```typescript
BattleUnit {
  id, name, avatar, category, level, race,
  combat, speed, focus, resistance, will, vitality,
  currentHp, maxHp, currentMana, maxMana,
  physicalProtection, magicalProtection,
  conditions: string[], // IDs das condições ativas
  actions: string[],    // Ações disponíveis
  // ...
}
```

**Arquivo:** `shared/types/battle.types.ts`
