import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ConversaResumo } from '../conta/conta-contrato';
import { diaCurto, ehHoje, HOJE, horaDe } from '../conversa/horario';

const ESTADOS: Record<ConversaResumo['estado'], string> = {
  em_andamento: 'em andamento',
  com_corretor: 'com corretor',
  encerrada: 'encerrada',
};

@Component({
  selector: 'app-historico-conversas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="historico" [class.lista]="lista()" aria-label="Suas conversas">
      @if (lista()) {
        <div class="topo">
          <h2>Conversas</h2>
          <button class="nova" type="button" (click)="nova.emit()">+ Nova</button>
        </div>
      } @else {
        <button class="nova" type="button" (click)="nova.emit()">+ Nova conversa</button>
      }

      @for (grupo of grupos(); track grupo.rotulo) {
        @if (!lista()) {
          <p class="grupo">{{ grupo.rotulo }}</p>
        }
        <ul>
          @for (conversa of grupo.itens; track conversa.id) {
            <li>
              <button
                class="conversa"
                type="button"
                [class.ativa]="conversa.id === ativa()"
                [attr.aria-current]="conversa.id === ativa() ? 'true' : null"
                (click)="abrir.emit(conversa.id)"
              >
                <b>{{ conversa.titulo }}</b>
                <span>{{ detalhe(conversa) }}</span>
              </button>
            </li>
          }
        </ul>
      }
    </nav>
  `,
  styles: `
    .historico {
      display: flex;
      flex-direction: column;
      gap: 4px;
      height: 100%;
      overflow-y: auto;
      padding: 20px 14px;
      background: var(--superficie-barra);
      border-right: 1px solid var(--borda-estrutura);

      &.lista {
        padding: 20px;
        background: var(--fundo-conversa);
        border-right: none;
      }
    }

    .topo {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;

      h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }
    }

    .nova {
      align-self: flex-start;
      margin-bottom: 8px;
      padding: 6px 14px;
      font-size: 14px;
      font-weight: 600;
      color: var(--marca);
      background: none;
      border: 1px solid var(--marca);
      border-radius: 999px;
      cursor: pointer;

      .topo & {
        margin-bottom: 0;
      }
    }

    .grupo {
      margin-top: 12px;
      padding: 0 10px;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 10.5px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--texto-secundario);
    }

    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .conversa {
      display: flex;
      flex-direction: column;
      gap: 2px;
      width: 100%;
      padding: 9px 10px;
      text-align: left;
      background: none;
      border: none;
      border-radius: 8px;
      cursor: pointer;

      b {
        font-size: 14px;
        font-weight: 500;
        line-height: 1.3;
        color: var(--texto-primario);
      }

      span {
        font-size: 12px;
        color: var(--texto-secundario);
      }

      &:hover {
        background: var(--inativo-fundo);
      }

      &.ativa {
        background: color-mix(in srgb, var(--marca) 14%, var(--superficie-elevada));

        b {
          font-weight: 600;
          color: var(--marca);
        }
      }
    }
  `,
})
export class HistoricoConversas {
  readonly conversas = input.required<ConversaResumo[]>();
  readonly ativa = input<string>('');
  readonly lista = input(false);
  readonly abrir = output<string>();
  readonly nova = output<void>();

  readonly grupos = computed(() => {
    const hoje = this.conversas().filter((c) => ehHoje(c.atualizadaEm));
    const antes = this.conversas().filter((c) => !ehHoje(c.atualizadaEm));
    return [
      { rotulo: HOJE, itens: hoje },
      { rotulo: 'Antes', itens: antes },
    ].filter((grupo) => grupo.itens.length > 0);
  });

  detalhe(conversa: ConversaResumo): string {
    const quando = ehHoje(conversa.atualizadaEm)
      ? this.lista()
        ? `hoje, ${horaDe(conversa.atualizadaEm)}`
        : horaDe(conversa.atualizadaEm)
      : diaCurto(conversa.atualizadaEm);
    return `${quando} · ${ESTADOS[conversa.estado]}`;
  }
}
