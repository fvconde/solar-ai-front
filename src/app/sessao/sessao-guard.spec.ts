import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { SessaoResponse } from './sessao-contrato';
import { entrarGuard } from './sessao-guard';
import { SessaoStore } from './sessao-store';
import { sessaoCliente, sessaoCorretor, sessaoSupervisor } from './sessao-teste';

@Component({ template: 'Formulário de login' })
class TelaLoginTeste {}

@Component({ template: 'Chat' })
class TelaChatTeste {}

@Component({ template: 'Painel' })
class TelaPainelTeste {}

describe('entrarGuard', () => {
  let resposta: SessaoResponse | null;

  beforeEach(async () => {
    resposta = null;

    await TestBed.configureTestingModule({
      imports: [TelaLoginTeste, TelaChatTeste, TelaPainelTeste],
      providers: [
        provideRouter([
          { path: '', component: TelaChatTeste },
          { path: 'entrar', component: TelaLoginTeste, canActivate: [entrarGuard] },
          { path: 'painel', component: TelaPainelTeste },
        ]),
        { provide: SessaoStore, useValue: { restaurar: () => of(resposta) } },
      ],
    }).compileComponents();
  });

  it('mantém visitante no formulário de login', async () => {
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);

    await harness.navigateByUrl('/entrar', TelaLoginTeste);

    expect(router.url).toBe('/entrar');
    expect(harness.routeNativeElement?.textContent?.trim()).toBe('Formulário de login');
  });

  it('redireciona cliente autenticado para o chat', async () => {
    resposta = sessaoCliente();
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);

    await harness.navigateByUrl('/entrar', TelaChatTeste);

    expect(router.url).toBe('/');
    expect(harness.routeNativeElement?.textContent?.trim()).toBe('Chat');
  });

  it('redireciona corretor autenticado para o painel', async () => {
    resposta = sessaoCorretor('aprovado');
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);

    await harness.navigateByUrl('/entrar', TelaPainelTeste);

    expect(router.url).toBe('/painel');
    expect(harness.routeNativeElement?.textContent?.trim()).toBe('Painel');
  });

  it('redireciona supervisor autenticado para o painel', async () => {
    resposta = sessaoSupervisor(1);
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);

    await harness.navigateByUrl('/entrar', TelaPainelTeste);

    expect(router.url).toBe('/painel');
    expect(harness.routeNativeElement?.textContent?.trim()).toBe('Painel');
  });
});
