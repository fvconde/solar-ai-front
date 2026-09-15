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
import { ActivatedRoute, Router } from '@angular/router';
import { SessaoStore } from '../sessao/sessao-store';
import { EntrarApi } from './entrar-api';
import {
  MINIMO_CARACTERES_SENHA,
  SEGUNDOS_DE_BLOQUEIO,
  TelaEntrar,
  TENTATIVAS_ATE_BLOQUEIO,
} from './entrar-contrato';

const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-entrar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './entrar.html',
  styleUrl: './entrar.scss',
})
export class Entrar implements OnInit {
  private readonly api = inject(EntrarApi);
  private readonly sessao = inject(SessaoStore);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private token = '';
  private cronometro: ReturnType<typeof setInterval> | null = null;

  readonly tela = signal<TelaEntrar>('email');
  readonly email = signal('');
  readonly senha = signal('');
  readonly novaSenha = signal('');
  readonly confirmacaoSenha = signal('');

  readonly enviando = signal(false);
  readonly erroEmail = signal<string | null>(null);
  readonly erroSenha = signal<string | null>(null);
  readonly erroNovaSenha = signal<string | null>(null);

  readonly tentativasRestantes = signal<number | null>(null);
  readonly segundosBloqueado = signal(0);
  readonly segundosDeBloqueio = SEGUNDOS_DE_BLOQUEIO;

  readonly bloqueado = computed(() => this.segundosBloqueado() > 0);

  readonly contagemRegressiva = computed(() => {
    const total = this.segundosBloqueado();
    const minutos = Math.floor(total / 60);
    const segundos = total % 60;
    return `${minutos}:${String(segundos).padStart(2, '0')}`;
  });

  readonly confirmacaoDivergente = computed(
    () => this.confirmacaoSenha().length > 0 && this.novaSenha() !== this.confirmacaoSenha()
  );

  readonly podeSalvarSenha = computed(
    () =>
      this.novaSenha().length >= MINIMO_CARACTERES_SENHA &&
      this.novaSenha() === this.confirmacaoSenha()
  );

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.pararCronometro());

    const token = this.rota.snapshot.queryParamMap.get('token');
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

  continuarComEmail(): void {
    const email = this.email().trim();
    if (!FORMATO_EMAIL.test(email)) {
      this.erroEmail.set('Verifique o formato do e-mail.');
      return;
    }

    this.email.set(email);
    this.erroEmail.set(null);
    this.enviando.set(true);

    this.api.identificar(email).subscribe({
      next: (resposta) => {
        this.enviando.set(false);
        this.tela.set(resposta.cadastrado ? 'senha' : 'nao-encontrado');
      },
      error: (erro) => {
        this.enviando.set(false);
        this.erroEmail.set(
          erro?.status === 400
            ? 'Verifique o formato do e-mail.'
            : 'Não foi possível continuar. Tente novamente.'
        );
      },
    });
  }

  trocarEmail(): void {
    this.pararCronometro();
    this.senha.set('');
    this.erroSenha.set(null);
    this.erroEmail.set(null);
    this.tentativasRestantes.set(null);
    this.segundosBloqueado.set(0);
    this.tela.set('email');
  }

  entrar(): void {
    if (this.bloqueado() || !this.senha()) {
      return;
    }

    this.enviando.set(true);
    this.erroSenha.set(null);

    this.api.criarSessao(this.email(), this.senha()).subscribe({
      next: (resposta) => {
        this.enviando.set(false);
        this.tentativasRestantes.set(null);
        this.sessao.definir(resposta.corretor);
        this.router.navigate(['/painel']);
      },
      error: (erro) => {
        this.enviando.set(false);
        this.senha.set('');

        if (erro?.status === 423) {
          this.iniciarBloqueio(erro?.error?.bloqueadoPorSegundos ?? SEGUNDOS_DE_BLOQUEIO);
          return;
        }

        if (erro?.status === 401) {
          const restantes = erro?.error?.tentativasRestantes ?? null;
          this.tentativasRestantes.set(restantes);
          this.erroSenha.set(
            restantes !== null && restantes < TENTATIVAS_ATE_BLOQUEIO - 1
              ? `Senha incorreta. Restam ${restantes} tentativas antes do bloqueio temporário.`
              : 'Senha incorreta.'
          );
          return;
        }

        this.erroSenha.set('Não foi possível entrar. Tente novamente.');
      },
    });
  }

  irParaRecuperacao(): void {
    this.pararCronometro();
    this.segundosBloqueado.set(0);
    this.erroSenha.set(null);
    this.tela.set('recuperar');
  }

  voltarParaLogin(): void {
    this.tela.set('senha');
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
        this.sessao.definir(resposta.corretor);
        this.router.navigate(['/painel']);
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
            : 'Não foi possível salvar a nova senha. Tente novamente.'
        );
      },
    });
  }

  private iniciarBloqueio(segundos: number): void {
    this.pararCronometro();
    this.tentativasRestantes.set(null);
    this.segundosBloqueado.set(segundos);
    this.erroSenha.set(
      `Muitas tentativas incorretas. Formulário bloqueado por ${segundos} segundos.`
    );

    this.cronometro = setInterval(() => {
      const restante = this.segundosBloqueado() - 1;
      this.segundosBloqueado.set(Math.max(restante, 0));

      if (restante <= 0) {
        this.pararCronometro();
        this.erroSenha.set(null);
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
