# solar-ai-front

> **Interface do Usuário (Chat do Lead e Painel do Corretor)**  
> Para a visão geral da plataforma Solar, governança completa de privacidade e diagrama de arquitetura do sistema, consulte o **[README Hub do Solar](https://github.com/fvconde/solar-ai-docs)**.

---

## 1. Papel no Ecossistema

O `solar-ai-front` é a aplicação cliente web do Solar. Desenvolvido em **Angular 20 standalone** com gerenciamento de estado baseado em **Signals**, ele concentra duas interfaces essenciais:
1. **Chat do Lead (`/`)**: Interface conversacional direta com a corretora virtual **Lia**. Implementa o fluxo obrigatório de consentimento LGPD na abertura, kickoff silencioso, renderização de cards de imóveis e formulário seguro de coleta de contato no handoff.
2. **Painel do Corretor (`/painel`)**: Console operacional interno para corretores humanos parceiros acompanharem a fila de leads qualificados em tempo real, com ordenação prioritária por score e filtros por corretor/intenção.
3. **Aviso de Privacidade Completo (`/privacidade`)**: Página dedicada contendo os termos integrais de governança e proteção de dados do Solar.

---

## 2. Como Rodar Localmente

### Pré-requisitos
- Node.js 22+ e npm instalados.
- Backend (`solar-ai-api`) e Agente (`solar-ai`) em execução (orquestrados pelo Docker Compose do `solar-ai-docs`).

### Execução em Desenvolvimento
```bash
npm install
npm start
```

O comando `npm start` executa o `ng serve` em `http://localhost:4200` utilizando as regras de proxy definidas em `proxy.conf.json`. O proxy encaminha requisições para `/conversas`, `/painel` e `/health` diretamente para `http://localhost:8080`, eliminando a necessidade de configurações manuais de CORS no navegador durante o desenvolvimento local.

---

## 3. Interfaces e Fluxos do Usuário

### Fluxo de Consentimento e Chat do Lead
1. **Aviso de Consentimento na Abertura (`app-aviso-consentimento`)**:
   - Apresenta o termo resumido de privacidade exigindo aceite ativo (checkbox desmarcada por padrão).
   - O botão de confirmação dispara `POST /conversas/{guid}/consentimento`. Se o usuário não consentir, nenhuma mensagem é transmitida e a sessão não é iniciada.
   - O identificador da conversa (`guid`) é mantido em `localStorage`; o carimbo e a versão do aviso são validados pelo servidor.
2. **Kickoff Silencioso**:
   - Após o consentimento confirmado pelo servidor, o frontend envia uma mensagem inicial `"Olá"` que não é renderizada na tela, disparando a primeira fala natural de apresentação da Lia.
3. **Handoff e Formulário de Contato (`app-formulario-contato`)**:
   - Quando o lead atinge os critérios de agendamento ou encaminhamento especializado, um formulário de contato surge na trilha solicitando `nome`, `telefone` e `e-mail`.
   - O envio ocorre via `POST /conversas/{guid}/contato`, gravando os dados diretamente no banco de dados da API, sem transitar pela IA.

### Painel do Corretor (`/painel`)
- Permite selecionar o corretor logado e consultar a listagem de leads qualificados.
- As requisições enviam a credencial administrativa `X-Chave-Privacidade` e o identificador do corretor selecionado `X-Corretor-Id`.
- Permite filtrar por intenção (`compra`, `aluguel`, `investimento`) e isolar leads atribuídos ao próprio profissional logado.

---

## 4. Contratos Consumidos da API

- `POST /conversas/{guid}/consentimento`: Registra o consentimento do lead com a versão da política vigente.
- `POST /conversas/{guid}/mensagens`: Envia fala do lead (`{ "texto": string }`) e recebe resposta estruturada da Lia (`MensagemResponse`).
- `POST /conversas/{guid}/contato`: Registra nome e meios de contato (`telefone`, `email`) do titular.
- `GET /conversas/{guid}`: Reconstrói o histórico da conversa e o estado do atendimento após recarregar a página.
- `GET /painel/corretores`: Lista corretores ativos para o seletor do painel.
- `GET /painel/leads`: Recupera a fila de leads qualificados com scores calculados.

---

## 5. Mapa de `proximaAcao` para a Interface

A propriedade `proximaAcao` retornada pela API determina o comportamento visual da trilha do chat:

| `proximaAcao` | Efeito Visual na Trilha |
|---|---|
| `continuar_conversa` | Exibe a fala da Lia e mantém o composer de digitação ativo. |
| `sugerir_imoveis` | Renderiza a pilha de até 3 cartões de recomendação imobiliária abaixo da fala da Lia. |
| `agendar_reuniao` | Dispara o evento de sucesso "Encaminhado", solicitando dados de contato ou confirmando agendamento. |
| `direcionar_especialista` | Dispara o evento de sistema "Próxima etapa", direcionando o investidor a um consultor humano. |
| `encerrar` | Evento terminal na conversa; remove o campo de digitação e exibe o botão "Iniciar nova conversa". |

---

## 6. Design System e Tokens

- **Fonte de Verdade**: Projeto Claude Design "Board de interface Lia" (`Solar Chat - Handoff v1.0`).
- **Tokens de Estilo**: Cores, tipografia, elevação e espaçamentos definidos em `src/styles.scss` espelhando exatamente a nomenclatura do handoff.
- **Modo Noturno / Claro**: Suporte automático via `prefers-color-scheme`, com override manual por atributo `data-tema="claro" | "escuro"` na tag `<html>`.

---

## 7. Pendências do Handoff que Dependem de Decisão Fora do Front

- Retomada proativa (follow-up): implementada com polling na aba aberta, intervalo configurável e limite de 2 tentativas por lead — controle de ativar/desativar pela interface ainda não existe.
- Estado "sem resultado" quando nenhum imóvel atende à faixa.
- `imoveisSugeridos` não é persistido no histórico da API: ao recarregar, os cards de turnos antigos não voltam; o texto da conversa volta.

---

## 8. Testes e Build

```bash
# Executar suíte de testes unitários (Karma + Jasmine em Chrome Headless)
npm test

# Gerar build otimizado de produção em dist/
npm run build
```
