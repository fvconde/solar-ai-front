# solar-ai-front

[![CI](https://github.com/fvconde/solar-ai-front/actions/workflows/ci.yml/badge.svg)](https://github.com/fvconde/solar-ai-front/actions/workflows/ci.yml)

Interface web do **Solar**, um SDR imobiliário com IA. O lead conversa com a **Lia**, a corretora virtual, e o corretor humano acompanha os leads qualificados num painel.

| Repositório | Papel |
|---|---|
| **solar-ai-front** | Chat do lead e painel do corretor (Angular) |
| [solar-ai-api](https://github.com/fvconde/solar-ai-api) | API, banco e regras de negócio (.NET) |
| [solar-ai](https://github.com/fvconde/solar-ai) | Agente da Lia (Python, LangGraph, Gemini) |

**Stack:** Angular 20 (standalone + Signals) · TypeScript · SCSS · Karma/Jasmine

---

## Rodar localmente

### Pré-requisitos

- Node.js 22+
- Backend rodando em `http://localhost:8080`. Ele sobe com um único `docker compose up` a partir do [solar-ai-api](https://github.com/fvconde/solar-ai-api#rodar-localmente).

### Subir

```bash
npm install
npm start
```

Abra http://localhost:4200. O `ng serve` usa o `proxy.conf.json` para encaminhar as chamadas à API em `localhost:8080`, então não é preciso configurar CORS.

### Telas

| Rota | Tela |
|---|---|
| `/` | Chat com a Lia (pede consentimento LGPD antes da primeira mensagem) |
| `/entrar` | Login de corretor e cliente |
| `/cadastro` · `/seja-corretor` | Cadastro de cliente · cadastro de corretor |
| `/painel` | Painel do corretor: fila de leads por score, detalhe do lead, métricas e aprovação de novos corretores (supervisor) |
| `/conta` | Dados do cliente, histórico de conversas e exclusão da conta |
| `/privacidade` | Aviso de privacidade completo |

Para entrar no painel localmente, use `supervisor.vinculado@solar.local` e a senha definida em `SEMENTE__SENHASUPERVISOR` no `.env` do solar-ai-api.

---

## Testes e build

```bash
npm test              # testes unitários (Karma + Jasmine)
npm run build         # build de produção em dist/
```

---

## Como a conversa funciona

1. Na abertura, o lead aceita o aviso de privacidade. Sem consentimento, nada é enviado.
2. O front manda um "Olá" silencioso, e a Lia se apresenta.
3. A cada mensagem, a resposta da API traz `proximaAcao`, que decide o que aparece na tela:

| `proximaAcao` | Na tela |
|---|---|
| `continuar_conversa` | Fala da Lia, campo de digitação ativo |
| `sugerir_imoveis` | Até 3 cartões de imóveis com o motivo da recomendação |
| `agendar_reuniao` | Horários para escolher e formulário de contato |
| `direcionar_especialista` | Encaminhamento a um consultor humano |
| `encerrar` | Fim da conversa, com botão para iniciar outra |

Nome, telefone e e-mail vão direto para a API pelo formulário de contato e nunca passam pela IA.
