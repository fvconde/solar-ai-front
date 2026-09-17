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

    p {
      margin: 0 0 16px;
      line-height: 1.55;
    }

    a {
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
    }
  `,
})
export class PoliticaPrivacidade implements AfterViewInit {
  private readonly elemento = inject(ElementRef<HTMLElement>);

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
