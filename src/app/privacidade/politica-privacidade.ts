import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-politica-privacidade',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <main class="pagina">
      <article>
        <p class="rotulo">Aviso de Privacidade · versão 2026-09-11</p>
        <h1>Como a Solar usa os dados desta conversa</h1>

        <h2>Dados e finalidade</h2>
        <p>
          A Solar usa as mensagens para compreender sua busca, qualificar seu interesse, recomendar
          imóveis e dar continuidade ao atendimento.
        </p>

        <h2>Inteligência artificial</h2>
        <p>
          As mensagens são processadas por um provedor de inteligência artificial e não são usadas
          por ele para treinar ou melhorar modelos de inteligência artificial.
        </p>

        <h2>Atendimento humano</h2>
        <p>
          Quando necessário, a conversa e o perfil formado a partir dela são compartilhados com um
          corretor humano da Solar para continuar o atendimento.
        </p>

        <h2>Retenção e eliminação</h2>
        <p>
          O prazo de guarda e o descarte seguem a política de retenção da Solar. Você pode solicitar
          a eliminação dos dados associados ao seu lead.
        </p>

        <p>Evite enviar documentos, dados bancários ou informações sensíveis.</p>
        <a routerLink="/">Voltar para a conversa</a>
      </article>
    </main>
  `,
  styles: `
    .pagina {
      min-height: calc(100vh - 72px);
      padding: 48px 24px;
      background: var(--fundo-conversa);
      color: var(--texto-primario);
    }

    article {
      max-width: 760px;
      margin: 0 auto;
      padding: 36px;
      border: 1px solid var(--borda-estrutura);
      border-radius: var(--raio-card);
      background: var(--superficie-elevada);
    }

    .rotulo {
      color: var(--texto-secundario);
      font-size: 13px;
    }

    h1 {
      margin: 8px 0 32px;
      font-size: clamp(28px, 5vw, 44px);
      line-height: 1.1;
    }

    h2 {
      margin: 28px 0 8px;
      font-size: 19px;
    }

    p {
      line-height: 1.65;
    }

    a {
      display: inline-block;
      margin-top: 24px;
      color: var(--marca);
      font-weight: 600;
    }

    @media (max-width: 640px) {
      .pagina {
        padding: 24px 16px;
      }

      article {
        padding: 24px 20px;
      }
    }
  `,
})
export class PoliticaPrivacidade {}
