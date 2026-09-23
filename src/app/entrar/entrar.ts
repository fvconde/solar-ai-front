import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ConversaStore } from '../conversa/conversa-store';
import { SessaoStore } from '../sessao/sessao-store';
import { EntrarApi } from './entrar-api';
import {
  destinoDe,
  FORMATO_EMAIL,
  MINIMO_CARACTERES_SENHA,
  SEGUNDOS_DE_BLOQUEIO,
  TelaEntrar,
} from './entrar-contrato';

@Component({
  selector: 'app-entrar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  templateUrl: './entrar.html',
  styleUrl: './entrar.scss',
})
export class Entrar implements OnInit {
  private readonly api = inject(EntrarApi);
  private readonly sessao = inject(SessaoStore);
  private readonly conversa = inject(ConversaStore);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private token = '';
  private cronometro: ReturnType<typeof setInterval> | null = null;

  readonly tela = signal<TelaEntrar>('entrar');
  readonly email = signal('');
  readonly senha = signal('');
  readonly senhaVisivel = signal(false);
  readonly novaSenha = signal('');
  readonly confirmacaoSenha = signal('');

  readonly enviando = signal(false);
  readonly erroEntrar = signal<string | null>(null);
  readonly erroEmail = signal<string | null>(null);
  readonly erroNovaSenha = signal<string | null>(null);
  readonly conversaSemDono = signal(false);

  readonly segundosBloqueado = signal(0);
  readonly bloqueado = computed(() => this.segundosBloqueado() > 0);

  readonly contagemRegressiva = computed(() => {
    const total = this.segundosBloqueado();
    const minutos = Math.floor(total / 60);
    const segundos = total % 60;
    return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
  });

  readonly podeEntrar = computed(
    () => !!this.email().trim() && !!this.senha() && !this.bloqueado() && !this.enviando(),
  );

  readonly confirmacaoDivergente = computed(
    () => this.confirmacaoSenha().length > 0 && this.novaSenha() !== this.confirmacaoSenha(),
  );

  readonly podeSalvarSenha = computed(
    () =>
      this.novaSenha().length >= MINIMO_CARACTERES_SENHA &&
      this.novaSenha() === this.confirmacaoSenha(),
  );

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.pararCronometro());
    this.conversaSemDono.set(!this.sessao.ativa() && !!this.conversa.conversaGuardada());

    const parametros = this.rota.snapshot.queryParamMap;
    if (parametros.has('redefinir')) {
      this.tela.set('recuperar');
    }

    const token = parametros.get('token');
    if (!token) {
      return;
    }

    this.token = token;
    this.enviando.set(true);
    this.api.validarRecuperacao(token).subscribe({
      next: (resposta) => {
        this.enviando.set(false);
        this.email.set(resposta.email);
        this.tela.set('nova-senha');
      },
      error: () => {
        this.enviando.set(false);
        this.tela.set('link-invalido');
      },
    });
  }

  entrar(): void {
    if (!this.podeEntrar()) {
      return;
    }

    this.enviando.set(true);
    this.erroEntrar.set(null);
    const conversaId = this.conversaSemDono() ? this.conversa.conversaGuardada() : null;

    this.api.criarSessao(this.email().trim(), this.senha(), conversaId).subscribe({
      next: (resposta) => {
        this.enviando.set(false);
        this.sessao.definir(resposta);
        void this.router.navigate(destinoDe(resposta));
      },
      error: (erro) => {
        this.enviando.set(false);
        this.senha.set('');

        if (erro?.status === 423) {
          this.iniciarBloqueio(erro?.error?.segundosRestantes ?? SEGUNDOS_DE_BLOQUEIO);
          return;
        }

        if (erro?.status === 401) {
          this.erroEntrar.set('E-mail ou senha incorretos. Confira e tente de novo.');
          return;
        }

        if (erro?.status === 429) {
          this.erroEntrar.set('Muitos pedidos seguidos. Aguarde um instante e tente de novo.');
          return;
        }

        this.erroEntrar.set('Não foi possível entrar. Tente novamente.');
      },
    });
  }

  alternarSenhaVisivel(): void {
    this.senhaVisivel.update((visivel) => !visivel);
  }

  irParaRecuperacao(): void {
    this.pararCronometro();
    this.segundosBloqueado.set(0);
    this.erroEntrar.set(null);
    this.erroEmail.set(null);
    this.tela.set('recuperar');
  }

  voltarParaLogin(): void {
    this.erroEmail.set(null);
    this.tela.set('entrar');
  }

  enviarLink(): void {
    const email = this.email().trim();
    if (!FORMATO_EMAIL.test(email)) {
      this.erroEmail.set('Verifique o formato do e-mail.');
      return;
    }

    this.erroEmail.set(null);
    this.enviando.set(true);

    this.api.pedirRecuperacao(email).subscribe({
      next: () => {
        this.enviando.set(false);
        this.tela.set('link-enviado');
      },
      error: (erro) => {
        this.enviando.set(false);

        if (erro?.status === 429) {
          this.erroEmail.set('Muitos pedidos seguidos. Aguarde um instante e tente de novo.');
          return;
        }

        this.tela.set('link-enviado');
      },
    });
  }

  reenviarLink(): void {
    this.enviando.set(true);
    this.api.pedirRecuperacao(this.email()).subscribe({
      next: () => this.enviando.set(false),
      error: () => this.enviando.set(false),
    });
  }

  pedirNovoLink(): void {
    this.token = '';
    this.email.set('');
    this.novaSenha.set('');
    this.confirmacaoSenha.set('');
    this.erroNovaSenha.set(null);
    this.tela.set('recuperar');
  }

  salvarSenha(): void {
    if (!this.podeSalvarSenha()) {
      return;
    }

    this.enviando.set(true);
    this.erroNovaSenha.set(null);

    this.api.salvarSenha(this.token, this.novaSenha()).subscribe({
      next: (resposta) => {
        this.enviando.set(false);
        this.sessao.definir(resposta);
        void this.router.navigate(destinoDe(resposta));
      },
      error: (erro) => {
        this.enviando.set(false);

        if (erro?.status === 410) {
          this.tela.set('link-invalido');
          return;
        }

        this.erroNovaSenha.set(
          erro?.status === 400
            ? `A senha precisa ter no mínimo ${MINIMO_CARACTERES_SENHA} caracteres.`
            : 'Não foi possível salvar a nova senha. Tente novamente.',
        );
      },
    });
  }

  private iniciarBloqueio(segundos: number): void {
    this.pararCronometro();
    this.erroEntrar.set(null);
    this.segundosBloqueado.set(segundos);

    this.cronometro = setInterval(() => {
      const restante = this.segundosBloqueado() - 1;
      this.segundosBloqueado.set(Math.max(restante, 0));

      if (restante <= 0) {
        this.pararCronometro();
      }
    }, 1000);
  }

  private pararCronometro(): void {
    if (this.cronometro !== null) {
      clearInterval(this.cronometro);
      this.cronometro = null;
    }
  }
}
