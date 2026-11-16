import { comVariacoes, numerosSemFonte } from './conferencia.js';

const DADOS = JSON.stringify({
  fazenda: 'Granja Mangueira',
  maquinas: [{ id: '637795', nome: '8270R - 23', ultimoSinal: '2026-11-16T11:04:00.000Z' }],
  relatorio: {
    inicio: '2026-10-01',
    fim: '2026-10-31',
    indicadores: { areaHa: { valor: 11738.7, anterior: 1276.6, diferenca: 10462.1, variacaoPct: 820 }, horas: { valor: 991.6, anterior: 1153 }, consumoLPorHora: { valor: 19.3 }, paradoMin: { valor: 19792 }, litros: { valor: 357.49 } },
    porMaquina: [{ nome: '8270R - 23', paradoMin: 4138, horas: 16.09 }],
  },
});

describe('numerosSemFonte', () => {
  const sem = (resposta: string, fontes: string[] = [DADOS]) => numerosSemFonte(resposta, fontes);

  it('aceita número igual ao dado, escrito em português, arredondado ou com a marcação da resposta', () => {
    expect(sem('Outubro teve **11.738,7 ha**, contra 1.276,6 ha em setembro (820% a mais).')).toEqual([]);
    expect(sem('Foram 992 h de máquina, 19 L/h e 357,5 L.')).toEqual([]);
    expect(sem('| Máquina | Horas |\n|---|---|\n| 8270R - 23 | 16,1 |')).toEqual([]);
  });

  it('aceita duração e horário que correspondem ao dado', () => {
    expect(sem('O 8270R - 23 ficou 68h58 parado; a fazenda, 329 h 52 min.')).toEqual([]);
    expect(sem('Último sinal às 08:04.')).toEqual([]);
    expect(sem('Trabalhou 16 h 05 no dia.')).toEqual([]);
  });

  it('não confere contagem pequena, dia do mês, ano nem contagem de tempo', () => {
    expect(sem('1. Em 16 de novembro de 2026, 2 máquinas pararam nos últimos 45 dias.\n2. Em 2025 não há dado.')).toEqual([]);
  });

  it('barra número que não existe em lugar nenhum', () => {
    expect(sem('O total do ano foi 17.485 ha.')).toEqual(['17.485 ha']);
    expect(sem('Novembro teve 4.470 ha e o consumo foi 24,6 L/h.')).toEqual(['4.470 ha', '24,6 l']);
    expect(sem('Ficou 12h30 parado.')).toEqual(['12h30']);
    expect(sem('Último sinal às 14:20.')).toEqual(['14:20']);
    // Inteiro pequeno COM unidade é medição: precisa de fonte.
    expect(sem('Gastou 5 L/h.')).toEqual(['5 l']);
    expect(sem('Subiu 37%.')).toEqual(['37 %']);
  });

  it('número que o usuário escreveu na pergunta pode ser repetido; o que o assistente disse antes, não', () => {
    expect(sem('Não tenho dados do talhão 2451.', [DADOS, 'Como foi o talhão 2451?'])).toEqual([]);
    expect(sem('Não tenho dados do talhão 2451.')).toEqual(['2451']);
  });
});

describe('comVariacoes', () => {
  it('acrescenta diferença e variação em % a todo par valor/anterior, em qualquer profundidade', () => {
    const saida = comVariacoes({ indicadores: { horas: { valor: 992, anterior: 1153 }, litros: { valor: 10, anterior: null }, area: { valor: 5, anterior: 0 } }, lista: [{ valor: 3, anterior: 2 }], nome: 'x' });
    expect(saida.indicadores.horas).toEqual({ valor: 992, anterior: 1153, diferenca: -161, variacaoPct: -14 });
    expect(saida.indicadores.litros).toEqual({ valor: 10, anterior: null });
    expect(saida.indicadores.area).toMatchObject({ diferenca: 5, variacaoPct: null });
    expect(saida.lista[0]).toMatchObject({ diferenca: 1, variacaoPct: 50 });
    expect(saida.nome).toBe('x');
  });
});
