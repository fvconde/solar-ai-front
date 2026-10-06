/**
 * Teste descartável com falha determinística intencional para validação do gate de CI do frontend.
 * Card: S-28 (Execução: 91454301-5111-4a21-82f9-7d47a4ea0cce)
 * Branch descartável: teste/S-28-gate-vermelho
 */
describe('S28GateVermelho', () => {
  it('falha intencional determinística para validação do gate de CI', () => {
    expect(false).toBe(true);
  });
});
