# Módulo de IA de Batalha

Este módulo controla unidades **SUMMON** e **MONSTER** durante batalhas no Battle Realm.

## Estrutura de Pastas

```
server/src/ai/
├── index.ts              # Barrel exports principal
├── types/
│   └── ai.types.ts       # Tipos e interfaces da IA
├── core/
│   ├── index.ts          # Barrel exports core
│   ├── pathfinding.ts    # A* pathfinding, cálculo de distâncias
│   ├── target-selection.ts # Seleção de alvos
│   ├── skill-evaluator.ts  # Avaliação e seleção de skills
│   ├── decision-maker.ts   # Tomador de decisões principal
│   ├── ai-controller.ts    # Controller principal, identificação de unidades IA
│   └── action-executor.ts  # Executor de ações (integra com skill-executors)
└── behaviors/
    ├── index.ts          # Barrel exports behaviors
    ├── aggressive.behavior.ts  # Comportamento agressivo
    ├── tactical.behavior.ts    # Comportamento tático
    ├── ranged.behavior.ts      # Comportamento ranged
    ├── support.behavior.ts     # Comportamento de suporte
    └── defensive.behavior.ts   # Comportamento defensivo
```

## Comportamentos

### AGGRESSIVE (Agressivo)

- Sempre busca atacar
- Persegue o inimigo mais próximo ou mais fraco
- Usa skills de dano quando possível
- Não recua mesmo com HP baixo
- **Ideal para:** Monstros, Summons de combate

### TACTICAL (Tático)

- Avalia situação antes de agir
- Recua se HP baixo
- Prefere posições seguras
- Usa skills estrategicamente
- **Ideal para:** Warriors, unidades balanceadas

### RANGED (À Distância)

- Prioriza ataques à distância
- Mantém distância dos inimigos
- Foge se inimigos se aproximam
- Usa skills de dano ranged
- **Ideal para:** Archers, Mages

### SUPPORT (Suporte)

- Prioriza cura e buffs
- Fica perto dos aliados
- Evita combate direto
- Foge de inimigos
- **Ideal para:** Healers, Clerics

### DEFENSIVE (Defensivo)

- Não avança ativamente
- Contra-ataca quando atacado
- Protege aliados fracos
- Usa skills defensivas
- **Ideal para:** Tanks, Guardiões

## Prioridade de Skills

### NONE

- Só usa ataque básico
- Nunca usa skills

### BASIC

- Usa skills quando disponíveis
- Aleatoriedade na escolha
- 70% melhor skill, 30% qualquer

### SMART

- Sempre usa a melhor skill possível
- Prioriza por tipo e situação
- Analisa HP do alvo, distância, etc.

## Perfis Padrão

| Tipo    | Comportamento | Skills | Range | Recuo |
| ------- | ------------- | ------ | ----- | ----- |
| MONSTER | AGGRESSIVE    | NONE   | 1     | 0.15  |
| SUMMON  | AGGRESSIVE    | BASIC  | 1     | 0.2   |
| WARRIOR | TACTICAL      | BASIC  | 1     | 0.25  |
| ARCHER  | RANGED        | SMART  | 4     | 0.3   |
| MAGE    | RANGED        | SMART  | 4     | 0.35  |
| HEALER  | SUPPORT       | SMART  | 3     | 0.4   |
| TANK    | DEFENSIVE     | BASIC  | 1     | 0.15  |

## Uso Básico

```typescript
import {
  processAITurn,
  isAITurn,
  AI_PLAYER_ID,
  executeFullAITurn,
  hasActiveAIUnits,
} from "../ai";

// Verificar se há unidades IA na batalha
if (hasActiveAIUnits(battle)) {
  // Verificar se é o turno da IA
  if (battle.currentPlayerId === AI_PLAYER_ID) {
    // Executar turno completo da IA com delays
    const results = await executeFullAITurn(battle, io, lobbyId);
  }
}
```

## Eventos Socket.IO

### Emitidos pelo Módulo

- `battle:ai-turn-start` - Início do turno da IA
- `battle:ai-unit-acting` - Unidade IA está agindo
- `battle:ai-action` - Ação da IA executada
- `battle:state-updated` - Estado da batalha atualizado
- `battle:ai-turn-end` - Fim do turno da IA

## Regras de Vitória

1. **Ignora unidades IA**: Apenas jogadores humanos contam para vitória
2. **Empate**: Se só sobrar unidades IA vivas
3. **Vitória**: Último jogador com unidades vivas (excluindo IA)

## Ordem de Turnos

```
Rodada N:
  1. Jogador 1 (Host)
  2. Jogador 2 (Guest)
  3. IA (todas as Summons/Monsters)
Rodada N+1:
  ...
```

## Integração com Round Control

O módulo de IA deve ser integrado com `round-control.ts` para:

1. Adicionar IA como "terceiro jogador" no ciclo de turnos
2. Chamar `executeFullAITurn()` quando `currentPlayerId === AI_PLAYER_ID`
3. Avançar para próxima rodada após IA terminar

## TODO

- [ ] Integrar com sistema de skills existente
- [ ] Adicionar suporte a skills de área
- [ ] Implementar comportamento de grupo (coordenação entre unidades)
- [ ] Adicionar níveis de dificuldade
- [ ] Cache de pathfinding para performance
