import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContaApi } from '../conta/conta-api';
import { ContaResponse, juntarComE, rotuloDe } from '../conta/conta-contrato';
import { diaCurto, horaDe } from '../conversa/horario';

@Component({
  selector: 'app-painel-em-analise',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <main class="em-analise">
      <div class="conteudo">
        <section class="introducao" aria-labelledby="titulo-em-analise">
          <h1 id="titulo-em-analise" class="titulo">Seu cadastro está com a supervisão</h1>
          @if (conta()) {
            <p class="texto">
              Quando aprovarem, os leads de <b>{{ regioes() }}</b> em
              <b>{{ especialidades() }}</b> aparecem aqui. Avisamos por e-mail.
            </p>
          }
        </section>

        <ol class="trilha" aria-label="Etapas do cadastro">
          <li class="passo feito">
            <span class="bola" aria-hidden="true"></span>
            <div>
              <b>Conta criada</b>
              @if (conta(); as c) {
                <span>{{ quando(c.criadaEm) }}</span>
              }
            </div>
          </li>
          <li class="passo agora" aria-current="step">
            <span class="bola" aria-hidden="true"></span>
            <div>
              <b>Análise da supervisão</b>
              <span>em andamento · até 1 dia útil</span>
            </div>
          </li>
          <li class="passo">
            <span class="bola" aria-hidden="true"></span>
            <div>
              <b>Acesso aos leads</b>
              <span>liberado na aprovação</span>
            </div>
          </li>
        </ol>

        <section class="fila-vazia" aria-labelledby="titulo-fila-leads">
          <h2 id="titulo-fila-leads">Fila de leads</h2>
          <p>Os leads aparecem aqui após a aprovação da supervisão.</p>
        </section>

        <nav class="acoes" aria-label="Próximos passos">
          <a routerLink="/" class="acao-primaria">Conversar com a Lia</a>
          <a routerLink="/conta" class="acao-secundaria">Revisar minha conta</a>
        </nav>
      </div>
    </main>
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
    }

    .em-analise {
      box-sizing: border-box;
      display: flex;
      justify-content: center;
      width: 100%;
      min-height: 100%;
      padding: 56px 24px;
    }

    .conteudo {
      display: flex;
      flex-direction: column;
      gap: 24px;
      width: 100%;
      max-width: 560px;
      margin: 0 auto;
    }

    .titulo {
      margin: 0;
      font-size: 26px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    .texto {
      margin: 8px 0 0;
      font-size: 15px;
      line-height: 1.5;
      color: var(--texto-secundario);

      b {
        font-weight: 600;
        color: var(--texto-primario);
      }
    }

    .trilha {
      margin: 0;
      padding: 22px 24px;
      list-style: none;
      background: var(--superficie-elevada);
      border: 1px solid var(--borda-estrutura);
      border-radius: 14px;
    }

    .passo {
      position: relative;
      display: grid;
      grid-template-columns: 22px 1fr;
      gap: 14px;
      padding-bottom: 20px;
      font-size: 14px;

      &::before {
        content: '';
        position: absolute;
        left: 10px;
        top: 22px;
        bottom: 0;
        width: 2px;
        background: var(--borda-estrutura);
      }

      &:last-child::before {
        display: none;
      }

      &:last-child {
        padding-bottom: 0;
      }

      b {
        display: block;
        font-weight: 600;
      }

      span {
        font-size: 13px;
        color: var(--texto-secundario);
      }
    }

    .bola {
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2px solid var(--borda-componente);
      background: var(--superficie-elevada);
      font-size: 11px;
      color: var(--marca-contraste);
    }

    .feito .bola {
      border-color: var(--sucesso);
      background: var(--sucesso);

      &::after {
        content: '✓';
      }
    }

    .agora .bola {
      border-color: var(--atencao);
      background: color-mix(in srgb, var(--atencao) 16%, var(--superficie-elevada));
    }

    .fila-vazia {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 8px;
      min-height: 144px;
      padding: 22px 24px;
      border: 1px dashed var(--borda-componente);
      border-radius: 14px;
      text-align: center;

      h2,
      p {
        margin: 0;
      }

      h2 {
        font-size: 15px;
        font-weight: 600;
      }

      p {
        color: var(--texto-secundario);
        font-size: 14px;
        line-height: 1.5;
      }
    }

    .acoes {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .acao-primaria {
      display: inline-flex;
      min-height: 44px;
      align-items: center;
      justify-content: center;
      padding: 0 20px;
      border-radius: 999px;
      background: var(--marca);
      color: var(--marca-contraste);
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;

      &:hover {
        background: color-mix(in srgb, var(--marca) 86%, var(--texto-primario));
      }
    }

    .acao-secundaria {
      color: var(--marca);
      font-size: 14px;
      font-weight: 600;
      text-underline-offset: 3px;
    }

    @media (max-width: 640px) {
      .em-analise {
        justify-content: flex-start;
        padding: 32px 20px;
      }

      .conteudo {
        gap: 20px;
      }

      .trilha,
      .fila-vazia {
        padding: 20px;
      }

      .acoes {
        flex-direction: column;
        align-items: stretch;
      }

      .acao-secundaria {
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
  `,
})
export class PainelEmAnalise implements OnInit {
  private readonly api = inject(ContaApi);

  readonly conta = signal<ContaResponse | null>(null);
  readonly regioes = computed(() =>
    juntarComE((this.conta()?.corretor?.regioes ?? []).map(rotuloDe)),
  );
  readonly especialidades = computed(() =>
    juntarComE((this.conta()?.corretor?.especialidades ?? []).map(rotuloDe)),
  );

  ngOnInit(): void {
    this.api.obter().subscribe({
      next: (conta) => this.conta.set(conta),
      error: () => this.conta.set(null),
    });
  }

  quando(iso: string): string {
    return `${diaCurto(iso)}, ${horaDe(iso)}`;
  }
}
