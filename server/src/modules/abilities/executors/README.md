# Executores de Abilities - Estrutura Modular

## 📂 Estrutura de Pastas

```
server/src/modules/abilities/executors/
├── types.ts                    # Tipos compartilhados
├── helpers.ts                  # Funções auxiliares
├── registry.ts                 # Registry unificado
├── ability-executors.ts        # Funções de alto nível
├── index.ts                    # Barrel exports
├── skills/                     # Executores de Skills
│   ├── attack.skill.ts         # ATTACK (Common)
│   ├── dash.skill.ts           # DASH (Common)
│   ├── dodge.skill.ts          # DODGE (Common)
│   ├── second-wind.skill.ts    # Guerreiro
│   ├── action-surge.skill.ts   # Guerreiro
│   ├── total-destruction.skill.ts  # Bárbaro
│   ├── heal.skill.ts           # Clérigo
│   ├── bless.skill.ts          # Clérigo
│   ├── divine-favor.skill.ts   # Clérigo
│   ├── cure-wounds.skill.ts    # Clérigo
│   ├── turn-undead.skill.ts    # Clérigo
│   ├── celestial-expulsion.skill.ts  # Clérigo
│   ├── magic-weapon.skill.ts   # Mago
│   ├── arcane-shield.skill.ts  # Mago
│   ├── hunters-mark.skill.ts   # Ranger
│   ├── volley.skill.ts         # Ranger
│   ├── eidolon-resistance.skill.ts  # Invocador
│   └── index.ts
└── spells/                     # Executores de Spells
    ├── teleport.spell.ts       # TELEPORT
    ├── fire.spell.ts           # FIRE
    ├── empower.spell.ts        # EMPOWER
    └── index.ts
```

## 🎯 Como Usar

### Importar Executores

```typescript
// Importar todos
import {
  executeAttackSkill,
  executeHeal,
  executeTeleport,
} from "../../modules/abilities/executors";

// Importar registry
import {
  SKILL_EXECUTORS,
  SPELL_EXECUTORS,
  getAbilityExecutor,
} from "../../modules/abilities/executors/registry";

// Importar funções de alto nível
import {
  executeSkill,
  executeSpell,
  executeAbility,
} from "../../modules/abilities/executors";
```

### Adicionar Nova Ability

1. **Criar arquivo da ability:**

   - Skills: `skills/nome-da-skill.skill.ts`
   - Spells: `spells/nome-da-spell.spell.ts`

2. **Implementar executor:**

```typescript
// skills/nova-skill.skill.ts
import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "../../../../../../shared/types/ability.types";
import type { BattleUnit } from "../../../../../../shared/types/battle.types";

export function executeNovaSkill(
  caster: BattleUnit,
  target: BattleUnit | null,
  allUnits: BattleUnit[],
  skill: AbilityDefinition
): AbilityExecutionResult {
  // Implementação aqui
  return {
    success: true,
    // ... outros campos
  };
}
```

3. **Adicionar ao index:**

```typescript
// skills/index.ts
export { executeNovaSkill } from "./nova-skill.skill";
```

4. **Registrar no registry:**

```typescript
// registry.ts
export const SKILL_EXECUTORS: ExecutorRegistry = {
  // ... outros
  executeNovaSkill,
};
```

## 📝 Padrões de Nomenclatura

- **Arquivos:** `kebab-case.skill.ts` ou `kebab-case.spell.ts`
- **Funções:** `executePascalCase` (ex: `executeSecondWind`)
- **Exports:** Named exports apenas

## ✅ Benefícios da Nova Estrutura

1. **Organização:** Um arquivo por ability - fácil de encontrar e editar
2. **Manutenibilidade:** Mudanças isoladas não afetam outras abilities
3. **Legibilidade:** Código menor e mais focado
4. **Escalabilidade:** Fácil adicionar novas abilities
5. **Testing:** Mais fácil testar abilities individualmente

## 🔧 Arquivos Principais

- **types.ts:** Tipos compartilhados (SkillExecutorFn, SpellExecutorFn, etc)
- **helpers.ts:** Funções auxiliares reutilizáveis
- **registry.ts:** Mapa de functionName → executor
- **ability-executors.ts:** Funções de alto nível (executeSkill, executeSpell, executeAbility)
- **index.ts:** Barrel exports de tudo

## 🚀 Migração Completa

A migração dos arquivos antigos (`skill-executors.ts`, `spell-executors.ts`) foi concluída com sucesso. Todos os imports foram atualizados e a tipagem está correta.
