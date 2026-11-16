import { calcular, ContaInvalida, ehConstante } from './calculo.js';

describe('calcular', () => {
  it('faz soma, subtração, multiplicação e divisão com precedência e parênteses', () => {
    expect(calcular('(3900 + 3450) / 2')).toEqual({ resultado: 3675, operandos: [3900, 3450, 2] });
    expect(calcular('2 + 3 * 4').resultado).toBe(14);
    expect(calcular('-(10 - 4) * 2').resultado).toBe(-12);
    expect(calcular('357.5 × 6,2').resultado).toBeCloseTo(2216.5);
  });

  it('lê número em português e com ponto decimal', () => {
    expect(calcular('11.738,7 - 1.276,6').resultado).toBeCloseTo(10462.1);
    expect(calcular('1234.5 + 0.5').resultado).toBe(1235);
  });

  it('recusa o que não é conta: letras, código, divisão por zero, expressão quebrada', () => {
    for (const ruim of ['process.exit()', '2 + abc', '10 / 0', '(2 + 3', '2 +', '', '1e9', '2 ** 3']) expect(() => calcular(ruim)).toThrow(ContaInvalida);
  });

  it('contagens pequenas e fatores de conversão entram sem vir dos dados', () => {
    expect([2, 12, 31, 60, 100, 1000].every(ehConstante)).toBe(true);
    expect([32, 357, 6.2, -1, 2.5].some(ehConstante)).toBe(false);
  });
});
