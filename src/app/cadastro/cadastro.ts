import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Avisos } from '../componentes/aviso-flutuante';
import { ContaApi } from '../conta/conta-api';
import { Especialidade, ESPECIALIDADES, Regiao, REGIOES } from '../conta/conta-contrato';
import { ConversaStore } from '../conversa/conversa-store';
import { FORMATO_EMAIL, MINIMO_CARACTERES_SENHA } from '../entrar/entrar-contrato';
import { SessaoResponse } from '../sessao/sessao-contrato';
import { SessaoStore } from '../sessao/sessao-store';
import { mascararTelefone, mensagemDoCampo, validarNome, validarTelefone } from './validacao';

type Campo =
  | 'nome'
  | 'email'
  | 'telefone'
  | 'senha'
  | 'confirmacao'
  | 'regioes'
  | 'especialidades'
  | 'aceitePrivacidade';

@Component({
  selector: 'app-cadastro',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgTemplateOutlet, RouterLink],
  templateUrl: './cadastro.html',
  styleUrl: './cadastro.scss',
})
export class Cadastro {
  private readonly api = inject(ContaApi);
  private readonly sessao = inject(SessaoStore);
  private readonly conversa = inject(ConversaStore);
  private readonly avisos = inject(Avisos);
  private readonly router = inject(Router);

  readonly corretor = inject(ActivatedRoute).snapshot.data['tipo'] === 'corretor';
  readonly regioesDisponiveis = REGIOES;
  readonly especialidadesDisponiveis = ESPECIALIDADES;

  readonly nome = signal('');
  readonly email = signal('');
  readonly telefone = signal('');
  readonly senha = signal('');
  readonly confirmacao = signal('');
  readonly regioes = signal<Regiao[]>([]);
  readonly especialidades = signal<Especialidade[]>([]);
  readonly aceite = signal(false);

  readonly enviando = signal(false);
  readonly falhaRede = signal(false);
  readonly emailEmUso = signal(false);
  private readonly tocados = signal<ReadonlySet<Campo>>(new Set());
  private readonly errosServidor = signal<Partial<Record<Campo, string>>>({});

  private readonly errosLocais = computed<Partial<Record<Campo, string>>>(() => {
    const email = this.email().trim();
    return {
      nome: validarNome(this.nome()),
      email: !email
        ? 'Informe seu e-mail.'
        : FORMATO_EMAIL.test(email)
          ? undefined
          : 'Verifique o formato do e-mail.',
      telefone: validarTelefone(this.telefone()),
      senha:
        this.senha().length < MINIMO_CARACTERES_SENHA
          ? `Use ao menos ${MINIMO_CARACTERES_SENHA} caracteres.`
          : undefined,
      confirmacao:
        this.confirmacao() !== this.senha() || !this.confirmacao()
          ? 'As senhas não coincidem.'
          : undefined,
      regioes:
        this.corretor && this.regioes().length === 0 ? 'Escolha ao menos uma região.' : undefined,
      especialidades:
        this.corretor && this.especialidades().length === 0
          ? 'Escolha ao menos uma especialidade.'
          : undefined,
    };
  });

  readonly podeEnviar = computed(
    () =>
      this.aceite() &&
      !this.enviando() &&
      !this.emailEmUso() &&
      Object.values(this.errosLocais()).every((erro) => !erro),
  );

  readonly senhasCoincidem = computed(
    () =>
      !!this.confirmacao() &&
      this.confirmacao() === this.senha() &&
      this.senha().length >= MINIMO_CARACTERES_SENHA,
  );

  erro(campo: Campo): string | undefined {
    const servidor = this.errosServidor()[campo];
    if (servidor) {
      return servidor;
    }
    const mostrar =
      this.tocados().has(campo) ||
      ((campo === 'regioes' || campo === 'especialidades') && this.aceite());
    return mostrar ? this.errosLocais()[campo] : undefined;
  }

  tocar(campo: Campo): void {
    if (campo === 'confirmacao' && !this.confirmacao()) {
      return;
    }
    this.tocados.update((atual) => new Set(atual).add(campo));
  }

  alterar(campo: Campo, valor: string): void {
    const destino = {
      nome: this.nome,
      email: this.email,
      telefone: this.telefone,
      senha: this.senha,
      confirmacao: this.confirmacao,
    }[campo as 'nome'];
    destino.set(campo === 'telefone' ? mascararTelefone(valor) : valor);
    this.limparErroServidor(campo);
    if (campo === 'email') {
      this.emailEmUso.set(false);
    }
  }

  alternarRegiao(valor: Regiao): void {
    this.regioes.update((atual) => alternar(atual, valor));
    this.tocar('regioes');
    this.limparErroServidor('regioes');
  }

  alternarEspecialidade(valor: Especialidade): void {
    this.especialidades.update((atual) => alternar(atual, valor));
    this.tocar('especialidades');
    this.limparErroServidor('especialidades');
  }

  enviar(): void {
    if (!this.podeEnviar()) {
      return;
    }

    this.enviando.set(true);
    this.falhaRede.set(false);

    const base = {
      nome: this.nome().trim(),
      email: this.email().trim(),
      telefone: this.telefone().replace(/\D/g, ''),
      senha: this.senha(),
      aceitePrivacidade: true as const,
    };
    const conversaId = this.corretor ? null : this.conversa.conversaGuardada();

    const pedido = this.corretor
      ? this.api.cadastrarCorretor({
          ...base,
          regioes: this.regioes(),
          especialidades: this.especialidades(),
        })
      : this.api.cadastrarCliente(conversaId ? { ...base, conversaId } : base);

    pedido.subscribe({
      next: (resposta) => this.concluir(resposta, !!conversaId),
      error: (erro) => {
        this.enviando.set(false);

        if (erro?.status === 409) {
          this.emailEmUso.set(true);
          return;
        }

        if (erro?.status === 400 && erro?.error?.campos) {
          const campos = erro.error.campos as Record<string, string>;
          this.errosServidor.set(
            Object.fromEntries(
              Object.entries(campos).map(([campo, codigo]) => [
                campo,
                mensagemDoCampo(campo, codigo),
              ]),
            ),
          );
          return;
        }

        this.falhaRede.set(true);
      },
    });
  }

  private concluir(resposta: SessaoResponse, levouConversa: boolean): void {
    this.enviando.set(false);
    this.sessao.definir(resposta);
    this.avisos.mostrar(
      levouConversa
        ? 'Conta criada. Esta conversa já está salva.'
        : 'Conta criada. Você já está dentro.',
    );
    void this.router.navigate(resposta.perfil === 'cliente' ? ['/'] : ['/painel']);
  }

  private limparErroServidor(campo: Campo): void {
    if (this.errosServidor()[campo]) {
      this.errosServidor.update((atual) => ({ ...atual, [campo]: undefined }));
    }
  }
}

function alternar<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((item) => item !== valor) : [...lista, valor];
}
