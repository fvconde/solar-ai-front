import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  mascararTelefone,
  mensagemDoCampo,
  validarNome,
  validarTelefone,
} from '../cadastro/validacao';
import { diaCurto, mesEAno } from '../conversa/horario';
import { FORMATO_EMAIL, MINIMO_CARACTERES_SENHA } from '../entrar/entrar-contrato';
import { Saida } from '../sessao/saida';
import { iniciaisDe, SessaoStore } from '../sessao/sessao-store';
import { ContaApi } from './conta-api';
import {
  ContaResponse,
  EdicaoContaRequest,
  Especialidade,
  ESPECIALIDADES,
  formatarTelefone,
  Regiao,
  REGIOES,
  rotuloDe,
} from './conta-contrato';

type Bloco = 'dados' | 'senha' | 'atuacao' | 'excluir';

@Component({
  selector: 'app-conta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgTemplateOutlet, RouterLink],
  templateUrl: './conta.html',
  styleUrl: './conta.scss',
})
export class Conta implements OnInit {
  private readonly api = inject(ContaApi);
  private readonly sessao = inject(SessaoStore);
  private readonly saida = inject(Saida);
  private readonly router = inject(Router);

  readonly regioesDisponiveis = REGIOES;
  readonly especialidadesDisponiveis = ESPECIALIDADES;

  readonly conta = signal<ContaResponse | null>(null);
  readonly falhaAoCarregar = signal(false);
  readonly aberto = signal<Bloco | null>(null);
  readonly salvando = signal(false);
  readonly confirmacao = signal<string | null>(null);
  readonly erroBloco = signal<string | null>(null);
  readonly errosCampo = signal<Record<string, string>>({});

  readonly nome = signal('');
  readonly email = signal('');
  readonly telefone = signal('');
  readonly senhaAtual = signal('');
  readonly novaSenha = signal('');
  readonly confirmacaoSenha = signal('');
  readonly regioes = signal<Regiao[]>([]);
  readonly especialidades = signal<Especialidade[]>([]);
  readonly emailDigitado = signal('');

  readonly iniciais = computed(() => iniciaisDe(this.conta()?.nome ?? ''));
  readonly corretor = computed(() => this.conta()?.perfil === 'corretor');
  readonly podeExcluir = computed(() => !!this.conta() && this.conta()?.perfil !== 'supervisor');

  readonly papel = computed(() => {
    const conta = this.conta();
    if (!conta) {
      return '';
    }
    if (conta.perfil === 'corretor') {
      if (conta.corretor?.status === 'em_analise') {
        return 'Corretor · em análise';
      }
      const aprovadoEm = conta.corretor?.aprovadoEm;
      return aprovadoEm ? `Corretor · aprovado em ${diaCurto(aprovadoEm)}` : 'Corretor · aprovado';
    }
    const rotulo = conta.perfil === 'cliente' ? 'Cliente' : 'Supervisor';
    return `${rotulo} · desde ${mesEAno(conta.criadaEm)}`;
  });

  readonly conversasNaExclusao = computed(() => {
    const total = this.conta()?.conversasSalvas ?? 0;
    if (total === 0) {
      return 'sua conta';
    }
    return total === 1
      ? 'sua conta, sua conversa com a Lia'
      : `sua conta, suas ${total} conversas com a Lia`;
  });

  readonly emailConfere = computed(
    () =>
      !!this.conta() &&
      this.emailDigitado().trim().toLowerCase() === this.conta()!.email.trim().toLowerCase(),
  );

  readonly emailMudou = computed(() => this.email().trim() !== (this.conta()?.email ?? ''));

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.falhaAoCarregar.set(false);
    this.api.obter().subscribe({
      next: (conta) => this.conta.set(conta),
      error: (erro) => {
        if (!this.tratarSessaoExpirada(erro)) {
          this.falhaAoCarregar.set(true);
        }
      },
    });
  }

  telefoneFormatado(): string {
    return formatarTelefone(this.conta()?.telefone ?? '');
  }

  lista(valores: string[] | undefined): string {
    return (valores ?? []).map(rotuloDe).join(', ');
  }

  consentimento(): string {
    const c = this.conta()?.consentimento;
    if (!c) {
      return '';
    }
    const data = new Date(c.em);
    return `${diaCurto(c.em)} ${data.getFullYear()} · aviso v. ${c.versao}`;
  }

  abrir(bloco: Bloco): void {
    const conta = this.conta();
    if (!conta) {
      return;
    }
    this.limparMensagens();
    this.nome.set(conta.nome);
    this.email.set(conta.email);
    this.telefone.set(mascararTelefone(conta.telefone));
    this.senhaAtual.set('');
    this.novaSenha.set('');
    this.confirmacaoSenha.set('');
    this.emailDigitado.set('');
    this.regioes.set((conta.corretor?.regioes ?? []) as Regiao[]);
    this.especialidades.set((conta.corretor?.especialidades ?? []) as Especialidade[]);
    this.aberto.set(bloco);
  }

  fechar(): void {
    this.aberto.set(null);
    this.erroBloco.set(null);
    this.errosCampo.set({});
  }

  mascarar(valor: string): void {
    this.telefone.set(mascararTelefone(valor));
  }

  alternarRegiao(valor: Regiao): void {
    this.regioes.update((atual) => alternar(atual, valor));
  }

  alternarEspecialidade(valor: Especialidade): void {
    this.especialidades.update((atual) => alternar(atual, valor));
  }

  salvarAberto(): void {
    switch (this.aberto()) {
      case 'dados':
        this.salvarDados();
        return;
      case 'senha':
        this.salvarSenha();
        return;
      case 'atuacao':
        this.salvarAtuacao();
        return;
    }
  }

  salvarDados(): void {
    const conta = this.conta()!;
    const email = this.email().trim();
    const erros = semVazios({
      nome: validarNome(this.nome()),
      telefone: validarTelefone(this.telefone()),
      email: FORMATO_EMAIL.test(email) ? undefined : 'Verifique o formato do e-mail.',
      senhaAtual:
        this.emailMudou() && !this.senhaAtual()
          ? 'Informe a senha atual para trocar o e-mail.'
          : undefined,
    });
    if (erros) {
      this.errosCampo.set(erros);
      return;
    }

    const nome = this.nome().trim();
    const telefone = this.telefone().replace(/\D/g, '');
    const corpo: EdicaoContaRequest = {
      ...(nome !== conta.nome ? { nome } : {}),
      ...(telefone !== conta.telefone ? { telefone } : {}),
      ...(this.emailMudou() ? { email, senhaAtual: this.senhaAtual() } : {}),
    };
    this.editar(corpo, 'Dados atualizados');
  }

  salvarAtuacao(): void {
    const erros = semVazios({
      regioes: this.regioes().length ? undefined : 'Escolha ao menos uma região.',
      especialidades: this.especialidades().length
        ? undefined
        : 'Escolha ao menos uma especialidade.',
    });
    if (erros) {
      this.errosCampo.set(erros);
      return;
    }
    this.editar(
      { regioes: this.regioes(), especialidades: this.especialidades() },
      'Atuação atualizada',
    );
  }

  salvarSenha(): void {
    const erros = semVazios({
      senhaAtual: this.senhaAtual() ? undefined : 'Informe a senha atual.',
      novaSenha:
        this.novaSenha().length < MINIMO_CARACTERES_SENHA
          ? `Use ao menos ${MINIMO_CARACTERES_SENHA} caracteres.`
          : this.novaSenha() !== this.confirmacaoSenha()
            ? 'As senhas não coincidem.'
            : undefined,
    });
    if (erros) {
      this.errosCampo.set(erros);
      return;
    }

    this.iniciar();
    this.api.alterarSenha(this.senhaAtual(), this.novaSenha()).subscribe({
      next: () => this.concluir('Senha alterada'),
      error: (erro) => this.falhar(erro),
    });
  }

  excluir(): void {
    if (!this.emailConfere()) {
      return;
    }
    this.iniciar();
    this.api.excluir(this.emailDigitado().trim()).subscribe({
      next: () => {
        this.salvando.set(false);
        this.saida.contaExcluida();
      },
      error: (erro) => {
        this.salvando.set(false);
        if (this.tratarSessaoExpirada(erro)) {
          return;
        }
        this.erroBloco.set(
          erro?.error?.codigo === 'confirmacao_invalida'
            ? 'O e-mail digitado não confere.'
            : 'Não foi possível excluir a conta agora. Tente de novo.',
        );
      },
    });
  }

  sair(): void {
    this.saida.sair();
  }

  private editar(corpo: EdicaoContaRequest, mensagem: string): void {
    if (Object.keys(corpo).length === 0) {
      this.fechar();
      return;
    }
    this.iniciar();
    this.api.editar(corpo).subscribe({
      next: (conta) => {
        this.conta.set(conta);
        this.sessao.atualizarUsuario({ nome: conta.nome, email: conta.email });
        this.concluir(mensagem);
      },
      error: (erro) => this.falhar(erro),
    });
  }

  private iniciar(): void {
    this.salvando.set(true);
    this.erroBloco.set(null);
    this.errosCampo.set({});
  }

  private concluir(mensagem: string): void {
    this.salvando.set(false);
    this.fechar();
    this.confirmacao.set(mensagem);
  }

  private falhar(erro: {
    status?: number;
    error?: { codigo?: string; campos?: Record<string, string> };
  }): void {
    this.salvando.set(false);
    if (this.tratarSessaoExpirada(erro)) {
      return;
    }

    const codigo = erro?.error?.codigo;
    if (codigo === 'senha_atual_incorreta') {
      this.errosCampo.set({ senhaAtual: 'Senha atual incorreta.' });
    } else if (erro?.status === 409) {
      this.errosCampo.set({ email: 'Este e-mail já tem conta.' });
    } else if (codigo === 'validacao' && erro.error?.campos) {
      this.errosCampo.set(
        Object.fromEntries(
          Object.entries(erro.error.campos).map(([campo, cod]) => [
            campo,
            mensagemDoCampo(campo === 'novaSenha' ? 'senha' : campo, cod),
          ]),
        ),
      );
    } else {
      this.erroBloco.set('Não foi possível salvar agora. Tente de novo.');
    }
  }

  private limparMensagens(): void {
    this.confirmacao.set(null);
    this.erroBloco.set(null);
    this.errosCampo.set({});
  }

  private tratarSessaoExpirada(erro: { status?: number } | null): boolean {
    if (erro?.status !== 401) {
      return false;
    }
    this.sessao.limpar();
    void this.router.navigate(['/entrar']);
    return true;
  }
}

function semVazios(erros: Record<string, string | undefined>): Record<string, string> | null {
  const preenchidos = Object.entries(erros).filter((par): par is [string, string] => !!par[1]);
  return preenchidos.length ? Object.fromEntries(preenchidos) : null;
}

function alternar<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((item) => item !== valor) : [...lista, valor];
}
