import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { ContatoRequest, LIMITE_EMAIL, LIMITE_NOME, LIMITE_TELEFONE } from '../conversa/contrato';

@Component({
  selector: 'app-formulario-contato',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="contato">
      <div class="cabeca">
        <span class="marca-estado"></span>
        <span class="rotulo">Como falar com você</span>
      </div>

      <p class="texto">
        Deixe um telefone ou e-mail para o corretor retomar de onde vocês pararam. Esses dados vão
        direto para a Solar e não são enviados à inteligência artificial.
      </p>

      <label class="campo">
        <span>Nome</span>
        <input
          type="text"
          autocomplete="name"
          [attr.maxlength]="limiteNome"
          [value]="nome()"
          [disabled]="enviando()"
          (input)="aoDigitarNome($event)"
        />
      </label>

      <label class="campo">
        <span>Telefone</span>
        <input
          type="tel"
          autocomplete="tel"
          inputmode="tel"
          placeholder="(11) 99999-8888"
          [attr.maxlength]="limiteTelefone"
          [value]="telefone()"
          [disabled]="enviando()"
          (input)="aoDigitarTelefone($event)"
        />
      </label>

      <label class="campo">
        <span>E-mail</span>
        <input
          type="email"
          autocomplete="email"
          [attr.maxlength]="limiteEmail"
          [value]="email()"
          [disabled]="enviando()"
          (input)="aoDigitarEmail($event)"
        />
      </label>

      @if (erro()) {
        <p class="erro">{{ erro() }}</p>
      }

      <button type="button" class="acao" [disabled]="!podeEnviar()" (click)="confirmar()">
        {{ enviando() ? 'Enviando…' : 'Enviar contato' }}
      </button>
    </section>
  `,
  styles: `
    .contato {
      display: flex;
      flex-direction: column;
      max-width: 560px;
      gap: 12px;
      padding: 22px 24px;
      background: var(--superficie-barra);
      border: 1px solid var(--borda-estrutura);
      border-radius: var(--raio-card);
    }

    .cabeca {
      display: flex;
      align-items: center;
      gap: 9px;
    }

    .marca-estado {
      width: 8px;
      height: 8px;
      border-radius: var(--raio-marca-estado);
      background: var(--atencao);
    }

    .rotulo {
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--texto-secundario);
    }

    .texto {
      font-size: 15.5px;
      line-height: 1.55;
      color: var(--texto-primario);
    }

    .campo {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13.5px;
      color: var(--texto-secundario);
    }

    .campo input {
      min-height: 44px;
      padding: 0 14px;
      border-radius: var(--raio-acao-evento);
      border: 1px solid var(--borda-componente);
      background: var(--superficie-elevada);
      color: var(--texto-primario);
      font-size: 15.5px;
    }

    .erro {
      font-size: 14px;
      color: var(--erro);
    }

    .acao {
      align-self: flex-start;
      margin-top: 4px;
      min-height: 44px;
      padding: 0 20px;
      border-radius: var(--raio-acao-evento);
      border: 1px solid var(--borda-componente);
      background: var(--superficie-elevada);
      color: var(--texto-primario);
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
    }

    .acao[disabled] {
      opacity: 0.5;
      cursor: default;
    }
  `,
})
export class FormularioContato {
  readonly erro = input<string | null>(null);
  readonly enviando = input(false);
  readonly dadosIniciais = input<ContatoRequest | null>(null);
  readonly contexto = input<string>('');
  readonly enviar = output<ContatoRequest>();

  protected readonly limiteNome = LIMITE_NOME;
  protected readonly limiteTelefone = LIMITE_TELEFONE;
  protected readonly limiteEmail = LIMITE_EMAIL;

  protected readonly nome = signal('');
  protected readonly telefone = signal('');
  protected readonly email = signal('');

  private ultimoContexto: string | null = null;
  private nomeEditado = false;
  private telefoneEditado = false;
  private emailEditado = false;

  constructor() {
    effect(() => {
      const contextoAtual = this.contexto();
      const dados = this.dadosIniciais();

      untracked(() => {
        const contextoMudou = contextoAtual !== this.ultimoContexto;
        if (contextoMudou) {
          this.ultimoContexto = contextoAtual;
          this.nomeEditado = false;
          this.telefoneEditado = false;
          this.emailEditado = false;
          this.nome.set(dados?.nome ?? '');
          this.telefone.set(dados?.telefone ?? '');
          this.email.set(dados?.email ?? '');
        } else if (dados) {
          if (!this.nomeEditado) {
            this.nome.set(dados.nome ?? '');
          }
          if (!this.telefoneEditado) {
            this.telefone.set(dados.telefone ?? '');
          }
          if (!this.emailEditado) {
            this.email.set(dados.email ?? '');
          }
        }
      });
    });
  }

  protected readonly podeEnviar = computed(
    () => !this.enviando() && (this.telefone().trim().length > 0 || this.email().trim().length > 0),
  );

  protected valor(evento: Event): string {
    return (evento.target as HTMLInputElement).value;
  }

  protected aoDigitarNome(evento: Event): void {
    this.nomeEditado = true;
    this.nome.set(this.valor(evento));
  }

  protected aoDigitarTelefone(evento: Event): void {
    this.telefoneEditado = true;
    this.telefone.set(this.valor(evento));
  }

  protected aoDigitarEmail(evento: Event): void {
    this.emailEditado = true;
    this.email.set(this.valor(evento));
  }

  protected confirmar(): void {
    if (!this.podeEnviar()) {
      return;
    }

    this.enviar.emit({
      nome: this.nome().trim() || null,
      telefone: this.telefone().trim() || null,
      email: this.email().trim() || null,
    });
  }
}
