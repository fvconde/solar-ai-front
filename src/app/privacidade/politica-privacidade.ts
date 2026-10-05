import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { VERSAO_AVISO_PRIVACIDADE } from '../conversa/contrato';

interface EstadoBarraRolagem {
  topo: number;
  altura: number;
  thumbTopo: number;
  thumbAltura: number;
  visivel: boolean;
}

@Component({
  selector: 'app-politica-privacidade',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <main class="pagina">
      <article>
        <p class="rotulo">Aviso de Privacidade · versão {{ versao }}</p>
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

        <h2>Retenção</h2>
        <p>
          O prazo de guarda e o descarte seguem a
          <a
            href="https://github.com/fvconde/solar-ai-docs#53-política-de-retenção-de-dados-fonte-única"
            target="_blank"
            rel="noopener noreferrer"
            >política de retenção de 12 meses da Solar</a
          >.
        </p>

        <h2 id="eliminacao">Como pedir a eliminação dos seus dados</h2>
        <p>
          Você pode pedir que a Solar apague os dados associados ao seu atendimento. Existem dois
          caminhos, e você escolhe qual usar.
        </p>

        <div class="grade-canais">
          <section aria-labelledby="canal-chat" class="cartao">
            <span class="rotulo-canal">No chat · você mesmo</span>
            <h3 id="canal-chat">Apagar pelo botão do chat</h3>
            <p>
              Na conversa com a Lia, use <b>Apagar conversa</b>, logo abaixo do campo de mensagem.
              Você confirma, e a conversa e suas mensagens são apagadas definitivamente. Não é
              possível desfazer.
            </p>
            <h4>Limites deste caminho</h4>
            <ul>
              <li>
                Apaga só a conversa escolhida. Suas outras conversas e o seu cadastro na Solar não
                são apagados por ele.
              </li>
              <li>
                Funciona no navegador em que a conversa foi aberta ou, com login, na sua conta. Quem
                usar esse mesmo navegador também consegue apagar.
              </li>
              <li>
                Algumas conversas antigas, abertas antes de o botão existir, podem não ter essa
                opção. Nesse caso, peça pelo atendimento.
              </li>
              <li>Para excluir a conta inteira, use <a routerLink="/conta">Minha conta</a>.</li>
            </ul>
            <a routerLink="/" class="link-acao">Ir para a conversa</a>
          </section>

          <section aria-labelledby="canal-humano" class="cartao">
            <span class="rotulo-canal">Com uma pessoa · atendimento</span>
            <h3 id="canal-humano">Pedir ao atendimento humano</h3>
            <p>Peça ao corretor que atende você ou ao atendimento da Solar.</p>
            <h4>Use este caminho para</h4>
            <ul>
              <li>apagar outros dados do seu cadastro, além da conversa;</li>
              <li>conversas antigas que não tenham o botão;</li>
              <li>qualquer caso em que você prefira falar com uma pessoa.</li>
            </ul>
            <p class="orientacao">
              Para localizarmos seus dados, informe o telefone ou e-mail que você usou e, se
              lembrar, o dia da conversa.
            </p>
          </section>
        </div>

        <p>Evite enviar documentos, dados bancários ou informações sensíveis.</p>
        <a routerLink="/" class="link-voltar">Voltar para a conversa</a>
      </article>
    </main>
    <div
      class="barra-rolagem"
      [class.visivel]="barraRolagem().visivel"
      [style.top.px]="barraRolagem().topo"
      [style.height.px]="barraRolagem().altura"
      aria-hidden="true"
    >
      <span
        class="thumb-rolagem"
        [style.height.px]="barraRolagem().thumbAltura"
        [style.transform]="'translateY(' + barraRolagem().thumbTopo + 'px)'"
      ></span>
    </div>
  `,
  styles: `
    :host {
      display: block;
      flex: 1 1 auto;
      min-height: 0;
      overflow-x: hidden;
      overflow-y: auto;
      scrollbar-width: none;
    }

    :host::-webkit-scrollbar {
      display: none;
      width: 0;
      height: 0;
    }

    .barra-rolagem {
      position: fixed;
      right: 2px;
      z-index: 1;
      width: 10px;
      pointer-events: none;
      visibility: hidden;
    }

    .barra-rolagem.visivel {
      visibility: visible;
    }

    .thumb-rolagem {
      display: block;
      width: 6px;
      margin: 0 auto;
      border-radius: 999px;
      background: var(--texto-secundario);
      opacity: 0.72;
    }

    .pagina {
      box-sizing: border-box;
      min-height: 100%;
      padding: 32px 24px 40px;
      background: var(--fundo-conversa);
      color: var(--texto-primario);
      font-size: 16px;
      line-height: 1.55;
    }

    article {
      box-sizing: border-box;
      max-width: 760px;
      margin: 0 auto;
      padding: 32px;
      border: 1px solid var(--borda-estrutura);
      border-radius: var(--raio-card);
      background: var(--superficie-elevada);
    }

    .rotulo {
      margin: 0;
      color: var(--texto-secundario);
      font-size: 12px;
      line-height: 1.4;
    }

    h1 {
      margin: 8px 0 24px;
      font-size: clamp(24px, 3.5vw, 36px);
      line-height: 1.15;
      letter-spacing: -0.02em;
    }

    h2 {
      margin: 24px 0 8px;
      font-size: 17px;
      line-height: 1.3;
    }

    h2#eliminacao {
      margin-top: 32px;
    }

    p {
      margin: 0 0 16px;
      line-height: 1.55;
    }

    p a,
    li a {
      display: inline;
      margin-top: 0;
      color: var(--marca);
      font-weight: 600;
    }

    .grade-canais {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
      gap: 16px;
      margin: 0 0 20px;
    }

    .cartao {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 20px 22px;
      box-sizing: border-box;
      background: color-mix(in srgb, var(--superficie-elevada) 72%, var(--fundo-conversa));
      border: 1px solid var(--borda-componente);
      border-radius: var(--raio-card);
    }

    .rotulo-canal {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--texto-secundario);
    }

    .cartao h3 {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
      line-height: 1.3;
    }

    .cartao p {
      margin: 0;
      font-size: 15px;
      line-height: 1.55;
    }

    .cartao h4 {
      margin: 4px 0 0;
      font-size: 14px;
      font-weight: 600;
    }

    .cartao ul {
      margin: 0;
      padding-left: 20px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 14px;
      line-height: 1.5;
    }

    .cartao li {
      margin: 0;
    }

    .cartao .orientacao {
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
      color: var(--texto-secundario);
    }

    .cartao .link-acao {
      align-self: flex-start;
      margin-top: 4px;
      font-family: 'Instrument Sans', system-ui, sans-serif;
      font-size: 14px;
      font-weight: 600;
      color: var(--marca);
      text-underline-offset: 3px;
    }

    .link-voltar {
      display: inline-block;
      margin-top: 4px;
      color: var(--marca);
      font-weight: 600;
    }

    @media (max-width: 640px) {
      .pagina {
        padding: 20px 16px 32px;
      }

      article {
        padding: 20px 18px;
      }

      h1 {
        margin-bottom: 20px;
        font-size: clamp(24px, 8vw, 30px);
      }

      h2 {
        margin-top: 20px;
        font-size: 16px;
      }

      h2#eliminacao {
        margin-top: 28px;
      }

      .grade-canais {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .cartao {
        padding: 18px 16px;
      }

      .cartao .link-acao {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
      }
    }
  `,
})
export class PoliticaPrivacidade implements AfterViewInit {
  private readonly elemento = inject(ElementRef<HTMLElement>);

  protected readonly versao = VERSAO_AVISO_PRIVACIDADE;

  readonly barraRolagem = signal<EstadoBarraRolagem>({
    topo: 0,
    altura: 0,
    thumbTopo: 0,
    thumbAltura: 0,
    visivel: false,
  });

  ngAfterViewInit(): void {
    this.atualizarBarraRolagem();
  }

  @HostListener('scroll')
  aoRolar(): void {
    this.atualizarBarraRolagem();
  }

  @HostListener('window:resize')
  aoRedimensionar(): void {
    this.atualizarBarraRolagem();
  }

  private atualizarBarraRolagem(): void {
    const host = this.elemento.nativeElement;
    const altura = host.clientHeight;
    const conteudo = host.scrollHeight;
    const excesso = conteudo - altura;
    const thumbAltura = excesso > 0 ? Math.max((altura / conteudo) * altura, 32) : 0;
    const faixa = Math.max(altura - thumbAltura, 0);
    const thumbTopo = excesso > 0 ? (host.scrollTop / excesso) * faixa : 0;
    const rect = host.getBoundingClientRect();

    this.barraRolagem.set({
      topo: rect.top,
      altura,
      thumbTopo,
      thumbAltura,
      visivel: excesso > 0,
    });
  }
}
