import { formatadorMetricas as f } from './formatador-metricas';

describe('Formatador de métricas (S-22)', () => {
  it('mostra contagens sem separador de milhar', () => {
    expect(f.numero(1200)).toBe('1200');
    expect(f.numero(0)).toBe('0');
  });
  it('centraliza plurais inclusive mês irregular', () => {
    expect(f.plural(1, 'conversa', 'conversas')).toBe('1 conversa');
    expect(f.plural(0, 'conversa', 'conversas')).toBe('0 conversas');
    expect(f.plural(2, 'mês', 'meses')).toBe('2 meses');
  });
  it('arredonda percentuais e preserva proporção da largura', () => {
    expect(f.percentual(1, 3)).toBe('33%');
    expect(parseFloat(f.largura(1, 3))).toBeCloseTo(33.333, 2);
    expect(f.percentual(14, 14)).toBe('100%');
  });
  it('denominador zero produz travessão e largura zero', () => {
    expect(f.percentual(0, 0)).toBe('—');
    expect(f.percentual(2, 0)).toBe('—');
    expect(f.largura(2, 0)).toBe('0%');
  });
  it('não produz NaN nem permite barras fora da área', () => {
    expect(f.percentual(NaN, 3)).toBe('—');
    expect(f.numero(Infinity)).toBe('—');
    expect(f.largura(Infinity, 3)).toBe('0%');
    expect(f.largura(-1, 2)).toBe('0%');
    expect(f.largura(5, 2)).toBe('100%');
  });
  it('datas ausentes ou inválidas usam travessão', () => {
    expect(f.data(null)).toBe('—');
    expect(f.data('inválida')).toBe('—');
  });
  it('formata mês, agenda e atualização em português no fuso do navegador', () => {
    expect(f.data('2026-10-15T15:00:00Z', 'mes')).toContain('2026');
    expect(f.data('2026-10-15T15:00:00Z', 'mes')).toContain('out');
    expect(f.data('2026-10-15T15:00:00Z')).toMatch(/15\/10.*\d{2}:\d{2}/);
    expect(f.data('2026-10-15T15:00:00Z', 'horario')).toMatch(/^\d{2}:\d{2}$/);
  });
  it('formata tempo em minutos e horas arredondando ao inteiro mais próximo', () => {
    expect(f.tempo(null)).toBe('—');
    expect(f.tempo(NaN)).toBe('—');
    expect(f.tempo(Infinity)).toBe('—');
    expect(f.tempo(-1)).toBe('—');
    expect(f.tempo(0)).toBe('0 min');
    expect(f.tempo(59)).toBe('59 min');
    expect(f.tempo(59.6)).toBe('1 h 00 min');
    expect(f.tempo(60)).toBe('1 h 00 min');
    expect(f.tempo(65)).toBe('1 h 05 min');
    expect(f.tempo(120)).toBe('2 h 00 min');
  });
  it('formata histórico e data diaMes em UTC sem desvio de fuso na meia-noite', () => {
    expect(f.data('2026-10-10T00:00:00Z', 'diaMes')).toBe('10/10');
    expect(f.historico('2026-10-10T00:00:00Z')).toBe(
      'Histórico de avanço disponível desde 10/10. Conversas anteriores não entram no gráfico nem em Dados essenciais e Horários confirmados.'
    );
  });
  it('formata proporção de conversas com singular, plural e base zero', () => {
    expect(f.deConversas(8, 14)).toBe('8 de 14 conversas');
    expect(f.deConversas(1, 1)).toBe('1 de 1 conversa');
    expect(f.deConversas(0, 0)).toBe('Nenhuma conversa ainda');
    expect(f.deConversas(0, 14)).toBe('0 de 14 conversas');
  });
  it('calcula faltantes na etapa com plural e limite em zero', () => {
    expect(f.faltamEtapa(13, 14)).toBe('1 conversa ainda não atingiu esta etapa');
    expect(f.faltamEtapa(12, 14)).toBe('2 conversas ainda não atingiram esta etapa');
    expect(f.faltamEtapa(14, 14)).toBe('0 conversas ainda não atingiram esta etapa');
    expect(f.faltamEtapa(15, 14)).toBe('0 conversas ainda não atingiram esta etapa');
  });
  it('mostra nota de encaminhamento sem dados essenciais para 1 e 2 conversas e vazia no zero', () => {
    expect(f.notaEncaminhamento(0)).toBe('');
    expect(f.notaEncaminhamento(1)).toBe('Inclui 1 conversa sem os dados essenciais.');
    expect(f.notaEncaminhamento(2)).toBe('Inclui 2 conversas sem os dados essenciais.');
  });
  it('calcula percentuais do avanço do supervisor provando independência de etapas', () => {
    const base = 14;
    expect(f.percentualEtapa(14, base, true)).toBe('Grupo de referência do período');
    expect(f.percentual(14, base)).toBe('100%');
    expect(f.percentualEtapa(12, base, false)).toBe('86% das conversas iniciadas');
    expect(f.percentualEtapa(8, base, false)).toBe('57% das conversas iniciadas');
    expect(f.percentualEtapa(9, base, false)).toBe('64% das conversas iniciadas');
    expect(f.percentualEtapa(7, base, false)).toBe('50% das conversas iniciadas');
    expect(f.percentualEtapa(4, base, false)).toBe('29% das conversas iniciadas');
  });
  it('calcula percentual do corretor usando a primeira barra de atribuídas', () => {
    const baseCorretor = 3;
    expect(f.percentualEtapa(3, baseCorretor, true)).toBe('Grupo de referência do período');
    expect(f.percentualEtapa(2, baseCorretor, 'atribuidas')).toBe('67% das conversas atribuídas');
  });
  it('gera texto acessível da etapa com título, unidade, percentual, faltantes, nota e explicação', () => {
    const itemSupervisor = { etapa: 'encaminhamento' as const, conversas: 9, semEssenciais: 2 };
    const ariaSupervisor = f.ariaEtapa(itemSupervisor, 14, false);
    expect(ariaSupervisor).toContain('Encaminhamento solicitado');
    expect(ariaSupervisor).toContain('9 conversas');
    expect(ariaSupervisor).toContain('64% das conversas iniciadas');
    expect(ariaSupervisor).toContain('5 conversas ainda não atingiram esta etapa');
    expect(ariaSupervisor).toContain('Inclui 2 conversas sem os dados essenciais.');
    expect(ariaSupervisor).toContain('Pedido de atendimento humano registrado');

    const itemPrimeiro = { etapa: 'iniciadas' as const, conversas: 14 };
    const ariaPrimeiro = f.ariaEtapa(itemPrimeiro, 14, true);
    expect(ariaPrimeiro).toContain('Conversas iniciadas');
    expect(ariaPrimeiro).toContain('14 conversas');
    expect(ariaPrimeiro).toContain('100%');
    expect(ariaPrimeiro).toContain('Grupo de referência do período');
    expect(ariaPrimeiro).toContain('Primeira mensagem do usuário, sem contar o "Olá" automático');

    const itemCorretor = { etapa: 'horario' as const, conversas: 2 };
    const ariaCorretor = f.ariaEtapa(itemCorretor, 3, false, 'atribuidas');
    expect(ariaCorretor).toContain('Horário confirmado');
    expect(ariaCorretor).toContain('2 conversas');
    expect(ariaCorretor).toContain('67% das conversas atribuídas');
    expect(ariaCorretor).toContain('1 conversa ainda não atingiu esta etapa');
    expect(ariaCorretor).toContain('Reserva confirmada na agenda');
  });
  it('gera texto acessível de todo o funil com títulos e contagens', () => {
    const itens = [
      { etapa: 'iniciadas' as const, conversas: 14 },
      { etapa: 'intencao' as const, conversas: 12 },
      { etapa: 'essenciais' as const, conversas: 8 },
      { etapa: 'encaminhamento' as const, conversas: 9, semEssenciais: 2 },
      { etapa: 'corretor' as const, conversas: 7 },
      { etapa: 'horario' as const, conversas: 4 },
    ];
    const aria = f.ariaAvanco(itens);
    expect(aria).toContain('Avanço das conversas no chat:');
    expect(aria).toContain('Conversas iniciadas 14 conversas');
    expect(aria).toContain('Intenção identificada 12 conversas');
    expect(aria).toContain('Dados essenciais preenchidos 8 conversas');
    expect(aria).toContain('Encaminhamento solicitado 9 conversas');
    expect(aria).toContain('Corretor atribuído 7 conversas');
    expect(aria).toContain('Horário confirmado 4 conversas');
  });
  it('formata resumo de horários confirmados com plural, singular e base zero', () => {
    expect(f.resumoHorarios(4, 14)).toBe('29% das conversas tiveram horário confirmado');
    expect(f.resumoHorarios(1, 14)).toBe('7% das conversas teve horário confirmado');
    expect(f.resumoHorarios(1, 1)).toBe('100% da conversa teve horário confirmado');
    expect(f.resumoHorarios(0, 0)).toBe('Sem conversas no período');
  });
  it('formata frases de follow-up para janelas e contagens de observação', () => {
    expect(f.respostaFollowUp(1)).toBe('Responderam em até 1 dia.');
    expect(f.respostaFollowUp(3)).toBe('Responderam em até 3 dias.');
    expect(f.respostaFollowUp(7)).toBe('Responderam em até 7 dias.');

    expect(f.observacaoFollowUp(0)).toBe('Nenhum follow-up em observação');
    expect(f.observacaoFollowUp(1)).toBe('1 follow-up em observação');
    expect(f.observacaoFollowUp(2)).toBe('2 follow-ups em observação');
  });
  it('formata série de tempo com null sem dizer zero e série vazia sem dados', () => {
    expect(f.serieTempo([])).toBe('Sem dados de tempo');
    expect(f.serieTempo([18, 15, 14, 12, 13, 11, 11])).toBe(
      'Mediana diária dos últimos 7 dias: 18 min, 15 min, 14 min, 12 min, 13 min, 11 min, 11 min'
    );
    const serieComNull = f.serieTempo([null, 15, null, 12, null, null, 11]);
    expect(serieComNull).toContain('sem dados');
    expect(serieComNull).not.toContain('zero');
    expect(serieComNull).not.toContain('0 min');
    expect(f.fraseVisivelSerieTempo([])).toBe('A linha aparece com o primeiro encaminhamento.');
    expect(f.fraseVisivelSerieTempo([18, 15, 14, 12, 13, 11, 11])).toBe(
      'Mediana diária, últimos 7 dias: de 18 min para 11 min.'
    );
    expect(f.fraseVisivelSerieTempo([null, 15, null, 12, null, null, 11])).toBe(
      'Mediana diária, últimos 7 dias: de 15 min para 11 min; dias sem dados ficam sem ponto.'
    );
  });
});
