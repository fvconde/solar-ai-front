import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ContaApi } from '../conta/conta-api';
import { ContaResponse, juntarComE, rotuloDe } from '../conta/conta-contrato';
import { diaCurto, horaDe } from '../conversa/horario';

@Component({
  selector: 'app-painel-em-analise',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="em-analise">
      <h1 class="titulo">Seu cadastro está com a supervisão</h1>
      @if (conta()) {
        <p class="texto">
          Quando aprovarem, os leads de <b>{{ regioes() }}</b> em
          <b>{{ especialidades() }}</b> aparecem aqui. Avisamos por e-mail.
        </p>
      }

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

      <p class="texto">Enquanto isso, você pode conversar com a Lia e revisar sua conta.</p>
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
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-width: 620px;
      padding: 40px 28px;
    }

    .titulo {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    .texto {
      font-size: 16px;
      line-height: 1.55;
      color: var(--texto-secundario);

      b {
        font-weight: 600;
        color: var(--texto-primario);
      }
    }

    .trilha {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .passo {
      position: relative;
      display: grid;
      grid-template-columns: 22px 1fr;
      gap: 14px;
      padding-bottom: 20px;
      font-size: 15px;

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

      b {
        display: block;
        font-weight: 600;
      }

      span {
        font-size: 13.5px;
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

    @media (max-width: 640px) {
      .em-analise {
        padding: 28px 20px;
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
