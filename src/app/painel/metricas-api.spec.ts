import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PainelApi } from './painel-api';
import { metricasParaTeste } from './metricas-painel.fixture';

describe('HTTP de métricas (S-22)', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('envia dias=30 e credenciais e mantém números crus e datas ISO', () => {
    const dados = metricasParaTeste();
    TestBed.inject(PainelApi).obterMetricas().subscribe(resposta => expect(resposta).toEqual(dados));
    const req = http.expectOne('/api/painel/metricas?dias=30');
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(dados);
  });
  it('aceita uma janela explícita sem alterar o contrato', () => {
    TestBed.inject(PainelApi).obterMetricas(7).subscribe();
    const req = http.expectOne('/api/painel/metricas?dias=7');
    expect(req.request.params.get('dias')).toBe('7');
    req.flush(metricasParaTeste(true));
  });
});
