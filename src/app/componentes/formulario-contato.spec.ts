import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormularioContato } from './formulario-contato';
import { ContatoRequest } from '../conversa/contrato';

describe('FormularioContato', () => {
  let fixture: ComponentFixture<FormularioContato>;
  let component: FormularioContato;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormularioContato],
    }).compileComponents();

    fixture = TestBed.createComponent(FormularioContato);
    component = fixture.componentInstance;
  });

  it('inicia vazio quando dadosIniciais for nulo', () => {
    fixture.componentRef.setInput('contexto', 'anon:c-1');
    fixture.componentRef.setInput('dadosIniciais', null);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const inputNome = host.querySelector('input[type="text"]') as HTMLInputElement;
    const inputTel = host.querySelector('input[type="tel"]') as HTMLInputElement;
    const inputEmail = host.querySelector('input[type="email"]') as HTMLInputElement;
    const btn = host.querySelector('button.acao') as HTMLButtonElement;

    expect(inputNome.value).toBe('');
    expect(inputTel.value).toBe('');
    expect(inputEmail.value).toBe('');
    expect(btn.disabled).toBeTrue();
  });

  it('preenche campos a partir de dadosIniciais e habilita envio', () => {
    const dados: ContatoRequest = {
      nome: 'Carlos Santos',
      telefone: '(11) 98888-7777',
      email: 'carlos@solar.com.br',
    };
    fixture.componentRef.setInput('contexto', 'user-1:c-1');
    fixture.componentRef.setInput('dadosIniciais', dados);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const inputNome = host.querySelector('input[type="text"]') as HTMLInputElement;
    const inputTel = host.querySelector('input[type="tel"]') as HTMLInputElement;
    const inputEmail = host.querySelector('input[type="email"]') as HTMLInputElement;
    const btn = host.querySelector('button.acao') as HTMLButtonElement;

    expect(inputNome.value).toBe('Carlos Santos');
    expect(inputTel.value).toBe('(11) 98888-7777');
    expect(inputEmail.value).toBe('carlos@solar.com.br');
    expect(btn.disabled).toBeFalse();
  });

  it('nao sobrescreve campo editado pelo usuario quando dadosIniciais chegar tardiamente', () => {
    fixture.componentRef.setInput('contexto', 'user-1:c-1');
    fixture.componentRef.setInput('dadosIniciais', null);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const inputNome = host.querySelector('input[type="text"]') as HTMLInputElement;
    inputNome.value = 'Nome Editado Manualmente';
    inputNome.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const dados: ContatoRequest = {
      nome: 'Nome Original Da Conta',
      telefone: '(11) 91111-2222',
      email: 'email@conta.com',
    };
    fixture.componentRef.setInput('dadosIniciais', dados);
    fixture.detectChanges();

    const inputTel = host.querySelector('input[type="tel"]') as HTMLInputElement;
    const inputEmail = host.querySelector('input[type="email"]') as HTMLInputElement;

    expect(inputNome.value).toBe('Nome Editado Manualmente');
    expect(inputTel.value).toBe('(11) 91111-2222');
    expect(inputEmail.value).toBe('email@conta.com');
  });

  it('mudanca de contexto reinicia alteracoes e flags de edicao', () => {
    fixture.componentRef.setInput('contexto', 'user-1:c-1');
    fixture.componentRef.setInput('dadosIniciais', {
      nome: 'Nome Original',
      telefone: '(11) 90000-0000',
      email: 'original@solar.com.br',
    });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const inputNome = host.querySelector('input[type="text"]') as HTMLInputElement;
    inputNome.value = 'Edicao Conversa 1';
    inputNome.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(inputNome.value).toBe('Edicao Conversa 1');

    fixture.componentRef.setInput('contexto', 'user-1:c-2');
    fixture.detectChanges();

    expect(inputNome.value).toBe('Nome Original');
  });

  it('confirmar emite campos preenchidos e faz trim', () => {
    let emitido: ContatoRequest | null = null;
    component.enviar.subscribe((dados) => {
      emitido = dados;
    });

    fixture.componentRef.setInput('contexto', 'anon:c-1');
    fixture.componentRef.setInput('dadosIniciais', null);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const inputNome = host.querySelector('input[type="text"]') as HTMLInputElement;
    const inputEmail = host.querySelector('input[type="email"]') as HTMLInputElement;

    inputNome.value = '  Teste Trim  ';
    inputNome.dispatchEvent(new Event('input'));
    inputEmail.value = '  teste@solar.com.br  ';
    inputEmail.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const btn = host.querySelector('button.acao') as HTMLButtonElement;
    btn.click();

    expect(emitido!).toEqual({
      nome: 'Teste Trim',
      telefone: null,
      email: 'teste@solar.com.br',
    });
  });
});
