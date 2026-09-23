import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { formatarTelefone, rotuloDe } from '../conta/conta-contrato';
import { SessaoStore } from '../sessao/sessao-store';
import { PainelApi } from './painel-api';
import { CorretorPendente } from './painel-contrato';

const LIMITE_MOTIVO = 500;

@Component({
  selector: 'app-fila-aprovacao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    @if (pendentes().length > 0 || aviso() || erro()) {
      <section class="fila-aprovacao" aria-labelledby="titulo-novos-corretores">
        @if (pendentes().length > 0) {
          <h2 class="titulo" id="titulo-novos-corretores">
            Novos corretores · {{ pendentes().length }}
          </h2>
          <ul class="lista">
            @for (pendente of pendentes(); track pendente.id) {
              <li class="linha" [class.aberta]="recusando() === pendente.id">
                <span class="nome">{{ pendente.nome }}</span>
                <span class="estado">Em análise</span>
                @if (recusando() !== pendente.id) {
                  <span class="meta">{{ pendente.email }} · {{ telefone(pendente.telefone) }}</span>
                }
                <span class="meta">{{ atuacao(pendente) }}</span>

                @if (recusando() === pendente.id) {
                  <label class="rotulo" [for]="'motivo-' + pendente.id"
                    >Motivo · opcional, vai no e-mail</label
                  >
                  <textarea
                    class="motivo"
                    [id]="'motivo-' + pendente.id"
                    [name]="'motivo-' + pendente.id"
                    [maxlength]="limiteMotivo"
                    [disabled]="enviando()"
                    [ngModel]="motivo()"
                    (ngModelChange)="motivo.set($event)"
                  ></textarea>
                  <div class="acoes">
                    <button
                      class="acao perigo"
                      type="button"
                      [disabled]="enviando()"
                      (click)="confirmarRecusa(pendente)"
                    >
                      Recusar e avisar por e-mail
                    </button>
                    <button
                      class="acao neutra"
                      type="button"
                      [disabled]="enviando()"
                      (click)="cancelarRecusa()"
                    >
                      Cancelar
                    </button>
                  </div>
                } @else {
                  <div class="acoes">
                    <button
                      class="acao principal"
                      type="button"
                      [disabled]="enviando()"
                      (click)="aprovar(pendente)"
                    >
                      Aprovar
                    </button>
                    <button
                      class="acao neutra"
                      type="button"
                      [disabled]="enviando()"
                      (click)="abrirRecusa(pendente)"
                    >
                      Recusar
                    </button>
                  </div>
                }
              </li>
            }
          </ul>
        }
        @if (aviso()) {
          <p class="aviso-ok" role="status">{{ aviso() }}</p>
        }
        @if (erro()) {
          <p class="erro" role="alert">{{ erro() }}</p>
        }
      </section>
    }
  `,
  styles: `
    .fila-aprovacao {
      flex: none;
      max-height: 45vh;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 20px 28px;
      background: var(--superficie-barra);
      border-bottom: 1px solid var(--borda-estrutura);
    }

    .titulo {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    .lista {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .linha {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 4px 12px;
      max-width: 720px;
      padding: 14px 16px;
      font-size: 14.5px;
      background: var(--superficie-elevada);
      border: 1px solid var(--borda-componente);
      border-radius: var(--raio-card);
    }

    .nome {
      font-weight: 600;
    }

    .estado {
      align-self: start;
      padding: 3px 9px;
      border-radius: 3px;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--atencao);
      background: color-mix(in srgb, var(--atencao) 14%, var(--superficie-elevada));
    }

    .meta,
    .rotulo,
    .motivo,
    .acoes {
      grid-column: 1 / -1;
    }

    .meta {
      font-size: 13.5px;
      color: var(--texto-secundario);
    }

    .rotulo {
      margin-top: 8px;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--texto-secundario);
    }

    .motivo {
      min-height: 64px;
      padding: 10px 12px;
      font: inherit;
      font-size: 14px;
      color: var(--texto-primario);
      background: var(--fundo-conversa);
      border: 1px solid var(--marca);
      border-radius: 8px;
      resize: vertical;
    }

    .acoes {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }

    .acao {
      min-height: 36px;
      padding: 0 16px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 999px;
      border: 1px solid transparent;
      cursor: pointer;

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      &.principal {
        color: var(--marca-contraste);
        background: var(--marca);
      }

      &.neutra {
        color: var(--texto-secundario);
        background: none;
        border-color: var(--borda-componente);
      }

      &.perigo {
        color: var(--superficie-elevada);
        background: var(--erro);
      }
    }

    .aviso-ok {
      max-width: 720px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 14.5px;
      color: var(--sucesso);
      background: color-mix(in srgb, var(--sucesso) 14%, var(--superficie-elevada));
    }

    .erro {
      font-size: 14px;
      color: var(--erro);
    }

    @media (max-width: 640px) {
      .fila-aprovacao {
        padding: 16px;
      }
    }
  `,
})
export class FilaAprovacao implements OnInit {
  private readonly api = inject(PainelApi);
  private readonly sessao = inject(SessaoStore);
  private readonly router = inject(Router);

  readonly limiteMotivo = LIMITE_MOTIVO;
  readonly pendentes = signal<CorretorPendente[]>([]);
  readonly recusando = signal<string | null>(null);
  readonly motivo = signal('');
  readonly enviando = signal(false);
  readonly aviso = signal<string | null>(null);
  readonly erro = signal<string | null>(null);

  ngOnInit(): void {
    this.api.listarPendentes().subscribe({
      next: (lista) => {
        this.pendentes.set(lista);
        this.sessao.pendentesAprovacao.set(lista.length);
      },
      error: (erro) => this.tratarErro(erro, null),
    });
  }

  aprovar(pendente: CorretorPendente): void {
    this.iniciar();
    this.api.aprovarCorretor(pendente.id).subscribe({
      next: () =>
        this.concluir(pendente, `Cadastro de ${pendente.nome} aprovado. O aviso segue por e-mail.`),
      error: (erro) => this.tratarErro(erro, pendente),
    });
  }

  abrirRecusa(pendente: CorretorPendente): void {
    this.motivo.set('');
    this.erro.set(null);
    this.recusando.set(pendente.id);
  }

  cancelarRecusa(): void {
    this.recusando.set(null);
    this.motivo.set('');
  }

  confirmarRecusa(pendente: CorretorPendente): void {
    this.iniciar();
    const motivo = this.motivo().trim().slice(0, LIMITE_MOTIVO) || null;
    this.api.recusarCorretor(pendente.id, motivo).subscribe({
      next: () =>
        this.concluir(pendente, `Cadastro de ${pendente.nome} recusado. O aviso segue por e-mail.`),
      error: (erro) => this.tratarErro(erro, pendente),
    });
  }

  telefone(digitos: string): string {
    return formatarTelefone(digitos);
  }

  atuacao(pendente: CorretorPendente): string {
    const regioes = pendente.regioes.map(rotuloDe).join(', ');
    const especialidades = pendente.especialidades.map(rotuloDe).join(', ');
    return `${regioes} · ${especialidades} · ${haQuanto(pendente.criadoEm)}`;
  }

  private iniciar(): void {
    this.enviando.set(true);
    this.aviso.set(null);
    this.erro.set(null);
  }

  private concluir(pendente: CorretorPendente, aviso: string): void {
    this.enviando.set(false);
    this.remover(pendente);
    this.aviso.set(aviso);
  }

  private remover(pendente: CorretorPendente): void {
    this.pendentes.update((lista) => lista.filter((item) => item.id !== pendente.id));
    this.sessao.descontarPendente();
    this.cancelarRecusa();
  }

  private tratarErro(erro: { status?: number } | null, pendente: CorretorPendente | null): void {
    this.enviando.set(false);

    if (erro?.status === 401) {
      this.sessao.limpar();
      void this.router.navigate(['/entrar']);
      return;
    }

    if (erro?.status === 404 && pendente) {
      this.remover(pendente);
      this.erro.set('Este cadastro já não está pendente.');
      return;
    }

    if (erro?.status === 403 || !pendente) {
      return;
    }

    this.erro.set('Não foi possível concluir agora. Tente de novo.');
  }
}

function haQuanto(iso: string): string {
  const inicio = new Date(iso).getTime();
  if (Number.isNaN(inicio)) {
    return '';
  }
  const minutos = Math.floor(Math.max(0, Date.now() - inicio) / 60000);
  if (minutos < 1) {
    return 'agora';
  }
  if (minutos < 60) {
    return `há ${minutos} min`;
  }
  const horas = Math.floor(minutos / 60);
  return horas < 24 ? `há ${horas} h` : `há ${Math.floor(horas / 24)} d`;
}
