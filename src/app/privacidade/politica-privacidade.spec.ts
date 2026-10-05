import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { VERSAO_AVISO_PRIVACIDADE } from '../conversa/contrato';
import { PoliticaPrivacidade } from './politica-privacidade';

describe('PoliticaPrivacidade', () => {
  let fixture: ComponentFixture<PoliticaPrivacidade>;
  let componente: PoliticaPrivacidade;
  let nativo: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PoliticaPrivacidade],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PoliticaPrivacidade);
    componente = fixture.componentInstance;
    nativo = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('exibe a versao atual 2026-09-11 no rotulo', () => {
    const rotulo = nativo.querySelector('.rotulo');
    expect(rotulo?.textContent?.trim()).toBe(`Aviso de Privacidade · versão ${VERSAO_AVISO_PRIVACIDADE}`);
    expect(VERSAO_AVISO_PRIVACIDADE).toBe('2026-09-11');
  });

  it('preserva os titulos e textos essenciais anteriores', () => {
    const h1 = nativo.querySelector('h1');
    expect(h1?.textContent?.trim()).toBe('Como a Solar usa os dados desta conversa');

    const titulosH2 = Array.from(nativo.querySelectorAll('h2')).map((el) => el.textContent?.trim());
    expect(titulosH2).toContain('Dados e finalidade');
    expect(titulosH2).toContain('Inteligência artificial');
    expect(titulosH2).toContain('Atendimento humano');

    const textoCompleto = nativo.textContent ?? '';
    expect(textoCompleto).toContain(
      'A Solar usa as mensagens para compreender sua busca, qualificar seu interesse, recomendar imóveis e dar continuidade ao atendimento.'
    );
    expect(textoCompleto).toContain(
      'As mensagens são processadas por um provedor de inteligência artificial e não são usadas por ele para treinar ou melhorar modelos de inteligência artificial.'
    );
    expect(textoCompleto).toContain(
      'Quando necessário, a conversa e o perfil formado a partir dela são compartilhados com um corretor humano da Solar para continuar o atendimento.'
    );
    expect(textoCompleto).toContain(
      'Evite enviar documentos, dados bancários ou informações sensíveis.'
    );

    const linkVoltar = nativo.querySelector('.link-voltar') as HTMLAnchorElement | null;
    expect(linkVoltar).not.toBeNull();
    expect(linkVoltar?.textContent?.trim()).toBe('Voltar para a conversa');
    expect(linkVoltar?.getAttribute('routerlink') ?? linkVoltar?.getAttribute('ng-reflect-router-link')).toBe('/');
  });

  it('apresenta a secao de retencao com o link correto para a fonte unica', () => {
    const titulosH2 = Array.from(nativo.querySelectorAll('h2')).map((el) => el.textContent?.trim());
    expect(titulosH2).toContain('Retenção');

    const linkRetencao = nativo.querySelector(
      'a[href="https://github.com/fvconde/solar-ai-docs#53-política-de-retenção-de-dados-fonte-única"]'
    ) as HTMLAnchorElement | null;

    expect(linkRetencao).not.toBeNull();
    expect(linkRetencao?.textContent?.trim()).toBe('política de retenção de 12 meses da Solar');
    expect(linkRetencao?.getAttribute('target')).toBe('_blank');
    expect(linkRetencao?.getAttribute('rel')).toBe('noopener noreferrer');

    const paragrafoRetencao = linkRetencao?.parentElement;
    expect(paragrafoRetencao?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'O prazo de guarda e o descarte seguem a política de retenção de 12 meses da Solar.'
    );
  });

  it('possui a secao eliminacao com id, titulo e introducao literais', () => {
    const h2Eliminacao = nativo.querySelector('h2#eliminacao');
    expect(h2Eliminacao).not.toBeNull();
    expect(h2Eliminacao?.textContent?.trim()).toBe('Como pedir a eliminação dos seus dados');

    const paragrafoIntro = h2Eliminacao?.nextElementSibling;
    expect(paragrafoIntro?.tagName.toLowerCase()).toBe('p');
    expect(paragrafoIntro?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Você pode pedir que a Solar apague os dados associados ao seu atendimento. Existem dois caminhos, e você escolhe qual usar.'
    );
  });

  it('apresenta o cartao do canal chat com titulo, instrucoes, limites e links literais', () => {
    const cartaoChat = nativo.querySelector('section[aria-labelledby="canal-chat"]');
    expect(cartaoChat).not.toBeNull();

    const rotuloCanal = cartaoChat?.querySelector('.rotulo-canal');
    expect(rotuloCanal?.textContent?.trim()).toBe('No chat · você mesmo');

    const tituloH3 = cartaoChat?.querySelector('h3#canal-chat');
    expect(tituloH3?.textContent?.trim()).toBe('Apagar pelo botão do chat');

    const textoDescricao = cartaoChat?.querySelector('p');
    expect(textoDescricao?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Na conversa com a Lia, use Apagar conversa, logo abaixo do campo de mensagem. Você confirma, e a conversa e suas mensagens são apagadas definitivamente. Não é possível desfazer.'
    );

    const negrito = textoDescricao?.querySelector('b');
    expect(negrito?.textContent?.trim()).toBe('Apagar conversa');

    const subtituloLimites = cartaoChat?.querySelector('h4');
    expect(subtituloLimites?.textContent?.trim()).toBe('Limites deste caminho');

    const itensLista = Array.from(cartaoChat?.querySelectorAll('li') ?? []).map((li) =>
      li.textContent?.replace(/\s+/g, ' ').trim()
    );
    expect(itensLista).toEqual([
      'Apaga só a conversa escolhida. Suas outras conversas e o seu cadastro na Solar não são apagados por ele.',
      'Funciona no navegador em que a conversa foi aberta ou, com login, na sua conta. Quem usar esse mesmo navegador também consegue apagar.',
      'Algumas conversas antigas, abertas antes de o botão existir, podem não ter essa opção. Nesse caso, peça pelo atendimento.',
      'Para excluir a conta inteira, use Minha conta.',
    ]);

    const linkConta = cartaoChat?.querySelector('li a') as HTMLAnchorElement | null;
    expect(linkConta?.textContent?.trim()).toBe('Minha conta');
    expect(linkConta?.getAttribute('routerlink') ?? linkConta?.getAttribute('ng-reflect-router-link')).toBe('/conta');

    const linkIrConversa = cartaoChat?.querySelector('.link-acao') as HTMLAnchorElement | null;
    expect(linkIrConversa?.textContent?.trim()).toBe('Ir para a conversa');
    expect(linkIrConversa?.getAttribute('routerlink') ?? linkIrConversa?.getAttribute('ng-reflect-router-link')).toBe('/');
  });

  it('apresenta o cartao do canal atendimento humano com texto aprovado e sem placeholders', () => {
    const cartaoHumano = nativo.querySelector('section[aria-labelledby="canal-humano"]');
    expect(cartaoHumano).not.toBeNull();

    const rotuloCanal = cartaoHumano?.querySelector('.rotulo-canal');
    expect(rotuloCanal?.textContent?.trim()).toBe('Com uma pessoa · atendimento');

    const tituloH3 = cartaoHumano?.querySelector('h3#canal-humano');
    expect(tituloH3?.textContent?.trim()).toBe('Pedir ao atendimento humano');

    const textoDescricao = cartaoHumano?.querySelector('p');
    expect(textoDescricao?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Peça ao corretor que atende você ou ao atendimento da Solar.'
    );

    const subtituloUso = cartaoHumano?.querySelector('h4');
    expect(subtituloUso?.textContent?.trim()).toBe('Use este caminho para');

    const itensLista = Array.from(cartaoHumano?.querySelectorAll('li') ?? []).map((li) =>
      li.textContent?.replace(/\s+/g, ' ').trim()
    );
    expect(itensLista).toEqual([
      'apagar outros dados do seu cadastro, além da conversa;',
      'conversas antigas que não tenham o botão;',
      'qualquer caso em que você prefira falar com uma pessoa.',
    ]);

    const orientacao = cartaoHumano?.querySelector('.orientacao');
    expect(orientacao?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Para localizarmos seus dados, informe o telefone ou e-mail que você usou e, se lembrar, o dia da conversa.'
    );

    const textoTotalCartao = cartaoHumano?.textContent ?? '';
    expect(textoTotalCartao).not.toContain('[');
    expect(textoTotalCartao).not.toContain(']');
    expect(textoTotalCartao).not.toContain('WHATSAPP');
    expect(textoTotalCartao).not.toContain('E-MAIL OU WHATSAPP');
    expect(textoTotalCartao).not.toContain('@');
  });

  it('atualiza o estado da barra de rolagem ao redimensionar ou rolar', () => {
    let scrollTopValor = 200;
    spyOnProperty(nativo, 'clientHeight', 'get').and.returnValue(400);
    spyOnProperty(nativo, 'scrollHeight', 'get').and.returnValue(800);
    spyOnProperty(nativo, 'scrollTop', 'get').and.callFake(() => scrollTopValor);
    spyOn(nativo, 'getBoundingClientRect').and.returnValue({
      top: 50,
      left: 0,
      right: 500,
      bottom: 450,
      width: 500,
      height: 400,
      x: 0,
      y: 50,
      toJSON: () => ({}),
    });

    componente.aoRedimensionar();
    fixture.detectChanges();

    const estado = componente.barraRolagem();
    expect(estado.visivel).toBeTrue();
    expect(estado.altura).toBe(400);
    expect(estado.topo).toBe(50);
    expect(estado.thumbAltura).toBeGreaterThan(0);
    expect(estado.thumbTopo).toBeGreaterThan(0);

    const barra = nativo.querySelector('.barra-rolagem') as HTMLElement;
    expect(barra.classList.contains('visivel')).toBeTrue();

    scrollTopValor = 0;
    componente.aoRolar();
    fixture.detectChanges();

    expect(componente.barraRolagem().thumbTopo).toBe(0);
  });
});
