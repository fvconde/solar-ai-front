import { HOJE, diaDe, rotuloDeDia } from './horario';

function iso(ano: number, mes: number, dia: number, hora = 12): string {
  return new Date(ano, mes - 1, dia, hora).toISOString();
}

describe('rotuloDeDia', () => {
  const agora = new Date(2026, 8, 8, 20, 30);

  it('chama o proprio dia de Hoje', () => {
    expect(rotuloDeDia(iso(2026, 9, 8), agora)).toBe(HOJE);
  });

  it('chama o dia anterior de Ontem', () => {
    expect(rotuloDeDia(iso(2026, 9, 7), agora)).toBe('Ontem');
  });

  it('escreve a data quando e do mesmo ano, sem repetir o ano', () => {
    const rotulo = rotuloDeDia(iso(2026, 9, 1), agora);

    expect(rotulo).toContain('setembro');
    expect(rotulo).not.toContain('2026');
  });

  it('inclui o ano quando a conversa e de outro ano', () => {
    expect(rotuloDeDia(iso(2025, 12, 30), agora)).toContain('2025');
  });

  it('nao confunde meia-noite com o dia seguinte', () => {
    expect(rotuloDeDia(iso(2026, 9, 8, 0), agora)).toBe(HOJE);
    expect(rotuloDeDia(iso(2026, 9, 8, 23), agora)).toBe(HOJE);
  });

  it('cai em Hoje quando a data e invalida, em vez de quebrar', () => {
    expect(rotuloDeDia('nao e data', agora)).toBe(HOJE);
  });
});

describe('diaDe', () => {
  it('agrupa horas diferentes do mesmo dia', () => {
    expect(diaDe(iso(2026, 9, 8, 1))).toBe(diaDe(iso(2026, 9, 8, 23)));
  });

  it('separa dias vizinhos', () => {
    expect(diaDe(iso(2026, 9, 8))).not.toBe(diaDe(iso(2026, 9, 9)));
  });
});
