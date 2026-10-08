import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SlotOferecido } from '../conversa/contrato';
import { GrupoDeHorarios } from '../conversa/horario';
import { CartaoAgendamento } from './cartao-agendamento';

describe('CartaoAgendamento', () => {
  let fixture: ComponentFixture<CartaoAgendamento>;
  let componente: CartaoAgendamento;

  const slot1: SlotOferecido = {
    id: 101,
    inicio: '2026-10-07T09:00:00-03:00',
    fim: '2026-10-07T10:00:00-03:00',
  };

  const slot2: SlotOferecido = {
    id: 102,
    inicio: '2026-10-07T14:30:00-03:00',
    fim: '2026-10-07T15:30:00-03:00',
  };

  const slot3: SlotOferecido = {
    id: 103,
    inicio: '2026-10-08T19:00:00-03:00',
    fim: '2026-10-08T20:00:00-03:00',
  };

  const gruposDoisDias: GrupoDeHorarios[] = [
    {
      dia: '2026-10-07',
      rotulo: 'Quarta, 7 de outubro',
      horarios: [slot1, slot2],
    },
    {
      dia: '2026-10-08',
      rotulo: 'Quinta, 8 de outubro',
      horarios: [slot3],
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CartaoAgendamento],
    });
    fixture = TestBed.createComponent(CartaoAgendamento);
    componente = fixture.componentInstance;
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-tema');
  });

  it('renderiza oferta em dois dias com titulos, horas, minutos e periodos corretos sem mutar inputs', () => {
    const copiaGrupos = JSON.parse(JSON.stringify(gruposDoisDias));
    fixture.componentRef.setInput('corretor', 'Helena Braga');
    fixture.componentRef.setInput('grupos', gruposDoisDias);
    fixture.detectChanges();

    const titulosDias = fixture.nativeElement.querySelectorAll('.dia-titulo');
    expect(titulosDias.length).toBe(2);
    expect(titulosDias[0].textContent.trim()).toBe('Quarta, 7 de outubro');
    expect(titulosDias[1].textContent.trim()).toBe('Quinta, 8 de outubro');

    const botoes = fixture.nativeElement.querySelectorAll('.slot-botao');
    expect(botoes.length).toBe(3);

    const horas = fixture.nativeElement.querySelectorAll('.slot-hora');
    expect(horas[0].textContent.trim()).toBe('9h');
    expect(horas[1].textContent.trim()).toBe('14h30');
    expect(horas[2].textContent.trim()).toBe('19h');

    const periodos = fixture.nativeElement.querySelectorAll('.slot-periodo');
    expect(periodos[0].textContent.trim()).toBe('manhã');
    expect(periodos[1].textContent.trim()).toBe('tarde');
    expect(periodos[2].textContent.trim()).toBe('noite');

    let slotEmitido = 0;
    componente.selecionar.subscribe((id) => (slotEmitido = id));

    botoes[1].click();
    expect(slotEmitido).toBe(102);
    expect(gruposDoisDias).toEqual(copiaGrupos);
  });

  it('renderiza iniciais corretas, remove espacos e mantem cabecalho neutro', () => {
    fixture.componentRef.setInput('corretor', 'Helena Braga');
    fixture.componentRef.setInput('grupos', gruposDoisDias);
    fixture.detectChanges();

    let avatar = fixture.nativeElement.querySelector('.avatar');
    let titulo = fixture.nativeElement.querySelector('.titulo');
    let subtitulo = fixture.nativeElement.querySelector('.subtitulo');

    expect(avatar.textContent.trim()).toBe('HB');
    expect(titulo.textContent.trim()).toBe('Agendar reunião com Helena Braga');
    expect(subtitulo.textContent.trim()).toBe('Corretor(a) · 1 hora · horário de Brasília');

    fixture.componentRef.setInput('corretor', '   Helena    Braga   ');
    fixture.detectChanges();

    avatar = fixture.nativeElement.querySelector('.avatar');
    titulo = fixture.nativeElement.querySelector('.titulo');
    expect(avatar.textContent.trim()).toBe('HB');
    expect(titulo.textContent.trim()).toBe('Agendar reunião com Helena Braga');

    fixture.componentRef.setInput('corretor', 'Helena');
    fixture.detectChanges();

    avatar = fixture.nativeElement.querySelector('.avatar');
    titulo = fixture.nativeElement.querySelector('.titulo');
    expect(avatar.textContent.trim()).toBe('H');
    expect(titulo.textContent.trim()).toBe('Agendar reunião com Helena');

    fixture.componentRef.setInput('corretor', 'Carlos Roberto de Souza');
    fixture.detectChanges();

    avatar = fixture.nativeElement.querySelector('.avatar');
    titulo = fixture.nativeElement.querySelector('.titulo');
    expect(avatar.textContent.trim()).toBe('CS');
    expect(titulo.textContent.trim()).toBe('Agendar reunião com Carlos Roberto de Souza');
    expect(subtitulo.textContent.trim()).toBe('Corretor(a) · 1 hora · horário de Brasília');
  });

  it('botoes sao type button com aria-label completo e suportam foco real', () => {
    fixture.componentRef.setInput('corretor', 'Helena Braga');
    fixture.componentRef.setInput('grupos', gruposDoisDias);
    fixture.detectChanges();

    const botoes = fixture.nativeElement.querySelectorAll('.slot-botao');
    for (const b of Array.from(botoes) as HTMLButtonElement[]) {
      expect(b.getAttribute('type')).toBe('button');
    }

    const primeiroSlot = botoes[0] as HTMLButtonElement;
    const label = primeiroSlot.getAttribute('aria-label') ?? '';
    expect(label).toContain('Quarta, 7 de outubro');
    expect(label).toContain('9h');
    expect(label).toContain('1 hora');
    expect(label).toContain('horário de Brasília');

    primeiroSlot.focus();
    expect(document.activeElement).toBe(primeiroSlot);

    const botaoAgoraNao = fixture.nativeElement.querySelector('.link-recolher') as HTMLButtonElement;
    expect(botaoAgoraNao.getAttribute('type')).toBe('button');
    botaoAgoraNao.focus();
    expect(document.activeElement).toBe(botaoAgoraNao);
  });

  it('busy de envio e sincronizacao pendente bloqueiam slots e links enquanto podeSelecionar falso bloqueia so selecao', () => {
    fixture.componentRef.setInput('corretor', 'Helena Braga');
    fixture.componentRef.setInput('grupos', gruposDoisDias);
    fixture.componentRef.setInput('enviando', true);
    fixture.detectChanges();

    const cartao = fixture.nativeElement.querySelector('.cartao');
    expect(cartao.getAttribute('aria-busy')).toBe('true');

    let botoes = fixture.nativeElement.querySelectorAll('.slot-botao');
    for (const b of Array.from(botoes) as HTMLButtonElement[]) {
      expect(b.disabled).toBeTrue();
    }

    let botaoAgoraNao = fixture.nativeElement.querySelector('.link-recolher') as HTMLButtonElement;
    expect(botaoAgoraNao.disabled).toBeTrue();

    let selecaoEmitida: number | null = null;
    let recolherEmitido = false;
    componente.selecionar.subscribe((id) => (selecaoEmitida = id));
    componente.recolher.subscribe(() => (recolherEmitido = true));

    botoes[0].click();
    botaoAgoraNao.click();
    componente.aoSelecionar(101);
    componente.aoRecolher();
    expect(selecaoEmitida).toBeNull();
    expect(recolherEmitido).toBeFalse();

    fixture.componentRef.setInput('enviando', false);
    fixture.componentRef.setInput('sincronizacaoPendente', true);
    fixture.detectChanges();

    expect(cartao.getAttribute('aria-busy')).toBeNull();
    botoes = fixture.nativeElement.querySelectorAll('.slot-botao');
    for (const b of Array.from(botoes) as HTMLButtonElement[]) {
      expect(b.disabled).toBeTrue();
    }
    botaoAgoraNao = fixture.nativeElement.querySelector('.link-recolher') as HTMLButtonElement;
    expect(botaoAgoraNao.disabled).toBeTrue();

    botoes[0].click();
    botaoAgoraNao.click();
    componente.aoSelecionar(101);
    componente.aoRecolher();
    expect(selecaoEmitida).toBeNull();
    expect(recolherEmitido).toBeFalse();

    fixture.componentRef.setInput('sincronizacaoPendente', false);
    fixture.componentRef.setInput('podeSelecionar', false);
    fixture.detectChanges();

    expect(cartao.getAttribute('aria-busy')).toBeNull();
    botoes = fixture.nativeElement.querySelectorAll('.slot-botao');
    for (const b of Array.from(botoes) as HTMLButtonElement[]) {
      expect(b.disabled).toBeTrue();
    }
    botaoAgoraNao = fixture.nativeElement.querySelector('.link-recolher') as HTMLButtonElement;
    expect(botaoAgoraNao.disabled).toBeFalse();

    botoes[0].click();
    componente.aoSelecionar(101);
    expect(selecaoEmitida).toBeNull();

    botaoAgoraNao.click();
    expect(recolherEmitido).toBeTrue();
  });

  it('horario perdido usa data do slot tentado, lista alternativas e emite selecao para alternativa', () => {
    const slotTentadoPerdido: SlotOferecido = {
      id: 999,
      inicio: '2026-10-07T14:00:00-03:00',
      fim: '2026-10-07T15:00:00-03:00',
    };

    fixture.componentRef.setInput('corretor', 'Helena Braga');
    fixture.componentRef.setInput('grupos', [
      {
        dia: '2026-10-07',
        rotulo: 'Quarta, 7 de outubro',
        horarios: [slot3],
      },
    ]);
    fixture.componentRef.setInput('horarioPerdido', slotTentadoPerdido);
    fixture.detectChanges();

    const aviso = fixture.nativeElement.querySelector('.aviso-perda');
    expect(aviso).not.toBeNull();
    expect(aviso.getAttribute('role')).toBe('alert');
    expect(aviso.textContent).toContain('O horário das 14h de quarta acabou de ser reservado. Estes ainda estão livres:');

    expect(fixture.nativeElement.querySelector('.avatar')).toBeNull();

    const botoes = fixture.nativeElement.querySelectorAll('.slot-botao');
    expect(botoes.length).toBe(1);
    expect(botoes[0].textContent).toContain('19h');

    let selecionado = 0;
    componente.selecionar.subscribe((id) => (selecionado = id));
    botoes[0].click();
    expect(selecionado).toBe(103);
  });

  it('vazio simples e perdido com vazio exibem apenas aviso e ocultam cartao, avatar, footer e slots', () => {
    fixture.componentRef.setInput('corretor', 'Helena Braga');
    fixture.componentRef.setInput('grupos', []);
    fixture.componentRef.setInput('horarioPerdido', null);
    fixture.detectChanges();

    let avisoNeutro = fixture.nativeElement.querySelector('.aviso-vazio-neutro');
    expect(avisoNeutro).not.toBeNull();
    expect(avisoNeutro.textContent.trim()).toBe('Não há horários disponíveis no momento.');
    expect(fixture.nativeElement.querySelector('.cartao')).toBeNull();
    expect(fixture.nativeElement.querySelector('.avatar')).toBeNull();
    expect(fixture.nativeElement.querySelector('.rodape')).toBeNull();
    expect(fixture.nativeElement.querySelector('.link-recolher')).toBeNull();
    expect(fixture.nativeElement.querySelector('.link-reabrir')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.slot-botao').length).toBe(0);

    const slotTentado: SlotOferecido = {
      id: 888,
      inicio: '2026-10-07T10:00:00-03:00',
      fim: '2026-10-07T11:00:00-03:00',
    };

    fixture.componentRef.setInput('grupos', [
      {
        dia: '2026-10-07',
        rotulo: 'Quarta, 7 de outubro',
        horarios: [],
      },
    ]);
    fixture.componentRef.setInput('horarioPerdido', slotTentado);
    fixture.detectChanges();

    const avisoAtencao = fixture.nativeElement.querySelector('.aviso-vazio-atencao');
    expect(avisoAtencao).not.toBeNull();
    expect(avisoAtencao.getAttribute('role')).toBe('alert');
    expect(avisoAtencao.textContent).toContain('O horário das 10h de quarta acabou de ser reservado. Não há horários disponíveis no momento.');
    expect(avisoAtencao.textContent).not.toContain('Estes ainda estão livres');

    expect(fixture.nativeElement.querySelector('.cartao')).toBeNull();
    expect(fixture.nativeElement.querySelector('.avatar')).toBeNull();
    expect(fixture.nativeElement.querySelector('.rodape')).toBeNull();
    expect(fixture.nativeElement.querySelector('.link-recolher')).toBeNull();
    expect(fixture.nativeElement.querySelector('.link-reabrir')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.slot-botao').length).toBe(0);

    fixture.componentRef.setInput('recolhido', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.faixa-recolhida')).toBeNull();
    expect(fixture.nativeElement.querySelector('.aviso-vazio-atencao')).not.toBeNull();
  });

  it('recolhido exibe apenas faixa com icone e botao Ver horario e emite reabrir sem selecionar', () => {
    fixture.componentRef.setInput('corretor', 'Helena Braga');
    fixture.componentRef.setInput('grupos', gruposDoisDias);
    fixture.componentRef.setInput('recolhido', true);
    fixture.detectChanges();

    const faixa = fixture.nativeElement.querySelector('.faixa-recolhida');
    expect(faixa).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.icone-calendario')).not.toBeNull();
    expect(faixa.textContent).toContain('Agendar reunião com Helena Braga');

    expect(fixture.nativeElement.querySelector('.cartao')).toBeNull();
    expect(fixture.nativeElement.querySelector('.avatar')).toBeNull();
    expect(fixture.nativeElement.querySelector('.rodape')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.slot-botao').length).toBe(0);

    const botaoReabrir = fixture.nativeElement.querySelector('.link-reabrir') as HTMLButtonElement;
    expect(botaoReabrir).not.toBeNull();
    expect(botaoReabrir.getAttribute('type')).toBe('button');
    expect(botaoReabrir.textContent.trim()).toBe('Ver horários');

    let reabrirEmitido = false;
    let selecionado: number | null = null;
    componente.reabrir.subscribe(() => (reabrirEmitido = true));
    componente.selecionar.subscribe((id) => (selecionado = id));

    botaoReabrir.click();
    expect(reabrirEmitido).toBeTrue();
    expect(selecionado).toBeNull();

    fixture.componentRef.setInput('recolhido', false);
    fixture.detectChanges();

    let recolherEmitido = false;
    componente.recolher.subscribe(() => (recolherEmitido = true));

    const botaoAgoraNao = fixture.nativeElement.querySelector('.link-recolher') as HTMLButtonElement;
    botaoAgoraNao.click();
    expect(recolherEmitido).toBeTrue();
    expect(selecionado).toBeNull();
  });

  it('respeita dimensoes, tipografia Instrument Sans e adapta tokens nos temas claro e escuro', () => {
    fixture.componentRef.setInput('corretor', 'Helena Braga');
    fixture.componentRef.setInput('grupos', gruposDoisDias);
    fixture.detectChanges();

    const cartao = fixture.nativeElement.querySelector('.cartao') as HTMLElement;
    const primeiroBotao = fixture.nativeElement.querySelector('.slot-botao') as HTMLElement;
    const estiloBotao = window.getComputedStyle(primeiroBotao);

    expect(estiloBotao.width).toBe('76px');
    expect(estiloBotao.height).toBe('54px');
    expect(estiloBotao.borderRadius).toBe('10px');
    expect(estiloBotao.fontFamily).toContain('Instrument Sans');

    const estiloHost = window.getComputedStyle(fixture.nativeElement);
    expect(estiloHost.maxWidth).toBe('560px');

    const slotsLinha = fixture.nativeElement.querySelector('.slots-linha') as HTMLElement;
    const estiloLinha = window.getComputedStyle(slotsLinha);
    expect(estiloLinha.flexWrap).toBe('wrap');

    document.documentElement.setAttribute('data-tema', 'claro');
    fixture.detectChanges();
    const estiloCartaoClaro = window.getComputedStyle(cartao);
    const fundoClaro = estiloCartaoClaro.backgroundColor;
    const textoClaro = estiloCartaoClaro.color;
    expect(fundoClaro.length).toBeGreaterThan(0);

    document.documentElement.setAttribute('data-tema', 'escuro');
    fixture.detectChanges();
    const estiloCartaoEscuro = window.getComputedStyle(cartao);
    const fundoEscuro = estiloCartaoEscuro.backgroundColor;
    const textoEscuro = estiloCartaoEscuro.color;
    expect(fundoEscuro.length).toBeGreaterThan(0);

    expect(fundoClaro).not.toBe(fundoEscuro);
    expect(textoClaro).not.toBe(textoEscuro);

    document.documentElement.removeAttribute('data-tema');
  });

  it('modo confirmado exibe cartao aberto mesmo se recolhido, com slot selecionado desabilitado e sem Agora nao', () => {
    fixture.componentRef.setInput('corretor', 'Helena Braga');
    fixture.componentRef.setInput('grupos', [
      {
        dia: '2026-10-07',
        rotulo: 'Quarta, 7 de outubro',
        horarios: [slot1],
      },
    ]);
    fixture.componentRef.setInput('recolhido', true);
    fixture.componentRef.setInput('confirmado', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.faixa-recolhida')).toBeNull();
    const cartao = fixture.nativeElement.querySelector('.cartao');
    expect(cartao).not.toBeNull();

    const botao = fixture.nativeElement.querySelector('.slot-botao') as HTMLButtonElement;
    expect(botao).not.toBeNull();
    expect(botao.disabled).toBeTrue();
    expect(botao.getAttribute('aria-pressed')).toBe('true');
    expect(botao.classList.contains('selecionado')).toBeTrue();

    expect(fixture.nativeElement.querySelector('.rodape')).toBeNull();
    expect(fixture.nativeElement.querySelector('.link-recolher')).toBeNull();

    let contSelecionar = 0;
    let contRecolher = 0;
    let contReabrir = 0;
    componente.selecionar.subscribe(() => contSelecionar++);
    componente.recolher.subscribe(() => contRecolher++);
    componente.reabrir.subscribe(() => contReabrir++);

    botao.click();
    expect(contSelecionar).toBe(0);

    componente.aoSelecionar(slot1.id);
    componente.aoRecolher();
    componente.aoReabrir();

    expect(contSelecionar).toBe(0);
    expect(contRecolher).toBe(0);
    expect(contReabrir).toBe(0);
  });
});
