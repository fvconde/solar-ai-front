import {
  HOJE,
  agruparSlotsPorDia,
  blocoDataDoAgendamento,
  dataDoAgendamento,
  diaDaSemanaDoAgendamento,
  diaDe,
  diaDoAgendamento,
  diaExtensoDoAgendamento,
  horaDoAgendamento,
  intervaloDoAgendamento,
  periodoDoAgendamento,
  rotuloDeDia,
} from './horario';
import { SlotOferecido } from './contrato';

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

describe('diaDoAgendamento', () => {
  it('converte para YYYY-MM-DD em America/Sao_Paulo', () => {
    expect(diaDoAgendamento('2026-10-07T17:00:00Z')).toBe('2026-10-07');
  });

  it('respeita virada de fuso UTC para dia anterior em SP', () => {
    expect(diaDoAgendamento('2026-10-08T01:00:00Z')).toBe('2026-10-07');
  });

  it('retorna vazio para data invalida', () => {
    expect(diaDoAgendamento('data-invalida')).toBe('');
    expect(diaDoAgendamento('')).toBe('');
  });
});

describe('diaDaSemanaDoAgendamento', () => {
  it('extrai dia da semana sem -feira e com inicial maiuscula', () => {
    expect(diaDaSemanaDoAgendamento('2026-10-07T17:00:00Z')).toBe('Quarta');
  });

  it('reconhece Sabado e Domingo com acentuacao correta', () => {
    expect(diaDaSemanaDoAgendamento('2026-10-10T17:00:00Z')).toBe('Sábado');
    expect(diaDaSemanaDoAgendamento('2026-10-11T17:00:00Z')).toBe('Domingo');
  });

  it('retorna vazio para data invalida', () => {
    expect(diaDaSemanaDoAgendamento('invalido')).toBe('');
  });
});

describe('diaExtensoDoAgendamento', () => {
  it('formata como Quarta, 7 de outubro', () => {
    expect(diaExtensoDoAgendamento('2026-10-07T17:00:00Z')).toBe('Quarta, 7 de outubro');
  });

  it('preserva dia correto na virada UTC 2026-10-08T01:00:00Z', () => {
    expect(diaExtensoDoAgendamento('2026-10-08T01:00:00Z')).toBe('Quarta, 7 de outubro');
  });

  it('retorna vazio para data invalida', () => {
    expect(diaExtensoDoAgendamento('invalido')).toBe('');
  });
});

describe('horaDoAgendamento', () => {
  it('formata 14h para 2026-10-07T17:00:00Z', () => {
    expect(horaDoAgendamento('2026-10-07T17:00:00Z')).toBe('14h');
  });

  it('formata 9h e 19h sem minutos quando nulos', () => {
    expect(horaDoAgendamento('2026-10-07T12:00:00Z')).toBe('9h');
    expect(horaDoAgendamento('2026-10-07T22:00:00Z')).toBe('19h');
  });

  it('preserva minutos nao nulos como 14h30', () => {
    expect(horaDoAgendamento('2026-10-07T17:30:00Z')).toBe('14h30');
  });

  it('respeita virada de horario UTC 2026-10-08T01:00:00Z como 22h em SP', () => {
    expect(horaDoAgendamento('2026-10-08T01:00:00Z')).toBe('22h');
  });

  it('retorna vazio para data invalida', () => {
    expect(horaDoAgendamento('invalido')).toBe('');
  });
});

describe('periodoDoAgendamento', () => {
  it('retorna tarde para 2026-10-07T17:00:00Z', () => {
    expect(periodoDoAgendamento('2026-10-07T17:00:00Z')).toBe('tarde');
  });

  it('retorna manha antes de 12 e noite a partir de 18', () => {
    expect(periodoDoAgendamento('2026-10-07T12:00:00Z')).toBe('manhã');
    expect(periodoDoAgendamento('2026-10-07T22:00:00Z')).toBe('noite');
  });

  it('retorna vazio para data invalida', () => {
    expect(periodoDoAgendamento('invalido')).toBe('');
  });
});

describe('intervaloDoAgendamento', () => {
  it('formata 14h as 15h para intervalo valido', () => {
    expect(intervaloDoAgendamento('2026-10-07T17:00:00Z', '2026-10-07T18:00:00Z')).toBe('14h às 15h');
  });

  it('retorna vazio se alguma data for invalida', () => {
    expect(intervaloDoAgendamento('2026-10-07T17:00:00Z', 'invalido')).toBe('');
    expect(intervaloDoAgendamento('invalido', '2026-10-07T18:00:00Z')).toBe('');
  });
});

describe('dataDoAgendamento', () => {
  it('formata Quarta, 7 de outubro, 14h as 15h', () => {
    expect(dataDoAgendamento('2026-10-07T17:00:00Z', '2026-10-07T18:00:00Z')).toBe('Quarta, 7 de outubro, 14h às 15h');
  });

  it('retorna vazio se alguma data for invalida', () => {
    expect(dataDoAgendamento('invalido', '2026-10-07T18:00:00Z')).toBe('');
  });
});

describe('blocoDataDoAgendamento', () => {
  it('retorna { mes: OUT, dia: 7 } para 2026-10-07T17:00:00Z', () => {
    expect(blocoDataDoAgendamento('2026-10-07T17:00:00Z')).toEqual({ mes: 'OUT', dia: '7' });
  });

  it('preserva virada UTC 2026-10-08T01:00:00Z como dia 7 em SP', () => {
    expect(blocoDataDoAgendamento('2026-10-08T01:00:00Z')).toEqual({ mes: 'OUT', dia: '7' });
  });

  it('retorna { mes: , dia:  } para data invalida', () => {
    expect(blocoDataDoAgendamento('invalido')).toEqual({ mes: '', dia: '' });
  });
});

describe('agruparSlotsPorDia', () => {
  it('agrupa por dia SP em ordem cronologica com rotulo extenso e ignora slots invalidos sem mutar entrada', () => {
    const entrada: SlotOferecido[] = [
      { id: 20, inicio: '2026-10-08T17:00:00Z', fim: '2026-10-08T18:00:00Z' },
      { id: 99, inicio: 'invalido', fim: '2026-10-07T18:00:00Z' },
      { id: 10, inicio: '2026-10-07T17:00:00Z', fim: '2026-10-07T18:00:00Z' },
      { id: 11, inicio: '2026-10-07T12:00:00Z', fim: '2026-10-07T13:00:00Z' },
    ];
    const copiaJson = JSON.stringify(entrada);

    const resultado = agruparSlotsPorDia(entrada);

    expect(JSON.stringify(entrada)).toBe(copiaJson);
    expect(resultado.length).toBe(2);

    expect(resultado[0].dia).toBe('2026-10-07');
    expect(resultado[0].rotulo).toBe('Quarta, 7 de outubro');
    expect(resultado[0].horarios.map((s) => s.id)).toEqual([11, 10]);

    expect(resultado[1].dia).toBe('2026-10-08');
    expect(resultado[1].rotulo).toBe('Quinta, 8 de outubro');
    expect(resultado[1].horarios.map((s) => s.id)).toEqual([20]);
  });

  it('retorna array vazio para entrada vazia ou invalida', () => {
    expect(agruparSlotsPorDia([])).toEqual([]);
    expect(agruparSlotsPorDia(null as unknown as SlotOferecido[])).toEqual([]);
  });
});
