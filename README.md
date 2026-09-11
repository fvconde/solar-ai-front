# solar-ai-front

Chat web do Solar — a interface da agente **Lia**. Angular 20 standalone, sem streaming.

## Rodar

```bash
npm install
npm start
```

`ng serve` sobe em `http://localhost:4200` e faz proxy de `/conversas` e `/turn` para
`http://localhost:8080` (config em `proxy.conf.json`). Com o proxy, o navegador nunca fala
direto com a API, então **não** é preciso CORS liberado no `solar-ai-api` para o
desenvolvimento local. Para servir o build por outra origem, aí sim a API precisa liberar
`Access-Control-Allow-Origin`.

A API e o agente sobem pelo `docker compose` do `solar-ai-docs` (ver `ESTADO.md`).

## Contrato consumido

- `POST /conversas/{guid}/mensagens` — corpo `{ "texto": string }`, resposta
  `{ conversaId, resposta, intencao, proximaAcao, perfilLead, imoveisSugeridos }`.
- `POST /conversas/{guid}/consentimento` — registra no lead a data/hora e a versão do aviso.
- `GET /conversas/{guid}` — histórico e perfil, para retomar a conversa ao recarregar.

Somente o `guid` da conversa fica em `localStorage`; o aceite é confirmado pelo servidor.
Após o carimbo existir no lead, o front envia uma mensagem de abertura que **não** é exibida,
e a primeira fala visível é a resposta da Lia.

## Mapa de `proximaAcao` para a interface

| `proximaAcao`             | Efeito na tela                                                        |
| ------------------------- | -------------------------------------------------------------------- |
| `continuar_conversa`      | segue conversando                                                    |
| `sugerir_imoveis`         | pilha de até 3 cards abaixo da fala da Lia                           |
| `agendar_reuniao`         | evento de sucesso "Encaminhado"                                      |
| `direcionar_especialista` | evento neutro "Próxima etapa"                                        |
| `encerrar`                | evento terminal, composer removido, ação "Iniciar nova conversa"    |

## Design

Fonte de verdade: `Solar Chat - Handoff v1.0` (projeto Claude Design "Board de interface
Lia"). Tokens de cor, tipografia e espaçamento em `src/styles.scss`, um a um com os nomes
do handoff. Tema claro/escuro por `prefers-color-scheme`, com override manual via
`data-tema="claro" | "escuro"` no `<html>`.

### Pendências do handoff que dependem de decisão fora do front

- Retomada proativa (follow-up) — controle de ativar/desativar ainda não existe.
- Estado "sem resultado" quando nenhum imóvel atende à faixa.
- `imoveisSugeridos` não é persistido no histórico da API: ao recarregar, os cards de
  turnos antigos não voltam; o texto da conversa volta.

## Testes e build

```bash
npm test                      # Karma + Jasmine
npm run build                 # bundle de produção em dist/
```
