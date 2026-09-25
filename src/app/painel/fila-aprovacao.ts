import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
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
    <section class="fila-aprovacao" aria-label="Novos corretores" [attr.aria-busy]="carregando()">
      @if (carregando()) {
        <p class="carregando" role="status">Carregando novos corretores...</p>
      } @else if (pendentes().length > 0) {
        <div class="layout" [class.detalhe-aberto]="detalheMobile()">
          @if (aviso()) {
            <p class="aviso-ok" role="status">{{ aviso() }}</p>
          }
          @if (erro()) {
            <p class="erro" role="alert">{{ erro() }}</p>
          }

          <aside class="lista" aria-label="Corretores pendentes">
            <p class="cabecalho-lista">
              Pendentes · <strong>{{ pendentes().length }}</strong>
            </p>
            <ul class="lista-pendentes">
              @for (pendente of pendentes(); track pendente.id) {
                <li class="linha" [class.selecionada]="selecionadoId() === pendente.id">
                  <button
                    type="button"
                    class="selecao-pendente"
                    [attr.aria-pressed]="selecionadoId() === pendente.id"
                    [attr.aria-label]="
                      'Selecionar ' + pendente.nome + ', ' + atuacao(pendente) + ', ' + espera(pendente.criadoEm)
                    "
                    (click)="selecionar(pendente)"
                  >
                    <span class="avatar-pequeno" aria-hidden="true">{{ iniciais(pendente.nome) }}</span>
                    <span class="dados-pessoa">
                      <span class="nome">{{ pendente.nome }}</span>
                      <span class="atuacao-lista">{{ atuacao(pendente) }}</span>
                    </span>
                    <span class="tempo-lista">{{ espera(pendente.criadoEm) }}</span>
                  </button>
                </li>
              }
            </ul>
          </aside>

          @if (selecionado(); as pendente) {
            <section class="detalhe" [class.recusando]="recusando() === pendente.id" aria-labelledby="titulo-corretor-selecionado">
              <button type="button" class="voltar-mobile" (click)="voltarParaLista()">
                <span aria-hidden="true">←</span> Novos corretores
              </button>

              <div class="conteudo-detalhe">
                <header class="cabecalho-detalhe">
                  <span class="avatar-grande" aria-hidden="true">{{ iniciais(pendente.nome) }}</span>
                  <div class="identidade">
                    <h2 class="nome-detalhe" id="titulo-corretor-selecionado">{{ pendente.nome }}</h2>
                    <div class="estado-espera">
                      <span class="estado">EM ANÁLISE</span>
                      <span>Aguardando {{ espera(pendente.criadoEm) }}</span>
                    </div>
                  </div>
                </header>

                <div class="blocos-dados">
                  <section class="bloco-dado" aria-labelledby="rotulo-contato">
                    <h3 class="rotulo-dado" id="rotulo-contato">Contato</h3>
                    <p class="valor-dado">{{ pendente.email || 'E-mail não informado' }}</p>
                    <p class="valor-dado secundario">{{ telefone(pendente.telefone) }}</p>
                  </section>
                  <section class="bloco-dado" aria-labelledby="rotulo-atuacao">
                    <h3 class="rotulo-dado" id="rotulo-atuacao">Atuação</h3>
                    <p class="valor-dado">Região: {{ regioes(pendente) }}</p>
                    <p class="valor-dado secundario">
                      Especialidade: {{ especialidades(pendente) }}
                    </p>
                  </section>
                </div>

                @if (recusando() === pendente.id) {
                  <div class="formulario-recusa">
                    <label class="rotulo" [for]="'motivo-' + pendente.id">
                      Motivo · opcional, vai no e-mail
                    </label>
                    <textarea
                      class="motivo"
                      [id]="'motivo-' + pendente.id"
                      [name]="'motivo-' + pendente.id"
                      [maxlength]="limiteMotivo"
                      [disabled]="enviando()"
                      [ngModel]="motivo()"
                      (ngModelChange)="motivo.set($event)"
                    ></textarea>
                  </div>
                }
              </div>

              <footer class="acoes">
                @if (recusando() === pendente.id) {
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
                } @else {
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
                }
              </footer>
            </section>
          }
        </div>
      } @else {
        <div class="sem-pendentes">
          @if (aviso()) {
            <p class="aviso-ok" role="status">{{ aviso() }}</p>
          }
          @if (erro()) {
            <p class="erro" role="alert">{{ erro() }}</p>
          }
          <p>Nenhum corretor pendente no momento.</p>
        </div>
      }
    </section>
  `,
  styleUrl: './fila-aprovacao.scss',
})
export class FilaAprovacao implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly api = inject(PainelApi);
  private readonly sessao = inject(SessaoStore);
  private readonly router = inject(Router);

  readonly limiteMotivo = LIMITE_MOTIVO;
  readonly carregando = signal(true);
  readonly pendentes = signal<CorretorPendente[]>([]);
  readonly selecionadoId = signal<string | null>(null);
  readonly selecionado = computed(
    () => this.pendentes().find((pendente) => pendente.id === this.selecionadoId()) ?? null,
  );
  readonly detalheMobile = signal(false);
  readonly recusando = signal<string | null>(null);
  readonly motivo = signal('');
  readonly enviando = signal(false);
  readonly aviso = signal<string | null>(null);
  readonly erro = signal<string | null>(null);

  ngOnInit(): void {
    this.api.listarPendentes().subscribe({
      next: (lista) => {
        this.pendentes.set(lista);
        this.selecionadoId.set(lista[0]?.id ?? null);
        this.sessao.pendentesAprovacao.set(lista.length);
        this.carregando.set(false);
      },
      error: (erro) => {
        this.carregando.set(false);
        this.tratarErro(erro, null);
      },
    });
  }

  selecionar(pendente: CorretorPendente): void {
    this.selecionadoId.set(pendente.id);
    this.detalheMobile.set(true);
    this.focarNoCelular('.voltar-mobile');
  }

  voltarParaLista(): void {
    this.detalheMobile.set(false);
    this.focarNoCelular('.selecao-pendente[aria-pressed="true"]');
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
    return digitos ? formatarTelefone(digitos) : 'Telefone não informado';
  }

  atuacao(pendente: CorretorPendente): string {
    const regioes = pendente.regioes.map(rotuloDe).join(', ');
    const especialidades = pendente.especialidades.map(rotuloDe).join(', ');
    return `${regioes || 'Região não informada'} · ${especialidades || 'Especialidade não informada'}`;
  }

  regioes(pendente: CorretorPendente): string {
    return pendente.regioes.map(rotuloDe).join(', ') || 'não informada';
  }

  especialidades(pendente: CorretorPendente): string {
    return pendente.especialidades.map(rotuloDe).join(', ') || 'não informada';
  }

  iniciais(nome: string): string {
    const partes = nome
      .trim()
      .split(/\s+/)
      .filter((parte) => !['de', 'da', 'do', 'das', 'dos', 'e'].includes(parte.toLowerCase()));
    return partes
      .slice(0, 2)
      .map((parte) => parte.charAt(0))
      .join('')
      .toUpperCase();
  }

  espera(criadoEm: string): string {
    return haQuanto(criadoEm);
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
    const removendoSelecionado = this.selecionadoId() === pendente.id;
    this.pendentes.update((lista) => lista.filter((item) => item.id !== pendente.id));
    if (removendoSelecionado) {
      const proximo = this.pendentes()[0] ?? null;
      this.selecionadoId.set(proximo?.id ?? null);
      if (!proximo) this.detalheMobile.set(false);
    }
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

  private focarNoCelular(seletor: string): void {
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 640px)').matches) return;
    window.requestAnimationFrame(() => {
      this.host.nativeElement.querySelector<HTMLElement>(seletor)?.focus();
    });
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
