# Battle Realm - Diretrizes de Desenvolvimento

## Princípios Fundamentais

1. **Backend calcula, frontend exibe** - Toda lógica de jogo fica no server
2. **Tipos compartilhados** - Tudo que server e client usam vai em `shared/`
3. **Reutilização** - Verificar se já existe antes de criar
4. **Código limpo** - Deletar código morto, nunca comentar

## Regras Obrigatórias

### FAZER

- Tipos em `shared/types/`
- Colyseus rooms: `{Domain}Room`
- Mensagens Colyseus: `{domain}:{action}`
- Imports do shared: `@boundless/shared/*`
- Componentes separados por arquivo
- Conferir erros antes de finalizar

### NÃO FAZER

- Lógica de jogo no frontend
- Duplicar tipos existentes
- Comentar código antigo
- Executar `npm run build/dev`
- Manter imports não usados
- Criar documentação não solicitada
- Usar Socket.IO (usar Colyseus)
- Imports relativos ao shared (`../../../shared/...`)

## Imports do Shared

Usar sempre `@boundless/shared`:

- `@boundless/shared/types/{arquivo}.types`
- `@boundless/shared/data/{arquivo}.data`
- `@boundless/shared/config`
- `@boundless/shared/utils/{arquivo}.utils`
- `@boundless/shared/qte`

## Stack

| Área        | Biblioteca         |
| ----------- | ------------------ |
| Multiplayer | Colyseus           |
| Animação    | Framer Motion      |
| Teclado     | React-Hotkeys-Hook |
| Pathfinding | Pathfinding.js     |
| Estado      | Zustand            |
| Som         | Howler.js          |
| Canvas      | React-Konva        |

## Estrutura de Arquivos

| Local                  | Conteúdo                                    |
| ---------------------- | ------------------------------------------- |
| `shared/types/`        | Tipos TypeScript compartilhados             |
| `shared/data/`         | Dados estáticos (abilities, races, classes) |
| `shared/config/`       | Configurações globais                       |
| `shared/utils/`        | Utilitários puros                           |
| `server/src/modules/`  | Lógica de negócio por domínio               |
| `server/src/colyseus/` | Rooms e Schemas                             |
| `client/src/features/` | Features por domínio                        |
| `client/src/services/` | Serviços singleton                          |
| `client/src/stores/`   | Zustand stores                              |

## Sistema de Atributos

| Atributo   | Função                                      |
| ---------- | ------------------------------------------- |
| Combat     | Dano físico direto                          |
| Speed      | Movimento + Esquiva (3%/ponto)              |
| Focus      | Poder mágico + Visão                        |
| Resistance | Proteção física (2x) + Custo de Engajamento |
| Will       | Mana (2x) + Proteção mágica (2x)            |
| Vitality   | HP máximo                                   |

## Referência Rápida

| Tarefa           | Arquivo                                          |
| ---------------- | ------------------------------------------------ |
| Novo tipo        | `shared/types/{tipo}.types.ts`                   |
| Nova ability     | `shared/data/abilities.data.ts`                  |
| Nova condição    | `shared/data/conditions.data.ts`                 |
| Executor ability | `server/src/modules/abilities/executors/`        |
| Nova Room        | `server/src/colyseus/rooms/{Domain}Room.ts`      |
| Novo Schema      | `server/src/colyseus/schemas/{domain}.schema.ts` |
| Nova feature     | `client/src/features/{feature}/`                 |
