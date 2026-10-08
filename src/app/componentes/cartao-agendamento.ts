import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SlotOferecido } from '../conversa/contrato';
import {
  diaDaSemanaDoAgendamento,
  diaExtensoDoAgendamento,
  GrupoDeHorarios,
  horaDoAgendamento,
  periodoDoAgendamento,
} from '../conversa/horario';

@Component({
  selector: 'app-cartao-agendamento',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!temHorarios()) {
      @if (horarioPerdido(); as perdido) {
        <div class="aviso-vazio-atencao" role="alert">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            class="icone-alerta"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="6.5"></circle>
            <path d="M8 4.5v4M8 11v.5"></path>
          </svg>
          <span
            >O horário das {{ horaPerdida() }} de {{ diaPerdido() }} acabou de ser reservado. Não há
            horários disponíveis no momento.</span
          >
        </div>
      } @else {
        <div class="aviso-vazio-neutro">
          <span>Não há horários disponíveis no momento.</span>
        </div>
      }
    } @else if (recolhido() && !confirmado()) {
      <div class="faixa-recolhida" [attr.aria-busy]="enviando() ? 'true' : null">
        <span class="faixa-texto">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            class="icone-calendario"
            aria-hidden="true"
          >
            <rect x="2" y="3" width="12" height="11" rx="2"></rect>
            <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3"></path>
          </svg>
          <span>Agendar reunião com {{ nomeCorretor() }}</span>
        </span>
        <button
          type="button"
          class="link-reabrir"
          [disabled]="reabrirDesabilitado()"
          (click)="aoReabrir()"
        >
          Ver horários
        </button>
      </div>
    } @else {
      <div class="cartao" [attr.aria-busy]="enviando() ? 'true' : null">
        @if (horarioPerdido()) {
          <div class="aviso-perda" role="alert">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              class="icone-alerta"
              aria-hidden="true"
            >
              <circle cx="8" cy="8" r="6.5"></circle>
              <path d="M8 4.5v4M8 11v.5"></path>
            </svg>
            <span
              >O horário das {{ horaPerdida() }} de {{ diaPerdido() }} acabou de ser reservado. Estes
              ainda estão livres:</span
            >
          </div>
        } @else {
          <div class="cab">
            <span class="avatar">{{ iniciais() }}</span>
            <div class="identificacao">
              <strong class="titulo">Agendar reunião com {{ nomeCorretor() }}</strong>
              <span class="subtitulo">Corretor(a) · 1 hora · horário de Brasília</span>
            </div>
          </div>
        }

        @for (grupo of grupos(); track grupo.dia) {
          @if (grupo.horarios && grupo.horarios.length > 0) {
            <div class="grupo">
              <span class="dia-titulo">{{ grupo.rotulo }}</span>
              <div class="slots-linha">
                @for (slot of grupo.horarios; track slot.id) {
                  <button
                    type="button"
                    class="slot-botao"
                    [class.selecionado]="confirmado()"
                    [disabled]="confirmado() || slotDesabilitado()"
                    [attr.aria-pressed]="confirmado() ? 'true' : null"
                    [attr.aria-label]="labelDoSlot(slot, grupo.rotulo)"
                    (click)="aoSelecionar(slot.id)"
                  >
                    <span class="slot-hora">{{ formatarHora(slot.inicio) }}</span>
                    <span class="slot-periodo">{{ formatarPeriodo(slot.inicio) }}</span>
                  </button>
                }
              </div>
            </div>
          }
        }

        @if (!confirmado()) {
          <div class="rodape">
            <button
              type="button"
              class="link-recolher"
              [disabled]="recolherDesabilitado()"
              (click)="aoRecolher()"
            >
              Agora não
            </button>
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      max-width: 560px;
      margin-inline: auto;
      box-sizing: border-box;
    }

    .cartao {
      background: var(--superficie-elevada);
      border: 1px solid var(--borda-componente);
      border-radius: var(--raio-card);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }

    .cab {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 14px 10px;
      box-sizing: border-box;
    }

    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--inativo-fundo);
      color: var(--texto-primario);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 600;
      flex: none;
    }

    .identificacao {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      word-break: break-word;
    }

    .titulo {
      font-size: 15px;
      font-weight: 700;
      color: var(--texto-primario);
      word-break: break-word;
      overflow-wrap: anywhere;
    }

    .subtitulo {
      font-size: 12px;
      color: var(--texto-secundario);
    }

    .aviso-perda {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      padding: 12px 14px;
      background: var(--inativo-fundo);
      color: var(--atencao);
      font-size: 13px;
      line-height: 1.4;
      box-sizing: border-box;
    }

    .icone-alerta {
      flex: none;
      margin-top: 1px;
    }

    .grupo {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 2px 14px 14px;
      box-sizing: border-box;
    }

    .dia-titulo {
      font-size: 14px;
      font-weight: 600;
      color: var(--texto-primario);
    }

    .slots-linha {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .slot-botao {
      font-family: 'Instrument Sans', system-ui, sans-serif;
      width: 76px;
      height: 54px;
      box-sizing: border-box;
      padding: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      background: var(--superficie-elevada);
      border: 1px solid var(--borda-componente);
      border-radius: 10px;
      color: var(--texto-primario);
      cursor: pointer;
    }

    .slot-botao:hover:not(:disabled) {
      border-color: var(--marca);
      background: var(--superficie-barra);
    }

    .slot-botao:focus-visible {
      outline: 2px solid var(--foco);
      outline-offset: 2px;
    }

    .slot-botao:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    .slot-botao[aria-pressed='true'],
    .slot-botao.selecionado {
      background: var(--marca);
      border-color: var(--marca);
      color: var(--marca-contraste);
      opacity: 1;
    }

    .slot-botao[aria-pressed='true'] .slot-hora,
    .slot-botao[aria-pressed='true'] .slot-periodo,
    .slot-botao.selecionado .slot-hora,
    .slot-botao.selecionado .slot-periodo {
      color: var(--marca-contraste);
    }

    .slot-botao[aria-pressed='true']:disabled,
    .slot-botao.selecionado:disabled {
      cursor: default;
      opacity: 1;
    }

    .slot-hora {
      font-size: 17px;
      font-weight: 600;
      letter-spacing: -0.01em;
      line-height: 1.1;
      color: var(--texto-primario);
    }

    .slot-periodo {
      font-size: 11px;
      line-height: 1;
      color: var(--texto-secundario);
    }

    .rodape {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      padding: 0 14px;
      border-top: 1px solid var(--borda-divisor-card);
      box-sizing: border-box;
    }

    .link-recolher {
      font-family: inherit;
      font-size: 13px;
      color: var(--texto-secundario);
      background: none;
      border: none;
      text-decoration: underline;
      min-height: 44px;
      padding: 0;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
    }

    .link-recolher:focus-visible {
      outline: 2px solid var(--foco);
      outline-offset: 2px;
    }

    .link-recolher:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    .faixa-recolhida {
      background: var(--superficie-elevada);
      border: 1px solid var(--borda-componente);
      border-radius: var(--raio-card);
      overflow: hidden;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      padding: 0 6px 0 14px;
      box-sizing: border-box;
    }

    .faixa-texto {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--texto-secundario);
      min-width: 0;
      word-break: break-word;
    }

    .icone-calendario {
      flex: none;
    }

    .link-reabrir {
      font-family: inherit;
      font-size: 13px;
      color: var(--marca);
      background: none;
      border: none;
      text-decoration: underline;
      min-height: 44px;
      padding: 0 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
    }

    .link-reabrir:focus-visible {
      outline: 2px solid var(--foco);
      outline-offset: 2px;
    }

    .link-reabrir:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    .aviso-vazio-neutro {
      padding: 12px 14px;
      font-size: 14px;
      line-height: 1.4;
      color: var(--neutro);
      text-align: center;
      box-sizing: border-box;
    }

    .aviso-vazio-atencao {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      padding: 12px 14px;
      background: var(--inativo-fundo);
      color: var(--atencao);
      font-size: 13px;
      line-height: 1.4;
      border-radius: var(--raio-card);
      box-sizing: border-box;
    }
  `,
})
export class CartaoAgendamento {
  readonly corretor = input.required<string>();
  readonly grupos = input.required<GrupoDeHorarios[]>();
  readonly recolhido = input<boolean>(false);
  readonly podeSelecionar = input<boolean>(true);
  readonly enviando = input<boolean>(false);
  readonly sincronizacaoPendente = input<boolean>(false);
  readonly horarioPerdido = input<SlotOferecido | null>(null);
  readonly confirmado = input<boolean>(false);

  readonly selecionar = output<number>();
  readonly recolher = output<void>();
  readonly reabrir = output<void>();

  readonly temHorarios = computed(() => {
    const gs = this.grupos();
    if (!Array.isArray(gs) || gs.length === 0) {
      return false;
    }
    return gs.some((g) => Array.isArray(g.horarios) && g.horarios.length > 0);
  });

  readonly horaPerdida = computed(() => {
    const hp = this.horarioPerdido();
    return hp ? horaDoAgendamento(hp.inicio) : '';
  });

  readonly diaPerdido = computed(() => {
    const hp = this.horarioPerdido();
    return hp ? diaDaSemanaDoAgendamento(hp.inicio).toLowerCase() : '';
  });

  readonly nomeCorretor = computed(() => {
    return (this.corretor() ?? '').trim().replace(/\s+/g, ' ');
  });

  readonly iniciais = computed(() => {
    const limpo = this.nomeCorretor();
    if (!limpo) {
      return '';
    }
    const termos = limpo.split(' ').filter(Boolean);
    if (termos.length === 1) {
      return termos[0].charAt(0).toUpperCase();
    }
    const primeiro = termos[0].charAt(0).toUpperCase();
    const ultimo = termos[termos.length - 1].charAt(0).toUpperCase();
    return `${primeiro}${ultimo}`;
  });

  readonly slotDesabilitado = computed(() => {
    return !this.podeSelecionar() || this.enviando() || this.sincronizacaoPendente();
  });

  readonly recolherDesabilitado = computed(() => {
    return this.enviando() || this.sincronizacaoPendente();
  });

  readonly reabrirDesabilitado = computed(() => {
    return this.enviando() || this.sincronizacaoPendente();
  });

  formatarHora(inicio: string): string {
    return horaDoAgendamento(inicio);
  }

  formatarPeriodo(inicio: string): string {
    return periodoDoAgendamento(inicio);
  }

  labelDoSlot(slot: SlotOferecido, rotuloGrupo: string): string {
    const dia = rotuloGrupo || diaExtensoDoAgendamento(slot.inicio);
    const hora = horaDoAgendamento(slot.inicio);
    return `${dia}, às ${hora}, duração de 1 hora, horário de Brasília`;
  }

  aoSelecionar(slotId: number): void {
    if (this.confirmado() || this.slotDesabilitado()) {
      return;
    }
    this.selecionar.emit(slotId);
  }

  aoRecolher(): void {
    if (this.confirmado() || this.recolherDesabilitado()) {
      return;
    }
    this.recolher.emit();
  }

  aoReabrir(): void {
    if (this.confirmado() || this.reabrirDesabilitado()) {
      return;
    }
    this.reabrir.emit();
  }
}
